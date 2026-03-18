import React, { useEffect, useRef, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { Awareness } from 'y-protocols/awareness';
import { useEditorStore } from '@/store/editorStore';
import { usePresenceStore } from '@/store/presenceStore';
import { useAuthStore } from '@/store/authStore';
import { useAutosave } from '@/hooks/useAutosave';
import { userColor } from '@/utils/helpers';

interface CollaborativeEditorProps {
  projectId: string;
  fileId: string;
  language: string;
  ydoc: Y.Doc | null;
  awareness: Awareness | null;
  role: string;
}

export default function CollaborativeEditor({
  projectId,
  fileId,
  language,
  ydoc,
  awareness,
  role,
}: CollaborativeEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const scheduleAutosaveRef = useRef<(() => void) | null>(null);
  const { user } = useAuthStore();
  const presenceUsers = usePresenceStore((s) => s.users);
  const isReadOnly = role === 'viewer';

  const getContent = useCallback(() => {
    return editorRef.current?.getValue() ?? '';
  }, []);

  const { scheduleAutosave } = useAutosave(projectId, fileId, getContent);
  scheduleAutosaveRef.current = scheduleAutosave;

  const monacoLanguageMap: Record<string, string> = {
    javascript: 'javascript',
    typescript: 'typescript',
    python: 'python',
    go: 'go',
    cpp: 'cpp',
    java: 'java',
  };

  const attachBinding = (
    editor: monaco.editor.IStandaloneCodeEditor,
    doc: Y.Doc,
    aw: Awareness
  ) => {
    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }

    const yText = doc.getText('content');
    const model = editor.getModel();
    if (!model) return;

    bindingRef.current = new MonacoBinding(yText, model, new Set([editor]), aw);

    yText.observe(() => {
      scheduleAutosaveRef.current?.();
    });
  };

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;

    if (ydoc && awareness) {
      attachBinding(editor, ydoc, awareness);
    }

    editor.onDidChangeCursorPosition((e) => {
      if (!awareness) return;
      awareness.setLocalStateField('cursor', {
        lineNumber: e.position.lineNumber,
        column: e.position.column,
      });
    });

    editor.onDidChangeCursorSelection((e) => {
      if (!awareness) return;
      const sel = e.selection;
      awareness.setLocalStateField('selection', {
        startLineNumber: sel.startLineNumber,
        startColumn: sel.startColumn,
        endLineNumber: sel.endLineNumber,
        endColumn: sel.endColumn,
      });
    });
  };

  useEffect(() => {
    if (editorRef.current && ydoc && awareness) {
      attachBinding(editorRef.current, ydoc, awareness);
    }
    return () => {
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
    };
  }, [ydoc, awareness]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !user) return;

    const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];

    presenceUsers.forEach((u) => {
      if (u.userId === user.id) return;
      const color = userColor(u.userId);
      const colorHex = color.replace('#', '');

      if (u.cursor) {
        newDecorations.push({
          range: new monaco.Range(u.cursor.lineNumber, u.cursor.column, u.cursor.lineNumber, u.cursor.column),
          options: {
            className: `remote-cursor-${colorHex}`,
            afterContentClassName: `remote-cursor-label-${colorHex}`,
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        });
      }

      if (u.selection) {
        const sel = u.selection;
        const isEmpty = sel.startLineNumber === sel.endLineNumber && sel.startColumn === sel.endColumn;
        if (!isEmpty) {
          newDecorations.push({
            range: new monaco.Range(sel.startLineNumber, sel.startColumn, sel.endLineNumber, sel.endColumn),
            options: {
              className: `remote-selection-${colorHex}`,
              stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            },
          });
        }
      }
    });

    presenceUsers.forEach((u) => {
      if (u.userId === user.id) return;
      const color = userColor(u.userId);
      const colorHex = color.replace('#', '');
      const styleId = `cursor-style-${colorHex}`;
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          .remote-cursor-${colorHex} { border-left: 2px solid ${color} !important; margin-left: -1px; }
          .remote-cursor-label-${colorHex}::after {
            content: '${u.name.replace(/'/g, "\\'")}';
            background: ${color}; color: white; font-size: 11px;
            font-family: Inter, sans-serif; padding: 1px 5px; border-radius: 3px;
            position: absolute; top: -18px; white-space: nowrap;
            pointer-events: none; z-index: 100;
          }
          .remote-selection-${colorHex} { background: ${color}33 !important; }
        `;
        document.head.appendChild(style);
      }
    });

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
  }, [presenceUsers, user]);

  const editorOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontLigatures: true,
    lineHeight: 20,
    minimap: { enabled: true, scale: 1 },
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    renderWhitespace: 'selection',
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: true, indentation: true },
    padding: { top: 16, bottom: 12 },
    readOnly: isReadOnly,
    wordWrap: 'off',
    overviewRulerLanes: 3,
    scrollbar: { vertical: 'auto', horizontal: 'auto', useShadows: false, verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
    suggest: { showIcons: true },
    quickSuggestions: { other: true, comments: true, strings: true },
    'semanticHighlighting.enabled': true,
    lineNumbers: 'on',
    glyphMargin: false,
    folding: true,
    links: true,
  };

  return (
    <div className="w-full h-full">
      <Editor
        height="100%"
        language={monacoLanguageMap[language] ?? 'javascript'}
        theme="vs-dark"
        options={editorOptions}
        onMount={handleMount}
        loading={
          <div className="flex items-center justify-center h-full bg-[#121316]">
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant animate-spin">refresh</span>
          </div>
        }
      />
    </div>
  );
}
