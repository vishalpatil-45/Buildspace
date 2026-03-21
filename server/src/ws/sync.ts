import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';
import { verifyAccessToken } from '../utils/jwt';
import { query } from '../db/pool';
import { getYDocState, setYDocState } from '../db/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Message types (y-protocols)
const messageSync = 0;
const messageAwareness = 1;
const messageChatHistory = 10;
const messageChatNew = 11;

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  userEmail: string;
  userName: string;
  projectId: string;
  fileId: string;
  role: string;
  awareness: awarenessProtocol.Awareness;
}

// Map of fileId → { doc, awareness, clients, snapshotTimer }
const docs = new Map<string, {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Set<ConnectedClient>;
  snapshotTimer: ReturnType<typeof setInterval> | null;
}>();

function getOrCreateDoc(fileId: string) {
  if (!docs.has(fileId)) {
    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);
    const room = { doc, awareness, clients: new Set<ConnectedClient>(), snapshotTimer: null as any };
    docs.set(fileId, room);
    return room;
  }
  return docs.get(fileId)!;
}

async function loadDocFromStorage(fileId: string, doc: Y.Doc) {
  // Try Redis first
  const cached = await getYDocState(fileId).catch(() => null);
  if (cached) {
    Y.applyUpdate(doc, cached);
    logger.debug('Loaded Y.Doc from Redis', { fileId });
    return;
  }
  // Fall back to PostgreSQL
  const result = await query<{ crdt_snapshot: Buffer | null; content: string }>(
    'SELECT crdt_snapshot, content FROM files WHERE id = $1',
    [fileId]
  ).catch(() => null);

  if (result && result.rowCount > 0) {
    const { crdt_snapshot, content } = result.rows[0];
    if (crdt_snapshot) {
      Y.applyUpdate(doc, new Uint8Array(crdt_snapshot));
      logger.debug('Loaded Y.Doc from PostgreSQL snapshot', { fileId });
    } else if (content) {
      const yText = doc.getText('content');
      yText.insert(0, content);
      logger.debug('Initialized Y.Doc from plain text content', { fileId });
    }
  }
}

async function snapshotDoc(fileId: string, doc: Y.Doc) {
  try {
    const state = Y.encodeStateAsUpdate(doc);
    await setYDocState(fileId, state);
    const content = doc.getText('content').toString();
    await query(
      'UPDATE files SET crdt_snapshot = $1, content = $2, updated_at = NOW() WHERE id = $3',
      [Buffer.from(state), content, fileId]
    );
    logger.debug('Snapshot saved', { fileId, contentLength: content.length });
  } catch (err) {
    logger.error('Snapshot error', { fileId, error: err });
  }
}

function broadcastToRoom(fileId: string, data: Buffer, exclude?: WebSocket) {
  const room = docs.get(fileId);
  if (!room) return;
  room.clients.forEach((client) => {
    if (client.ws !== exclude && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  });
}

function sendToClient(ws: WebSocket, msgType: number, payload: Uint8Array) {
  if (ws.readyState !== WebSocket.OPEN) return;
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, msgType);
  encoding.writeVarUint8Array(encoder, payload);
  ws.send(encoding.toUint8Array(encoder));
}

