import React, { useEffect } from 'react';
import { PlusIcon, FolderIcon, TerminalIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatStore } from '@/lib/store/chatStore';
import { formatDate } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';

export function Sidebar() {
  const { sessions, currentSessionId, setCurrentSessionId, sidebarOpen, processes } =
    useChatStore();

  useEffect(() => {
    // Load sessions on mount
    apiClient.listSessions().then((data) => {
      useChatStore.getState().setSessions(
        data.sessions.map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          lastActiveAt: new Date(s.lastActiveAt),
        }))
      );
    });
  }, []);

  if (!sidebarOpen) return null;

  return (
    <aside className="w-[280px] border-r border-border bg-secondary/30 flex flex-col">
      {/* Sessions Section */}
      <div className="p-4 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Sessions
        </h3>
        <div className="space-y-1">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => setCurrentSessionId(session.id)}
              className={`w-full px-3 py-2 rounded-lg text-left transition-colors ${
                currentSessionId === session.id
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">💬</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{session.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(session.lastActiveAt)}
                  </div>
                </div>
              </div>
            </button>
          ))}
          <button className="w-full px-3 py-2 rounded-lg text-left text-sm text-blue-500 hover:bg-muted transition-colors">
            <div className="flex items-center gap-2">
              <PlusIcon className="h-4 w-4" />
              <span>New Session</span>
            </div>
          </button>
        </div>
      </div>

      {/* Processes Section */}
      <div className="p-4 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Background Processes
        </h3>
        <div className="space-y-2">
          {processes.map((process) => (
            <div
              key={process.id}
              className="p-3 bg-background rounded-lg border border-border"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <TerminalIcon className="h-3 w-3" />
                  {process.name}
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    process.status === 'running'
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-red-500/10 text-red-500'
                  }`}
                >
                  {process.status}
                </span>
              </div>
              {process.output && (
                <div className="text-xs font-mono bg-muted p-2 rounded max-h-[80px] overflow-auto">
                  {process.output}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Files Section */}
      <div className="flex-1 p-4 overflow-hidden flex flex-col">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Workspace Files
        </h3>
        <ScrollArea className="flex-1">
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-3 py-2 rounded hover:bg-muted cursor-pointer">
              <span>📁</span>
              <span className="text-sm flex-1">backend/</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded hover:bg-muted cursor-pointer">
              <span>📁</span>
              <span className="text-sm flex-1">frontend/</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded hover:bg-muted cursor-pointer">
              <span>📄</span>
              <span className="text-sm flex-1">Dockerfile</span>
              <span className="text-xs text-muted-foreground">3.2 KB</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded hover:bg-muted cursor-pointer">
              <span>📄</span>
              <span className="text-sm flex-1">package.json</span>
              <span className="text-xs text-muted-foreground">1.1 KB</span>
            </div>
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
}
