import React, { useState, useRef } from 'react';
import {
  FilePlus, Trash2, Edit3, Check, X, ChevronRight,
  FileCode, FileText, Loader2,
} from 'lucide-react';
import { useEditorStore, ProjectFile } from '@/store/editorStore';
import { filesApi } from '@/api/client';
import { toast } from 'react-hot-toast';
import { getLanguageColor, getLanguageIcon } from '@/utils/helpers';
import clsx from 'clsx';

interface FileTreeProps {
  projectId: string;
  role: string;
}

export default function FileTree({ projectId, role }: FileTreeProps) {
  const { files, activeFileId, setActiveFileId, addFile, removeFile, updateFile, reorderFiles } =
    useEditorStore();
  const [creating, setCreating] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragFileRef = useRef<ProjectFile | null>(null);

  const canEdit = role === 'editor' || role === 'owner';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    setLoadingId('new');
    try {
      const res = await filesApi.create(projectId, newFileName.trim());
      addFile(res.data.file);
      setActiveFileId(res.data.file.id);
      setNewFileName('');
      setCreating(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create file');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`Delete "${fileName}"?`)) return;
    setLoadingId(fileId);
    try {
      await filesApi.delete(projectId, fileId);
      removeFile(fileId);
    } catch {
      toast.error('Failed to delete file');
    } finally {
      setLoadingId(null);
    }
  };

  const handleRename = async (fileId: string) => {
    if (!editName.trim()) { setEditingId(null); return; }
    setLoadingId(fileId);
    try {
      await filesApi.update(projectId, fileId, { name: editName.trim() });
      updateFile(fileId, { name: editName.trim() });
      setEditingId(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to rename');
    } finally {
      setLoadingId(null);
    }
  };

  // Drag-to-reorder
  const handleDragStart = (file: ProjectFile) => {
    dragFileRef.current = file;
  };

  const handleDrop = async (targetFile: ProjectFile) => {
    const dragged = dragFileRef.current;
    if (!dragged || dragged.id === targetFile.id) { setDragOverId(null); return; }

    const newFiles = [...files];
    const fromIdx = newFiles.findIndex((f) => f.id === dragged.id);
    const toIdx = newFiles.findIndex((f) => f.id === targetFile.id);
    newFiles.splice(fromIdx, 1);
    newFiles.splice(toIdx, 0, dragged);

    const reordered = newFiles.map((f, i) => ({ ...f, position: i }));
    reorderFiles(reordered);
    setDragOverId(null);

    try {
      await filesApi.reorder(projectId, reordered.map((f) => ({ id: f.id, position: f.position })));
    } catch {
      toast.error('Failed to reorder files');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Files</span>
        {canEdit && (
          <button
            id="new-file-btn"
            onClick={() => { setCreating(true); setNewFileName(''); }}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title="New file"
          >
            <FilePlus size={14} />
          </button>
        )}
      </div>

      {/* New file input */}
      {creating && (
        <form
          onSubmit={handleCreate}
          className="flex items-center gap-1 px-2 py-1.5 border-b border-white/5 animate-fade-in"
        >
          <FileCode size={14} className="text-slate-500 flex-shrink-0" />
          <input
            autoFocus
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="filename.js"
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-slate-600 min-w-0"
            onKeyDown={(e) => { if (e.key === 'Escape') setCreating(false); }}
          />
          <button type="submit" disabled={loadingId === 'new'} className="text-green-400 hover:text-green-300">
            {loadingId === 'new' ? <Loader2 size={13} className="spinner" /> : <Check size={13} />}
          </button>
          <button type="button" onClick={() => setCreating(false)} className="text-slate-500 hover:text-red-400">
            <X size={13} />
          </button>
        </form>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {files.length === 0 && !creating && (
          <p className="text-center text-xs text-slate-600 py-8">No files yet</p>
        )}
        {files.map((file) => (
          <div
            key={file.id}
            draggable={canEdit}
            onDragStart={() => handleDragStart(file)}
            onDragOver={(e) => { e.preventDefault(); setDragOverId(file.id); }}
            onDragLeave={() => setDragOverId(null)}
            onDrop={() => handleDrop(file)}
            className={clsx(
              'file-tree-item group mx-1 rounded',
              activeFileId === file.id && 'file-tree-item-active',
              dragOverId === file.id && 'drop-indicator'
            )}
            onClick={() => setActiveFileId(file.id)}
          >
            {/* Language indicator dot */}
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: getLanguageColor(file.language) }}
            />

            {/* File name or rename input */}
            {editingId === file.id ? (
              <form
                onSubmit={(e) => { e.preventDefault(); handleRename(file.id); }}
                className="flex-1 flex items-center gap-1 min-w-0"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 bg-transparent text-white text-sm outline-none min-w-0"
                  onKeyDown={(e) => { if (e.key === 'Escape') setEditingId(null); }}
                />
                <button type="submit" className="text-green-400 hover:text-green-300">
                  {loadingId === file.id ? <Loader2 size={12} className="spinner" /> : <Check size={12} />}
                </button>
                <button type="button" onClick={() => setEditingId(null)} className="text-slate-500 hover:text-red-400">
                  <X size={12} />
                </button>
              </form>
            ) : (
              <span className="flex-1 truncate text-sm">{file.name}</span>
            )}

            {/* Actions (visible on hover) */}
            {canEdit && editingId !== file.id && (
              <div className="hidden group-hover:flex items-center gap-0.5 ml-auto" onClick={(e) => e.stopPropagation()}>
                <button
                  id={`rename-${file.id}`}
                  onClick={() => { setEditingId(file.id); setEditName(file.name); }}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/15 text-slate-500 hover:text-white transition-colors"
                  title="Rename"
                >
                  <Edit3 size={11} />
                </button>
                <button
                  id={`delete-${file.id}`}
                  onClick={() => handleDelete(file.id, file.name)}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  {loadingId === file.id ? <Loader2 size={11} className="spinner" /> : <Trash2 size={11} />}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
