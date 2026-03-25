import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';
import Dockerode from 'dockerode';
import { verifyAccessToken } from '../utils/jwt';
import { query } from '../db/pool';
import { config } from '../config';
import { logger } from '../utils/logger';
import { LANGUAGE_IMAGES, LANGUAGE_RUN_CMD, LANGUAGE_FILE_EXT } from '../utils/language';
// Language type (duplicated here to avoid bundler path issues)
type Language = 'javascript' | 'typescript' | 'python' | 'go' | 'cpp' | 'java';

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

interface RunSession {
  projectId: string;
  fileId: string;
  clients: Set<WebSocket>;
  stdinStream: NodeJS.WritableStream | null;
}

const sessions = new Map<string, RunSession>();

export function setupRunWs(server: http.Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (request, socket, head) => {
    const url = new URL(request.url!, `http://${request.headers.host}`);
    if (!url.pathname.startsWith('/ws/run')) return;

    const token = url.searchParams.get('token');
    const projectId = url.searchParams.get('projectId');

    if (!token || !projectId) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    let userId: string;
    try {
      const payload = verifyAccessToken(token);
      userId = payload.userId;
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // Check editor/owner access (viewers cannot run)
    const memberResult = await query<{ role: string }>(
      "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2",
      [projectId, userId]
    ).catch(() => null);

    if (!memberResult || memberResult.rowCount === 0) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    const role = memberResult.rows[0].role;
    if (role === 'viewer') {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, { userId, projectId, role });
    });
  });

  wss.on('connection', (ws: WebSocket, _req: any, ctx: { userId: string; projectId: string; role: string }) => {
    const { userId, projectId } = ctx;
    logger.info('WS run connection', { userId, projectId });

    let sessionKey = `${projectId}`;
    if (!sessions.has(sessionKey)) {
      sessions.set(sessionKey, { projectId, fileId: '', clients: new Set(), stdinStream: null });
    }
    sessions.get(sessionKey)!.clients.add(ws);

    ws.on('message', async (rawData: Buffer) => {
      try {
        const msg = JSON.parse(rawData.toString());

        // Relay stdin to running container
        if (msg.type === 'stdin') {
          const session = sessions.get(sessionKey);
          if (session?.stdinStream) {
            session.stdinStream.write(msg.data ?? '');
          }
          return;
        }

        if (msg.type !== 'run') return;

        const { fileId, content, language } = msg as {
          fileId: string; content: string; language: Language;
        };

        if (!language || !content) {
          ws.send(JSON.stringify({ type: 'error', message: 'Missing language or content' }));
          return;
        }

        const session = sessions.get(sessionKey);
        if (!session) return;
        session.fileId = fileId;

        const broadcastToSession = (data: object) => {
          const str = JSON.stringify(data);
          session.clients.forEach((c) => {
            if (c.readyState === WebSocket.OPEN) c.send(str);
          });
        };

        const image = LANGUAGE_IMAGES[language];
        const ext = LANGUAGE_FILE_EXT[language];
        const filename = `main.${ext}`;
        const cmd = LANGUAGE_RUN_CMD[language](filename);

        logger.info('Starting code execution', { language, image, userId });
        broadcastToSession({ type: 'output', data: `▶ Running ${language}...\r\n` });

        let container: Dockerode.Container | null = null;
        let timedOut = false;

        try {
          container = await docker.createContainer({
            Image: image,
            Cmd: cmd,
            WorkingDir: '/app',
            NetworkDisabled: true,
            OpenStdin: true,
            StdinOnce: false,
            HostConfig: {
              Memory: config.executionMemoryBytes,
              MemorySwap: config.executionMemoryBytes,
              CpuPeriod: 100000,
              CpuQuota: 50000,
              AutoRemove: false,
            },
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
          });

          // Attach stdin stream so we can pipe user input
          const attachStream = await container.attach({
            stream: true,
            stdin: true,
            stdout: false,
            stderr: false,
          });
          const session = sessions.get(sessionKey);
          if (session) session.stdinStream = attachStream;

          // Write file content
          const tar = await createTarBuffer(filename, content);
          await container.putArchive(tar, { path: '/app' });

          await container.start();

          // Attach output stream
          const logStream = await container.logs({
            follow: true,
            stdout: true,
            stderr: true,
          });

          // Parse docker stream (multiplexed)
          logStream.on('data', (chunk: Buffer) => {
            // Docker stream format: 8 bytes header + payload
            let offset = 0;
            while (offset < chunk.length) {
              if (chunk.length < offset + 8) break;
              const size = chunk.readUInt32BE(offset + 4);
              offset += 8;
              if (offset + size <= chunk.length) {
                const line = chunk.slice(offset, offset + size).toString('utf-8');
                broadcastToSession({ type: 'output', data: line });
                offset += size;
              } else break;
            }
          });

          // Timeout enforcement
          const timeout = setTimeout(async () => {
            timedOut = true;
            broadcastToSession({ type: 'output', data: '\r\n⏱ Execution timed out (10s)\r\n' });
            try { await container!.kill(); } catch {}
          }, config.executionTimeoutMs);

          const result = await container.wait();
          clearTimeout(timeout);

          const exitCode = timedOut ? 124 : result.StatusCode;
          broadcastToSession({ type: 'done', exitCode });
          logger.info('Execution complete', { language, exitCode });
        } catch (err: any) {
          logger.error('Execution error', { error: err.message });
          broadcastToSession({ type: 'error', message: err.message });
          broadcastToSession({ type: 'done', exitCode: 1 });
        } finally {
          // Clear stdin stream
          const sess = sessions.get(sessionKey);
          if (sess) sess.stdinStream = null;
          if (container) {
            try { await container.remove({ force: true }); } catch {}
          }
        }
      } catch (err) {
        logger.error('Run WS message error', { error: err });
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' }));
      }
    });

    ws.on('close', () => {
      const session = sessions.get(sessionKey);
      if (session) {
        session.clients.delete(ws);
        if (session.clients.size === 0) sessions.delete(sessionKey);
      }
    });

    ws.on('error', (err) => logger.error('WS run error', { error: err.message }));
  });

  logger.info('Run WebSocket server ready');
}

