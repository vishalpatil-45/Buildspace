import React, { useState, useRef, useEffect } from 'react';
import { Send, X, MessageSquare } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { ChatMessage } from '@/hooks/useChat';
import { formatTime, getInitials, userColor } from '@/utils/helpers';
import clsx from 'clsx';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onClose: () => void;
}

export default function ChatPanel({ messages, onSend, onClose }: ChatPanelProps) {
  const { user } = useAuthStore();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full border-l border-white/5 bg-dark-900/80 backdrop-blur-sm animate-slide-in-left w-72">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <MessageSquare size={15} className="text-brand-400" />
          <span className="text-sm font-semibold text-white">Project Chat</span>
          {messages.length > 0 && (
            <span className="text-xs text-slate-500">({messages.length})</span>
          )}
        </div>
        <button
          id="close-chat-btn"
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-xs text-slate-600 py-8">
            No messages yet. Say hi! 👋
          </div>
        )}
        {messages.map((msg, i) => {
          const isOwn = msg.userId === user?.id;
          const color = userColor(msg.userId);
          const prevMsg = i > 0 ? messages[i - 1] : null;
          const showName = !prevMsg || prevMsg.userId !== msg.userId;

          return (
            <div
              key={msg.id}
              className={clsx('flex gap-2', isOwn && 'flex-row-reverse')}
            >
              {/* Avatar */}
              {showName && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: color }}
                  title={msg.userName}
                >
                  {getInitials(msg.userName)}
                </div>
              )}
              {!showName && <div className="w-7 flex-shrink-0" />}

              <div className={clsx('flex flex-col gap-0.5 max-w-[75%]', isOwn && 'items-end')}>
                {showName && (
                  <span className="text-xs text-slate-500">
                    {isOwn ? 'You' : msg.userName} · {formatTime(msg.timestamp)}
                  </span>
                )}
                <div
                  className={clsx(
                    'px-3 py-1.5 rounded-xl text-sm leading-relaxed break-words',
                    isOwn
                      ? 'bg-brand-600 text-white rounded-tr-sm'
                      : 'bg-white/8 text-slate-200 rounded-tl-sm'
                  )}
                >
                  {msg.message}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 px-3 py-3 border-t border-white/5"
      >
        <input
          id="chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
        />
        <button
          id="chat-send-btn"
          type="submit"
          disabled={!input.trim()}
          className="w-8 h-8 flex items-center justify-center bg-brand-600 hover:bg-brand-500 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