export function setupSyncWs(server: http.Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (request, socket, head) => {
    const url = new URL(request.url!, `http://${request.headers.host}`);
    if (!url.pathname.startsWith('/ws/sync')) return;

    const token = url.searchParams.get('token');
    const projectId = url.searchParams.get('projectId');
    const fileId = url.searchParams.get('fileId');

    if (!token || !projectId || !fileId) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    let userId: string;
    let userEmail: string;
    try {
      const payload = verifyAccessToken(token);
      userId = payload.userId;
      userEmail = payload.email;
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // Check project membership
    const memberResult = await query<{ role: string; name: string }>(
      `SELECT pm.role, u.name FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [projectId, userId]
    ).catch(() => null);

    if (!memberResult || memberResult.rowCount === 0) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    const role = memberResult.rows[0].role;
    const userName = memberResult.rows[0].name;

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, { userId, userEmail, userName, projectId, fileId, role });
    });
  });

  wss.on('connection', async (ws: WebSocket, _req: any, ctx: {
    userId: string; userEmail: string; userName: string;
    projectId: string; fileId: string; role: string;
  }) => {
    const { userId, userEmail, userName, projectId, fileId, role } = ctx;
    logger.info('WS sync connection', { userId, fileId, role });

    const room = getOrCreateDoc(fileId);

    // Load from storage if first client
    if (room.clients.size === 0) {
      await loadDocFromStorage(fileId, room.doc);
      // Start snapshot timer
      room.snapshotTimer = setInterval(() => snapshotDoc(fileId, room.doc), config.snapshotIntervalMs);
    }

    const client: ConnectedClient = {
      ws, userId, userEmail, userName, projectId, fileId, role,
      awareness: room.awareness,
    };
    room.clients.add(client);

    // Send initial sync step 1
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, room.doc);
    ws.send(encoding.toUint8Array(encoder));

    // Send current awareness state
    const awarenessStates = room.awareness.getStates();
    if (awarenessStates.size > 0) {
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, messageAwareness);
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(room.awareness, Array.from(awarenessStates.keys()))
      );
      ws.send(encoding.toUint8Array(awarenessEncoder));
    }

    // Send chat history (last 50 messages)
    try {
      const chatResult = await query<{ id: string; user_id: string; name: string; message: string; created_at: string }>(
        `SELECT cm.id, cm.user_id, u.name, cm.message, cm.created_at
         FROM chat_messages cm JOIN users u ON u.id = cm.user_id
         WHERE cm.project_id = $1 ORDER BY cm.created_at ASC LIMIT 50`,
        [projectId]
      );
      const chatHistoryMsg = JSON.stringify({
        type: 'chat-history',
        messages: chatResult.rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          userName: r.name,
          message: r.message,
          timestamp: r.created_at,
        })),
      });
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chatHistoryMsg);
      }
    } catch (err) {
      logger.error('Chat history error', { error: err });
    }

    ws.on('message', async (rawData: Buffer) => {
      // Check if it's a JSON message (chat)
      try {
        const str = rawData.toString('utf-8');
        if (str.startsWith('{')) {
          const msg = JSON.parse(str);
          if (msg.type === 'chat') {
            if (typeof msg.message !== 'string' || !msg.message.trim()) return;
            const msgId = uuidv4();
            const timestamp = new Date().toISOString();
            await query(
              'INSERT INTO chat_messages (id, project_id, user_id, message) VALUES ($1, $2, $3, $4)',
              [msgId, projectId, userId, msg.message.trim()]
            );
            const broadcast = JSON.stringify({
              type: 'chat',
              id: msgId,
              userId,
              userName,
              message: msg.message.trim(),
              timestamp,
            });
            room.clients.forEach((c) => {
              if (c.ws.readyState === WebSocket.OPEN) c.ws.send(broadcast);
            });
          }
          return;
        }
      } catch {}

      // Binary Y.js messages
      const data = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData);
      const decoder = decoding.createDecoder(new Uint8Array(data));
      const msgType = decoding.readVarUint(decoder);

      if (msgType === messageSync) {
        // Viewers can receive sync but not send updates
        const syncEncoder = encoding.createEncoder();
        encoding.writeVarUint(syncEncoder, messageSync);
        const syncMessageType = syncProtocol.readSyncMessage(decoder, syncEncoder, room.doc, null);

        if (syncMessageType === syncProtocol.messageYjsSyncStep2 && role === 'viewer') {
          // Ignore updates from viewers
          return;
        }

        const reply = encoding.toUint8Array(syncEncoder);
        if (encoding.length(syncEncoder) > 1) {
          ws.send(reply);
        }

        // If this was a Y update (step2), broadcast to others
        if (syncMessageType === syncProtocol.messageYjsUpdate) {
          broadcastToRoom(fileId, data, ws);
        }
      } else if (msgType === messageAwareness) {
        const awarenessUpdate = decoding.readVarUint8Array(decoder);
        awarenessProtocol.applyAwarenessUpdate(room.awareness, awarenessUpdate, ws);
        // Broadcast to everyone including sender (for other files)
        const broadcastEncoder = encoding.createEncoder();
        encoding.writeVarUint(broadcastEncoder, messageAwareness);
        encoding.writeVarUint8Array(broadcastEncoder, awarenessUpdate);
        broadcastToRoom(fileId, Buffer.from(encoding.toUint8Array(broadcastEncoder)), ws);
      }
    });

    ws.on('close', async () => {
      logger.info('WS sync disconnect', { userId, fileId });
      room.clients.delete(client);

      // Remove from awareness
      awarenessProtocol.removeAwarenessStates(room.awareness, [room.doc.clientID], null);

      if (room.clients.size === 0) {
        // Last client disconnected — save snapshot and clean up
        if (room.snapshotTimer) clearInterval(room.snapshotTimer);
        await snapshotDoc(fileId, room.doc);
        room.doc.destroy();
        docs.delete(fileId);
        logger.info('Room cleaned up', { fileId });
      }
    });

    ws.on('error', (err) => {
      logger.error('WS sync error', { userId, fileId, error: err.message });
    });
  });

  logger.info('Sync WebSocket server ready');
}
