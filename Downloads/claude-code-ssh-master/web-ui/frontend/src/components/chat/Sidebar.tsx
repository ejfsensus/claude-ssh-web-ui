import React, { useState } from 'react';
import {
  History,
  MessageSquarePlus,
  PenLine,
  Search,
  ShieldCheck,
  Trash2,
  Wrench,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiClient } from '@/lib/api/client';
import { useChatStore } from '@/lib/store/chatStore';
import type { AgentMode } from '@/lib/store/chatStore';
import { cn, formatDate } from '@/lib/utils';

const modeItems: Array<{ mode: AgentMode; label: string; icon: React.ElementType }> = [
  { mode: 'ask', label: 'Ask', icon: Search },
  { mode: 'plan', label: 'Plan', icon: PenLine },
  { mode: 'execute', label: 'Execute', icon: ShieldCheck },
];

export function Sidebar() {
  const {
    addActivity,
    addSession,
    currentSessionId,
    mode,
    processes,
    removeSession,
    sessions,
    setCurrentSessionId,
    setMessages,
    setMode,
    sidebarOpen,
  } = useChatStore();
  const [creating, setCreating] = useState(false);

  if (!sidebarOpen) return null;

  const createNewSession = async () => {
    setCreating(true);
    try {
      const response = await apiClient.createSession('New Chat');
      const session = {
        ...response.session,
        createdAt: new Date(response.session.createdAt),
        lastActiveAt: new Date(response.session.lastActiveAt),
      };
      addSession(session);
      setCurrentSessionId(session.id);
      setMessages([]);
      addActivity({ label: 'New chat session opened', tone: 'success' });
    } catch (error) {
      addActivity({
        label: error instanceof Error ? error.message : 'Session could not be created',
        tone: 'danger',
      });
    } finally {
      setCreating(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!window.confirm('Delete this chat session?')) return;

    try {
      await apiClient.deleteSession(sessionId);
      removeSession(sessionId);
      if (currentSessionId === sessionId) {
        setMessages([]);
      }
      addActivity({ label: 'Chat session deleted', tone: 'success' });
    } catch (error) {
      addActivity({
        label: error instanceof Error ? error.message : 'Session delete failed',
        tone: 'danger',
      });
    }
  };

  return (
    <aside className="studio-sidebar" aria-label="Chat history and tools">
      <section className="sidebar-section sidebar-section-top">
        <div className="section-heading">
          <div>
            <p>History</p>
            <h2>Chats</h2>
          </div>
          <button
            className="icon-button"
            onClick={createNewSession}
            disabled={creating}
            aria-label="New chat session"
            title="New chat"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
        </div>

        <ScrollArea className="session-scroll">
          <div className="session-list">
            {sessions.length === 0 ? (
              <button className="session-empty" onClick={createNewSession} disabled={creating}>
                <History className="h-4 w-4" />
                <span>Start a chat</span>
              </button>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    'session-row-wrap',
                    currentSessionId === session.id && 'session-row-active'
                  )}
                >
                  <button
                    onClick={() => setCurrentSessionId(session.id)}
                    className="session-row"
                  >
                    <History className="h-4 w-4" />
                    <span className="session-copy">
                      <strong>{session.title || 'New Chat'}</strong>
                      <small>
                        {formatDate(session.lastActiveAt)}
                        {typeof session.messageCount === 'number' ? ` · ${session.messageCount}` : ''}
                      </small>
                    </span>
                  </button>
                  <button
                    className="session-delete"
                    onClick={() => deleteSession(session.id)}
                    aria-label={`Delete ${session.title || 'chat session'}`}
                    title="Delete session"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </section>

      <section className="sidebar-section">
        <div className="section-heading section-heading-compact">
          <div>
            <p>Tools</p>
            <h2>Mode</h2>
          </div>
          <Wrench className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="tool-grid">
          {modeItems.map(({ mode: itemMode, label, icon: Icon }) => (
            <button
              key={itemMode}
              className={cn('tool-tile', mode === itemMode && 'tool-tile-active')}
              onClick={() => setMode(itemMode)}
              aria-pressed={mode === itemMode}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>

      {processes.length > 0 && (
        <section className="sidebar-section sidebar-processes">
          <div className="section-heading section-heading-compact">
            <div>
              <p>Runtime</p>
              <h2>Processes</h2>
            </div>
          </div>
          <div className="process-list">
            {processes.map((process) => (
              <div key={process.id} className="process-row">
                <span>{process.name}</span>
                <strong>{process.status}</strong>
              </div>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
