import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { projectsApi, filesApi } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { useEditorStore, SaveStatus } from '@/store/editorStore';
import { useYjs } from '@/hooks/useYjs';
import { useRunWs, TerminalMessage } from '@/hooks/useRunWs';
import { useChat } from '@/hooks/useChat';
import FileTree from '@/components/filetree/FileTree';
import CollaborativeEditor from '@/components/editor/CollaborativeEditor';
import TerminalPanel from '@/components/terminal/TerminalPanel';
import PresenceBar from '@/components/presence/PresenceBar';
import ChatPanel from '@/components/chat/ChatPanel';
import ShareModal from '@/components/modals/ShareModal';
import { getLanguageIcon } from '@/utils/helpers';
import clsx from 'clsx';

const LANG_ICON: Record<string, string> = {
  typescript: 'javascript',
  javascript: 'javascript',
  python: 'description',
  go: 'description',
  cpp: 'description',
  java: 'description',
};

const LANG_COLOR: Record<string, string> = {
  typescript: 'text-primary',
  javascript: 'text-tertiary',
  python: 'text-secondary',
  go: 'text-primary',
  cpp: 'text-tertiary',
  java: 'text-error',
};

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const {
    currentProject, files, activeFileId, saveStatus, isTerminalOpen,
    isChatOpen,
    setCurrentProject, setFiles, setActiveFileId, setTerminalOpen, setChatOpen,
  } = useEditorStore();

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>('viewer');
  const [showShareModal, setShowShareModal] = useState(false);
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [awareness, setAwareness] = useState<Awareness | null>(null);
  const [terminalMessages, setTerminalMessages] = useState<TerminalMessage[]>([]);
  const [terminalHeight, setTerminalHeight] = useState(220);
  const [activeTab, setActiveTab] = useState<'explorer' | 'chat' | 'collab'>('explorer');
  const resizingRef = useRef(false);
  const lastYRef = useRef(0);

  const activeFile = files.find((f) => f.id === activeFileId) ?? null;

  // Load project + files
  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    Promise.all([projectsApi.get(projectId), filesApi.list(projectId)])
      .then(([projRes, filesRes]) => {
        setCurrentProject(projRes.data.project);
        setRole(projRes.data.project.role);
        const sorted = (filesRes.data.files ?? []).sort(
          (a: any, b: any) => a.position - b.position
        );
        setFiles(sorted);
        if (sorted.length > 0 && !activeFileId) {
          setActiveFileId(sorted[0].id);
        }
      })
      .catch(() => { toast.error('Failed to load project'); navigate('/'); })
      .finally(() => setLoading(false));
  }, [projectId]);

  // Yjs connection
  useYjs({
    projectId: projectId!,
    fileId: activeFileId ?? '',
    userName: user?.name ?? 'Anonymous',
    userId: user?.id ?? '',
    onReady: (doc, aw) => { setYdoc(doc); setAwareness(aw); },
    onDisconnect: () => { setYdoc(null); setAwareness(null); },
  });

  useEffect(() => {
    setYdoc(null);
    setAwareness(null);
  }, [activeFileId]);

  // Run WebSocket (with stdin support)
  const { isRunning, run, sendInput } = useRunWs({
    projectId: projectId!,
    onMessage: (msg) => setTerminalMessages((prev) => [...prev, msg]),
  });

  // Chat
  const { messages: chatMessages, sendMessage } = useChat({
    projectId: projectId!,
    fileId: activeFileId ?? '',
  });

  const handleRun = useCallback(() => {
    if (!activeFile || isRunning) return;
    const content = ydoc?.getText('content').toString() ?? activeFile.content ?? '';
    setTerminalOpen(true);
    setTerminalMessages((prev) => [
      ...prev,
      { type: 'output', data: `\r\n\x1b[90m── Running ${activeFile.name} ──\x1b[0m\r\n` },
    ]);
    run({ fileId: activeFile.id, content, language: activeFile.language });
  }, [activeFile, isRunning, ydoc, run, setTerminalOpen]);

  // Panel resize
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    lastYRef.current = e.clientY;
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = lastYRef.current - ev.clientY;
      lastYRef.current = ev.clientY;
      setTerminalHeight((h) => Math.max(80, Math.min(600, h + delta)));
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const canRun = (role === 'editor' || role === 'owner') && activeFile;
  const canEdit = role === 'editor' || role === 'owner';

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-sm text-outline">
          <span className="material-symbols-outlined text-[32px] animate-spin text-primary">refresh</span>
          <span className="label-caps">Loading project…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-on-surface">
      {/* ── Top Nav Bar ── */}
      <header className="flex justify-between items-center w-full px-md h-8 z-40 bg-surface border-b border-outline-variant flex-shrink-0">
        <div className="flex items-center gap-md">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-xs text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="font-headline text-[16px] font-black text-on-surface">Nexus Code</span>
          </button>
          <nav className="hidden md:flex gap-xs">
            {['File', 'Edit', 'Selection', 'View', 'Go', 'Debug'].map((item) => (
              <span key={item} className="label-caps text-on-surface-variant hover:bg-surface-variant hover:text-on-surface px-2 py-1 cursor-pointer transition-colors">
                {item}
              </span>
            ))}
          </nav>
        </div>

        {/* Search bar */}
        <div className="flex-1 flex justify-center max-w-xs px-md">
          <div className="w-full bg-surface-container-high rounded h-6 flex items-center px-sm text-outline border border-outline-variant gap-xs">
            <span className="material-symbols-outlined text-[14px]">search</span>
            <span className="label-caps lowercase text-[11px]">
              {currentProject?.name ?? 'Search files…'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-sm">
          {/* Save status */}
          {saveStatus === 'saving' && (
            <span className="saving-indicator flex items-center gap-xs label-caps text-outline">
              <span className="material-symbols-outlined text-[12px]">save</span>Saving…
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-xs label-caps text-secondary">
              <span className="material-symbols-outlined text-[12px]">check_circle</span>Saved
            </span>
          )}

          {/* Presence */}
          <PresenceBar />

          <div className="w-px h-4 bg-outline-variant" />

          {/* Run */}
          {canRun && (
            <button
              id="run-code-btn"
              onClick={handleRun}
              disabled={isRunning}
              className={clsx(
                'flex items-center gap-xs label-caps px-sm h-6 rounded transition-all',
                isRunning
                  ? 'bg-surface-variant text-outline cursor-not-allowed'
                  : 'bg-surface-variant border border-outline-variant text-on-surface hover:border-primary'
              )}
            >
              <span className="material-symbols-outlined text-[14px]">
                {isRunning ? 'stop_circle' : 'play_arrow'}
              </span>
              {isRunning ? 'Running…' : 'Run'}
            </button>
          )}

          {/* Share */}
          {role === 'owner' && (
            <button
              id="share-btn"
              onClick={() => setShowShareModal(true)}
              className="btn-primary"
            >
              Share
            </button>
          )}

          <span className="material-symbols-outlined text-on-surface-variant hover:text-on-surface cursor-pointer">notifications</span>
          <span className="material-symbols-outlined text-on-surface-variant hover:text-on-surface cursor-pointer">settings</span>
          <div className="w-5 h-5 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-[10px] font-bold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Activity Bar (left icons) ── */}
        <aside className="w-16 flex flex-col justify-between items-center py-md bg-surface-container border-r border-outline-variant flex-shrink-0">
          <div className="flex flex-col items-center gap-xs w-full">
            <div className="w-10 h-10 flex items-center justify-center mb-sm">
              <span className="material-symbols-outlined text-primary text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>terminal</span>
            </div>
            {[
              { icon: 'folder_open', tab: 'explorer' as const },
              { icon: 'search', tab: null },
              { icon: 'grid_view', tab: null },
              { icon: 'extension', tab: null },
              { icon: 'group', tab: 'collab' as const },
            ].map(({ icon, tab }) => (
              <div
                key={icon}
                className={clsx(
                  'w-full flex justify-center py-2 cursor-pointer transition-colors relative',
                  tab && activeTab === tab
                    ? 'border-l-2 border-primary text-primary bg-surface-variant'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant'
                )}
                onClick={() => {
                  if (tab) setActiveTab(tab === activeTab ? 'explorer' : tab);
                }}
              >
                <span className="material-symbols-outlined">{icon}</span>
                {icon === 'group' && chatMessages.length > 0 && (
                  <span className="badge" />
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center w-full gap-xs">
            <div className="sidebar-item" onClick={() => navigate('/')}>
              <span className="material-symbols-outlined">home</span>
            </div>
            <div className="sidebar-item">
              <span className="material-symbols-outlined">account_circle</span>
            </div>
          </div>
        </aside>

        {/* ── File Explorer Panel ── */}
        <section className="w-64 bg-surface-container-low border-r border-outline-variant flex flex-col flex-shrink-0">
          <div className="px-md py-sm flex justify-between items-center border-b border-outline-variant">
            <span className="label-caps text-on-surface opacity-60">Explorer</span>
            <span className="material-symbols-outlined text-[16px] text-outline cursor-pointer">more_horiz</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <FileTree projectId={projectId!} role={role} />
          </div>
        </section>

        {/* ── Main Editor Area ── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-background">
          {/* Tab Bar */}
          <div className="h-9 flex items-center bg-surface-container border-b border-outline-variant overflow-x-auto scrollbar-none flex-shrink-0">
            {files.map((file) => (
              <button
                key={file.id}
                id={`tab-${file.id}`}
                onClick={() => setActiveFileId(file.id)}
                className={clsx('tab', file.id === activeFileId && 'tab-active')}
              >
                <span className={clsx('material-symbols-outlined text-[14px]', LANG_COLOR[file.language] ?? 'text-on-surface')}>
                  {LANG_ICON[file.language] ?? 'description'}
                </span>
                <span className="truncate max-w-[120px] text-[13px]">{file.name}</span>
                <span className="material-symbols-outlined text-[12px] text-outline hover:text-on-surface">close</span>
              </button>
            ))}
          </div>

          {/* Breadcrumbs */}
          {activeFile && (
            <div className="h-6 flex items-center px-md gap-xs bg-background border-b border-outline-variant font-code text-[12px] text-outline flex-shrink-0">
              <span>{currentProject?.name}</span>
              <span className="material-symbols-outlined text-[12px]">chevron_right</span>
              <span className="text-on-surface">{activeFile.name}</span>
              <div className="flex-1" />
              <span className={clsx('label-caps', LANG_COLOR[activeFile.language] ?? 'text-outline')}>
                {activeFile.language}
              </span>
            </div>
          )}

          {/* Editor + Terminal */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeFile ? (
              <>
                <div className="flex-1 relative overflow-hidden">
                  <CollaborativeEditor
                    projectId={projectId!}
                    fileId={activeFile.id}
                    language={activeFile.language}
                    ydoc={ydoc}
                    awareness={awareness}
                    role={role}
                  />
                </div>

                {/* Terminal */}
                {isTerminalOpen && (
                  <>
                    <div
                      className="resize-handle"
                      onMouseDown={handleResizeStart}
                    />
                    <div
                      className="flex-shrink-0 overflow-hidden border-t border-outline-variant"
                      style={{ height: terminalHeight }}
                    >
                      <TerminalPanel
                        externalMessages={terminalMessages}
                        height={terminalHeight}
                        onInput={sendInput}
                      />
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-background">
                <div className="text-center">
                  <span className="material-symbols-outlined text-[48px] text-outline block mb-md" style={{ fontVariationSettings: "'FILL' 0" }}>
                    code
                  </span>
                  <h3 className="text-headline-md text-on-surface mb-xs">No file open</h3>
                  <p className="text-on-surface-variant text-[13px]">
                    {files.length === 0
                      ? 'Create a file in the explorer to get started'
                      : 'Select a file from the explorer'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ── Chat Panel ── */}
        {isChatOpen && (
          <ChatPanel
            messages={chatMessages}
            onSend={sendMessage}
            onClose={() => setChatOpen(false)}
          />
        )}
      </div>

      {/* ── Status Bar ── */}
      <footer className="flex items-center justify-between px-md h-6 bg-primary border-t border-outline-variant flex-shrink-0 z-50">
        <div className="flex items-center gap-md h-full">
          <div className="status-item">
            <span className="material-symbols-outlined text-[14px]">call_split</span>
            <span>Branch: main</span>
          </div>
          <div className="status-item">
            <span className="material-symbols-outlined text-[14px]">error</span>
            <span>0</span>
            <span className="material-symbols-outlined text-[14px]">warning</span>
            <span>0</span>
          </div>
        </div>
        <div className="flex items-center gap-md h-full">
          {activeFile && (
            <div className="status-item">
              {activeFile.language.charAt(0).toUpperCase() + activeFile.language.slice(1)}
            </div>
          )}
          <div className="status-item">Prettier</div>
          {/* Terminal toggle in status bar */}
          <div
            className={clsx(
              'status-item gap-xs',
              isTerminalOpen && 'bg-primary-container text-on-primary-container'
            )}
            onClick={() => setTerminalOpen(!isTerminalOpen)}
          >
            <span className="material-symbols-outlined text-[14px]">terminal</span>
            <span>Terminal</span>
          </div>
          {/* Chat toggle in status bar */}
          <div
            className={clsx(
              'status-item gap-xs',
              isChatOpen && 'bg-primary-container text-on-primary-container'
            )}
            onClick={() => setChatOpen(!isChatOpen)}
          >
            <span className="material-symbols-outlined text-[14px]">chat</span>
          </div>
          <div className="status-item gap-xs">
            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>wifi</span>
            <span>Connected</span>
          </div>
        </div>
      </footer>

      {showShareModal && currentProject && (
        <ShareModal
          projectId={projectId!}
          projectName={currentProject.name}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