async function createTarBuffer(filename: string, content: string): Promise<Buffer> {
  const contentBuffer = Buffer.from(content, 'utf-8');
  // Simple TAR format
  const nameBuffer = Buffer.alloc(100, 0);
  Buffer.from(filename).copy(nameBuffer);

  const header = Buffer.alloc(512, 0);
  nameBuffer.copy(header, 0);
  // File permissions: 0644
  Buffer.from('0000644\0').copy(header, 100);
  // uid/gid
  Buffer.from('0000000\0').copy(header, 108);
  Buffer.from('0000000\0').copy(header, 116);
  // File size (octal)
  const sizeOctal = contentBuffer.length.toString(8).padStart(11, '0') + '\0';
  Buffer.from(sizeOctal).copy(header, 124);
  // Modification time
  const mtime = Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0';
  Buffer.from(mtime).copy(header, 136);
  // Type flag: regular file
  header[156] = 0x30; // '0'
  // Magic
  Buffer.from('ustar\0').copy(header, 257);
  Buffer.from('00').copy(header, 263);

  // Checksum
  let checksum = 0;
  for (let i = 0; i < 512; i++) {
    checksum += (i >= 148 && i < 156) ? 32 : header[i];
  }
  Buffer.from(checksum.toString(8).padStart(6, '0') + '\0 ').copy(header, 148);

  // Content padded to 512-byte blocks
  const paddedContentLength = Math.ceil(contentBuffer.length / 512) * 512;
  const contentPadded = Buffer.alloc(paddedContentLength, 0);
  contentBuffer.copy(contentPadded);

  // End-of-archive (two 512-byte zero blocks)
  const endOfArchive = Buffer.alloc(1024, 0);

  return Buffer.concat([header, contentPadded, endOfArchive]);
}
