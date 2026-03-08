import { create } from 'zustand';

export interface ProjectFile {
  id: string;
  projectId: string;
  name: string;
  content: string;
  language: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  ownerId: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface EditorState {
  currentProject: Project | null;
  files: ProjectFile[];
  activeFileId: string | null;
  saveStatus: SaveStatus;
  isTerminalOpen: boolean;
  isChatOpen: boolean;
  theme: 'dark' | 'light';

  setCurrentProject: (project: Project | null) => void;
  setFiles: (files: ProjectFile[]) => void;
  addFile: (file: ProjectFile) => void;
  updateFile: (id: string, updates: Partial<ProjectFile>) => void;
  removeFile: (id: string) => void;
  setActiveFileId: (id: string | null) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setTerminalOpen: (open: boolean) => void;
  setChatOpen: (open: boolean) => void;
  toggleTheme: () => void;
  reorderFiles: (files: ProjectFile[]) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  currentProject: null,
  files: [],
  activeFileId: null,
  saveStatus: 'idle',
  isTerminalOpen: true,
  isChatOpen: false,
  theme: 'dark',

  setCurrentProject: (project) => set({ currentProject: project }),
  setFiles: (files) => set({ files }),
  addFile: (file) => set((s) => ({ files: [...s.files, file].sort((a, b) => a.position - b.position) })),
  updateFile: (id, updates) =>
    set((s) => ({ files: s.files.map((f) => (f.id === id ? { ...f, ...updates } : f)) })),
  removeFile: (id) =>
    set((s) => ({
      files: s.files.filter((f) => f.id !== id),
      activeFileId: s.activeFileId === id ? (s.files.find((f) => f.id !== id)?.id ?? null) : s.activeFileId,
    })),
  setActiveFileId: (id) => set({ activeFileId: id }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  setTerminalOpen: (open) => set({ isTerminalOpen: open }),
  setChatOpen: (open) => set({ isChatOpen: open }),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  reorderFiles: (files) => set({ files }),
}));
