import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { buildWsUrl } from '@/utils/helpers';

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
}

interface UseChatOptions {
  projectId: string;
  fileId: string;
}

export function useChat({ projectId, fileId }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const { accessToken } = useAuthStore();

  const sendMessage = useCallback(
    (text: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN && text.trim()) {
        wsRef.current.send(JSON.stringify({ type: 'chat', message: text.trim() }));
      }
    },
    []
  );

  useEffect(() => {
    if (!accessToken || !projectId || !fileId) return;
    const url = buildWsUrl('/ws/sync', { token: accessToken, projectId, fileId });
    const ws = new WebSocket(url);

    ws.onmessage = (event) => {
      // Only handle text (JSON) messages for chat
      if (typeof event.data !== 'string') return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'chat-history') {
          setMessages(msg.messages);
        } else if (msg.type === 'chat') {
          setMessages((prev) => [
            ...prev,
            {
              id: msg.id,
              userId: msg.userId,
              userName: msg.userName,
              message: msg.message,
              timestamp: msg.timestamp,
            },
          ]);
        }
      } catch {}
    };

    wsRef.current = ws;
    return () => ws.close();
  }, [accessToken, projectId, fileId]);

  return { messages, sendMessage };
}
