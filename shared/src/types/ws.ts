// Shared WebSocket message types for CollabIDE

export type UserRole = 'owner' | 'editor' | 'viewer';

export type Language = 'javascript' | 'typescript' | 'python' | 'go' | 'cpp' | 'java';

// ─── Sync WebSocket Messages (/ws/sync) ──────────────────────────────────────

export interface SyncJoinMessage {
  type: 'join';
  projectId: string;
  fileId: string;
}

export interface SyncAwarenessMessage {
  type: 'awareness';
  data: Uint8Array | number[];
}

export interface SyncUpdateMessage {
  type: 'sync-update';
  data: Uint8Array | number[];
}

export interface SyncStep1Message {
  type: 'sync-step1';
  data: Uint8Array | number[];
}

export interface SyncStep2Message {
  type: 'sync-step2';
  data: Uint8Array | number[];
}

export interface SyncErrorMessage {
  type: 'error';
  message: string;
}

export interface SyncChatMessage {
  type: 'chat';
  message: string;
  userId: string;
  userName: string;
  timestamp: string;
}

export interface SyncChatHistoryMessage {
  type: 'chat-history';
  messages: ChatMessagePayload[];
}

export interface ChatMessagePayload {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
}

export type SyncClientMessage =
  | SyncJoinMessage
  | SyncAwarenessMessage
  | SyncUpdateMessage
  | SyncStep1Message
  | SyncStep2Message
  | SyncChatMessage;

export type SyncServerMessage =
  | SyncUpdateMessage
  | SyncStep2Message
  | SyncAwarenessMessage
  | SyncErrorMessage
  | SyncChatMessage
  | SyncChatHistoryMessage;

// ─── Run WebSocket Messages (/ws/run) ─────────────────────────────────────────

export interface RunRequestMessage {
  type: 'run';
  fileId: string;
  projectId: string;
  content: string;
  language: Language;
}

export interface RunOutputMessage {
  type: 'output';
  data: string;
}

export interface RunDoneMessage {
  type: 'done';
  exitCode: number;
}

export interface RunErrorMessage {
  type: 'error';
  message: string;
}

export type RunClientMessage = RunRequestMessage;

export type RunServerMessage = RunOutputMessage | RunDoneMessage | RunErrorMessage;

// ─── REST API Types ───────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  role?: UserRole;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  name: string;
  content: string;
  language: Language;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

// ─── Presence ────────────────────────────────────────────────────────────────

export interface PresenceUser {
  userId: string;
  name: string;
  color: string;
  cursor?: {
    lineNumber: number;
    column: number;
  };
  selection?: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
}
