import { create } from 'zustand';
import { PresenceUser } from '@shared/types/ws';

interface PresenceState {
  users: Map<string, PresenceUser>;
  setUser: (userId: string, user: PresenceUser) => void;
  removeUser: (userId: string) => void;
  clearUsers: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  users: new Map(),
  setUser: (userId, user) =>
    set((s) => {
      const next = new Map(s.users);
      next.set(userId, user);
      return { users: next };
    }),
  removeUser: (userId) =>
    set((s) => {
      const next = new Map(s.users);
      next.delete(userId);
      return { users: next };
    }),
  clearUsers: () => set({ users: new Map() }),
}));
