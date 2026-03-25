import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { buildWsUrl } from '@/utils/helpers';

export interface TerminalMessage {
  type: 'output' | 'done' | 'error';
  data?: string;
  exitCode?: number;
  message?: string;
}

interface UseRunWsOptions {
  projectId: string;
  onMessage: (msg: TerminalMessage) => void;
}

export function useRunWs({ projectId, onMessage }: UseRunWsOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const { accessToken } = useAuthStore();
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (!accessToken) return;

    const url = buildWsUrl('/ws/run', { token: accessToken, projectId });
    const ws = new WebSocket(url);

    ws.onopen = () => setIsConnected(true);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as TerminalMessage;
        onMessageRef.current(msg);
        if (msg.type === 'done' || msg.type === 'error') {
          setIsRunning(false);
        }
      } catch {}
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsRunning(false);
      wsRef.current = null;
    };

    ws.onerror = () => {
      setIsConnected(false);
      setIsRunning(false);
    };

    wsRef.current = ws;
  }, [accessToken, projectId]);

  const run = useCallback(
    (payload: { fileId: string; content: string; language: string }) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connect();
        setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'run', ...payload }));
            setIsRunning(true);
          }
        }, 500);
        return;
      }
      wsRef.current.send(JSON.stringify({ type: 'run', ...payload }));
      setIsRunning(true);
    },
    [connect]
  );

  const sendInput = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stdin', data }));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => { wsRef.current?.close(); };
  }, [connect]);

  return { isConnected, isRunning, run, sendInput };
}
