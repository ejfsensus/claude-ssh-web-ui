import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: string[];
  createdAt: Date;
}

export interface Session {
  id: string;
  title: string;
  createdAt: Date;
  lastActiveAt: Date;
  messageCount?: number;
}

export interface Process {
  id: string;
  name: string;
  status: 'starting' | 'running' | 'completed' | 'failed' | 'stopped';
  output?: string;
  command?: string;
}

interface ChatState {
  // Current session
  currentSessionId: string | null;
  setCurrentSessionId: (sessionId: string | null) => void;

  // Messages
  messages: Message[];
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  appendToLastMessage: (content: string) => void;

  // Sessions
  sessions: Session[];
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  removeSession: (sessionId: string) => void;

  // Connection
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;

  // Processes
  processes: Process[];
  setProcesses: (processes: Process[]) => void;
  addProcess: (process: Process) => void;
  updateProcess: (processId: string, updates: Partial<Process>) => void;
  removeProcess: (processId: string) => void;

  // UI state
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // Current session
      currentSessionId: null,
      setCurrentSessionId: (sessionId) => set({ currentSessionId: sessionId }),

      // Messages
      messages: [],
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),
      clearMessages: () => set({ messages: [] }),
      appendToLastMessage: (content) =>
        set((state) => {
          const messages = [...state.messages];
          const lastMessage = messages[messages.length - 1];
          if (lastMessage) {
            lastMessage.content += content;
          }
          return { messages };
        }),

      // Sessions
      sessions: [],
      setSessions: (sessions) => set({ sessions }),
      addSession: (session) =>
        set((state) => ({
          sessions: [session, ...state.sessions],
        })),
      removeSession: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== sessionId),
          currentSessionId:
            state.currentSessionId === sessionId ? null : state.currentSessionId,
        })),

      // Connection
      isConnected: false,
      setIsConnected: (connected) => set({ isConnected: connected }),

      // Processes
      processes: [],
      setProcesses: (processes) => set({ processes }),
      addProcess: (process) =>
        set((state) => ({
          processes: [...state.processes, process],
        })),
      updateProcess: (processId, updates) =>
        set((state) => ({
          processes: state.processes.map((p) =>
            p.id === processId ? { ...p, ...updates } : p
          ),
        })),
      removeProcess: (processId) =>
        set((state) => ({
          processes: state.processes.filter((p) => p.id !== processId),
        })),

      // UI state
      sidebarOpen: true,
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'claude-ssh-chat-storage',
      partialize: (state) => ({
        currentSessionId: state.currentSessionId,
        sessions: state.sessions,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);
