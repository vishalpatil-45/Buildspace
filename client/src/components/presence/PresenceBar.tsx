import React from 'react';
import { usePresenceStore } from '@/store/presenceStore';
import { useAuthStore } from '@/store/authStore';
import { getInitials } from '@/utils/helpers';

export default function PresenceBar() {
  const users = usePresenceStore((s) => s.users);
  const { user } = useAuthStore();

  const allUsers = Array.from(users.values());
  const maxVisible = 5;
  const visible = allUsers.slice(0, maxVisible);
  const overflow = allUsers.length - maxVisible;

  return (
    <div className="flex items-center gap-1" title="Active collaborators">
      {visible.map((u) => (
        <div
          key={u.userId}
          className="presence-avatar"
          style={{ backgroundColor: u.color }}
          title={`${u.name}${u.userId === user?.id ? ' (you)' : ''}`}
        >
          {getInitials(u.name)}
          {u.userId === user?.id && (
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border border-dark-900" />
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="presence-avatar bg-white/10 text-slate-400 border-white/10 text-xs"
          title={`${overflow} more user${overflow > 1 ? 's' : ''}`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
