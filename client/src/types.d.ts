// Type declarations for packages without built-in types

declare module 'y-websocket' {
  import * as Y from 'yjs';
  import { Awareness } from 'y-protocols/awareness';

  export class WebsocketProvider {
    doc: Y.Doc;
    awareness: Awareness;
    connected: boolean;

    constructor(
      serverUrl: string,
      roomname: string,
      doc: Y.Doc,
      options?: {
        connect?: boolean;
        awareness?: Awareness;
        params?: Record<string, string>;
        WebSocketPolyfill?: typeof WebSocket;
        resyncInterval?: number;
        maxBackoffTime?: number;
        disableBc?: boolean;
      }
    );

    connect(): void;
    disconnect(): void;
    destroy(): void;
    on(event: string, cb: (...args: any[]) => void): void;
    off(event: string, cb: (...args: any[]) => void): void;
  }
}

declare module 'y-monaco' {
  import * as Y from 'yjs';
  import * as monaco from 'monaco-editor';
  import { Awareness } from 'y-protocols/awareness';

  export class MonacoBinding {
    constructor(
      yText: Y.Text,
      monacoModel: monaco.editor.ITextModel,
      editors: Set<monaco.editor.IStandaloneCodeEditor>,
      awareness?: Awareness | null
    );
    destroy(): void;
  }
}
