import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { filesApi } from '@/api/client';

export function useAutosave(projectId: string, fileId: string | null, getContent: () => string) {
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');
  const getContentRef = useRef(getContent);
  getContentRef.current = getContent;
  const fileIdRef = useRef(fileId);
  fileIdRef.current = fileId;
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  const save = useCallback(async () => {
    const fid = fileIdRef.current;
    const pid = projectIdRef.current;
    if (!fid || !pid) return;

    const content = getContentRef.current();
    if (content === lastSavedRef.current) return;

    setSaveStatus('saving');
    try {
      await filesApi.update(pid, fid, { content });
      lastSavedRef.current = content;
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  }, [setSaveStatus]);

  const scheduleAutosave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(save, 1500);
  }, [save]);

  useEffect(() => {
    lastSavedRef.current = '';
  }, [fileId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      save();
    };
  }, [fileId, save]);

  return { scheduleAutosave, save };
}
