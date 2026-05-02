'use client';

import { useEffect, useRef } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useChatStore } from '@/lib/store/chatStore';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { Header } from '@/components/chat/Header';
import { Sidebar } from '@/components/chat/Sidebar';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { AssistantCore } from '@/components/chat/AssistantCore';
import { ContextDock } from '@/components/chat/ContextDock';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function HomePage() {
  const {
    addActivity,
    agentPhase,
    currentSessionId,
    isConnected,
    messages,
    setCurrentSessionId,
    setDockOpen,
    setMessages,
    setRuntimeStatus,
    setSessions,
    setSidebarOpen,
    setWorkspaceFiles,
  } = useChatStore();
  const { connect } = useWebSocket();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (window.innerWidth <= 880) {
      setSidebarOpen(false);
      setDockOpen(false);
    }
  }, [setDockOpen, setSidebarOpen]);

  useEffect(() => {
    let cancelled = false;

    const loadStudioContext = async () => {
      try {
        const [status, workspace, sessionData] = await Promise.all([
          apiClient.getStatus(),
          apiClient.listFiles(),
          apiClient.listSessions(),
        ]);

        if (cancelled) return;

        const sessions = (sessionData.sessions || []).map((session: any) => ({
          ...session,
          createdAt: new Date(session.createdAt),
          lastActiveAt: new Date(session.lastActiveAt),
        }));

        setRuntimeStatus(status);
        setWorkspaceFiles(workspace.files || []);
        setSessions(sessions);

        if (!useChatStore.getState().currentSessionId && sessions.length > 0) {
          setCurrentSessionId(sessions[0].id);
        }

        addActivity({ label: 'Studio context refreshed', tone: 'success' });
      } catch (error) {
        if (!cancelled) {
          addActivity({
            label: error instanceof Error ? error.message : 'Studio context failed to load',
            tone: 'danger',
          });
        }
      }
    };

    loadStudioContext();

    return () => {
      cancelled = true;
    };
  }, [addActivity, setCurrentSessionId, setRuntimeStatus, setSessions, setWorkspaceFiles]);

  useEffect(() => {
    let cancelled = false;

    if (!currentSessionId) {
      setMessages([]);
      return;
    }

    apiClient
      .getSessionMessages(currentSessionId)
      .then((data) => {
        if (cancelled) return;
        setMessages(
          (data.messages || []).map((message: any) => ({
            ...message,
            createdAt: new Date(message.createdAt),
          }))
        );
      })
      .catch((error) => {
        if (!cancelled) {
          addActivity({
            label: error instanceof Error ? error.message : 'Session messages failed to load',
            tone: 'danger',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [addActivity, currentSessionId, setMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const refreshContext = async () => {
    try {
      const [status, workspace] = await Promise.all([
        apiClient.getStatus(),
        apiClient.listFiles(),
      ]);
      setRuntimeStatus(status);
      setWorkspaceFiles(workspace.files || []);
      addActivity({ label: 'Workspace and status refreshed', tone: 'success' });
    } catch (error) {
      addActivity({
        label: error instanceof Error ? error.message : 'Refresh failed',
        tone: 'danger',
      });
    }
  };

  return (
    <div className="studio-shell">
      <Header />

      <div className="studio-body">
        <Sidebar />

        <main className="studio-main">
          <button className="refresh-button" onClick={refreshContext} aria-label="Refresh status and files">
            <RefreshCw className="h-4 w-4" />
          </button>

          <div className="assistant-stage">
            <AssistantCore phase={agentPhase} connected={isConnected} />
          </div>

          <section className="conversation-panel" aria-label="Conversation">
            <ScrollArea className="conversation-scroll">
              <div className="conversation-feed">
                {messages.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-mark">
                      <Activity className="h-5 w-5" />
                    </div>
                    <p>Personal agent space online.</p>
                    <h1>Ready for the next move.</h1>
                  </div>
                ) : (
                  messages.map((message) => (
                    <ChatMessage key={message.id} message={message} />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <ChatInput />
          </section>
        </main>

        <ContextDock />
      </div>
    </div>
  );
}
