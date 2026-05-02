import React, { useState } from 'react';
import {
  Activity,
  ChevronRight,
  FileText,
  Folder,
  FolderUp,
  Headphones,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useChatStore } from '@/lib/store/chatStore';
import type { WorkspaceFile } from '@/lib/store/chatStore';
import { cn, formatDate } from '@/lib/utils';

const formatSize = (size: number) => {
  if (!size) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export function ContextDock() {
  const {
    addActivity,
    activity,
    dockOpen,
    runtimeStatus,
    selectedFile,
    setSelectedFile,
    setWorkspaceFiles,
    toggleDock,
    workspaceFiles,
  } = useChatStore();
  const [currentPath, setCurrentPath] = useState('');
  const [preview, setPreview] = useState<string>('');
  const [previewError, setPreviewError] = useState<string>('');

  const openFile = async (file: WorkspaceFile) => {
    setPreview('');
    setPreviewError('');

    if (file.type === 'directory') {
      try {
        const data = await apiClient.listFiles(file.path);
        setCurrentPath(data.path);
        setWorkspaceFiles(data.files);
        setSelectedFile(null);
      } catch (error) {
        addActivity({
          label: error instanceof Error ? error.message : 'Folder unavailable',
          tone: 'danger',
        });
      }
      return;
    }

    setSelectedFile(file);

    try {
      const data = await apiClient.previewFile(file.path);
      setPreview(data.file.content);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Preview unavailable');
    }
  };

  const openParent = async () => {
    try {
      const parent = currentPath.split('/').slice(0, -1).join('/');
      const data = await apiClient.listFiles(parent);
      setCurrentPath(data.path);
      setWorkspaceFiles(data.files);
      setSelectedFile(null);
      setPreview('');
      setPreviewError('');
    } catch (error) {
      addActivity({
        label: error instanceof Error ? error.message : 'Parent folder unavailable',
        tone: 'danger',
      });
    }
  };

  const reloadFiles = async () => {
    try {
      const data = await apiClient.listFiles(currentPath);
      setWorkspaceFiles(data.files);
      addActivity({ label: 'File list refreshed', tone: 'success' });
    } catch (error) {
      addActivity({
        label: error instanceof Error ? error.message : 'File refresh failed',
        tone: 'danger',
      });
    }
  };

  if (!dockOpen) {
    return (
      <button className="dock-tab" onClick={toggleDock} aria-label="Open context dock">
        <PanelRightOpen className="h-5 w-5" />
      </button>
    );
  }

  return (
    <aside className="context-dock" aria-label="Agent context dock">
      <div className="dock-heading">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Context</p>
          <h2>Agent Space</h2>
        </div>
        <button className="icon-button" onClick={toggleDock} aria-label="Close context dock">
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      <section className="glass-panel compact-panel">
        <div className="panel-title">
          <ShieldCheck className="h-4 w-4" />
          System
        </div>
        <div className="system-grid">
          <span>Claude</span>
          <strong>{runtimeStatus?.agent?.available ? 'Available' : 'Checking'}</strong>
          <span>Workspace</span>
          <strong>{runtimeStatus?.workspace?.exists ? 'Mounted' : 'Unknown'}</strong>
          <span>Safety</span>
          <strong>Confirm execute</strong>
        </div>
      </section>

      <section className="glass-panel compact-panel">
        <div className="panel-title">
          <UploadCloud className="h-4 w-4" />
          Documents & Files
        </div>
        <div className="file-toolbar">
          <span>{currentPath || 'workspace'}</span>
          <div className="flex items-center gap-1">
            <button
              className="mini-icon-button"
              onClick={openParent}
              disabled={!currentPath}
              aria-label="Open parent folder"
              title="Parent folder"
            >
              <FolderUp className="h-3.5 w-3.5" />
            </button>
            <button
              className="mini-icon-button"
              onClick={reloadFiles}
              aria-label="Refresh files"
              title="Refresh files"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="file-list">
          {workspaceFiles.length === 0 ? (
            <p className="panel-empty">No workspace files visible yet.</p>
          ) : (
            workspaceFiles.slice(0, 8).map((file) => {
              const Icon = file.type === 'directory' ? Folder : FileText;
              return (
                <button
                  key={file.path || file.name}
                  className={cn('file-row', selectedFile?.path === file.path && 'file-row-active')}
                  onClick={() => openFile(file)}
                >
                  <Icon className="h-4 w-4" />
                  <span className="min-w-0 flex-1 truncate text-left">{file.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {file.type === 'directory' ? 'Folder' : formatSize(file.size)}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              );
            })
          )}
        </div>
        {selectedFile && selectedFile.type === 'file' && (
          <div className="file-preview">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="truncate text-xs font-medium">{selectedFile.name}</span>
              <span className="text-[11px] text-muted-foreground">{formatSize(selectedFile.size)}</span>
            </div>
            {previewError ? (
              <p className="text-xs text-amber-200">{previewError}</p>
            ) : (
              <pre>{preview || 'Loading preview...'}</pre>
            )}
          </div>
        )}
      </section>

      <section className="glass-panel compact-panel">
        <div className="panel-title">
          <Headphones className="h-4 w-4" />
          Voice & Settings
        </div>
        <div className="system-grid">
          <span>Voice</span>
          <strong>Unavailable</strong>
          <span>Motion</span>
          <strong>Adaptive</strong>
        </div>
      </section>

      <section className="glass-panel compact-panel">
        <div className="panel-title">
          <Activity className="h-4 w-4" />
          Agent Activity
        </div>
        <div className="activity-list">
          {activity.length === 0 ? (
            <p className="panel-empty">Activity appears here as the agent works.</p>
          ) : (
            activity.map((item) => (
              <div key={item.id} className={cn('activity-row', `activity-${item.tone}`)}>
                <span />
                <div>
                  <p>{item.label}</p>
                  <time>{formatDate(item.createdAt)}</time>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </aside>
  );
}
