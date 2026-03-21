import { useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import * as awarenessProtocol from 'y-protocols/awareness';
import { useAuthStore } from '@/store/authStore';
import { usePresenceStore } from '@/store/presenceStore';
import { userColor, buildWsUrl } from '@/utils/helpers';

interface UseYjsOptions {
  projectId: string;
  fileId: string;
  userName: string;
  userId: string;
  onReady?: (doc: Y.Doc, awareness: awarenessProtocol.Awareness) => void;
  onDisconnect?: () => void;
}

export function useYjs(options: UseYjsOptions) {
  const { projectId, fileId, userName, userId, onReady, onDisconnect } = options;
  const { accessToken } = useAuthStore();
  const { setUser, removeUser, clearUsers } = usePresenceStore();

  const onReadyRef = useRef(onReady);
  const onDisconnectRef = useRef(onDisconnect);
  onReadyRef.current = onReady;
  onDisconnectRef.current = onDisconnect;

  const color = userColor(userId);

  useEffect(() => {
    if (!accessToken || !projectId || !fileId) return;

    let mounted = true;

    const doc = new Y.Doc();
    const wsUrl = buildWsUrl('/ws/sync', { token: accessToken, projectId, fileId });

    const provider = new WebsocketProvider(wsUrl, `file-${fileId}`, doc, {
      connect: true,
      params: { token: accessToken, projectId, fileId },
    });

    const { awareness } = provider;

    awareness.setLocalStateField('user', { userId, name: userName, color });

    const onAwarenessChange = ({
      added, updated, removed,
    }: { added: number[]; updated: number[]; removed: number[] }) => {
      if (!mounted) return;
      const states = awareness.getStates();

      [...added, ...updated].forEach((clientId) => {
        const state = states.get(clientId);
        if (state?.user) {
          setUser(state.user.userId, {
            userId: state.user.userId,
            name: state.user.name,
            color: state.user.color,
            cursor: state.cursor,
            selection: state.selection,
          });
        }
      });

      removed.forEach(() => {
        states.forEach((state) => {
          if (!state?.user) removeUser(state?.user?.userId);
        });
      });
    };

    awareness.on('change', onAwarenessChange);

    provider.on('sync', (synced: boolean) => {
      if (synced && mounted) {
        onReadyRef.current?.(doc, awareness);
      }
    });

    if (provider.wsconnected) {
      onReadyRef.current?.(doc, awareness);
    }

    return () => {
      mounted = false;
      awareness.off('change', onAwarenessChange);
      provider.disconnect();
      provider.destroy();
      doc.destroy();
      clearUsers();
      onDisconnectRef.current?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, projectId, fileId]);
}
