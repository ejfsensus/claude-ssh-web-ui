import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AgentMode = 'ask' | 'plan' | 'execute';
export type AgentPhase = 'idle' | 'listening' | 'thinking' | 'streaming' | 'approval' | 'error';

export interface AttachmentDescriptor {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType?: string | null;
  uploadedAt?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Array<AttachmentDescriptor | string>;
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

export interface WorkspaceFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt?: string;
  mimeType?: string | null;
}

export interface RuntimeStatus {
  status: 'ready' | 'degraded' | 'unknown';
  agent?: {
    name: string;
    available: boolean;
  };
  workspace?: {
    path: string;
    exists: boolean;
  };
  features?: Record<string, boolean>;
}

export interface ActivityItem {
  id: string;
  label: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  createdAt: Date;
}

interface PendingExecuteRequest {
  content: string;
  attachments: AttachmentDescriptor[];
  clientActionId: string;
}

interface ChatState {
  currentSessionId: string | null;
  setCurrentSessionId: (sessionId: string | null) => void;

  mode: AgentMode;
  setMode: (mode: AgentMode) => void;
  agentPhase: AgentPhase;
  setAgentPhase: (phase: AgentPhase) => void;

  messages: Message[];
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  appendToLastMessage: (content: string) => void;

  sessions: Session[];
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  removeSession: (sessionId: string) => void;

  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;

  runtimeStatus: RuntimeStatus | null;
  setRuntimeStatus: (status: RuntimeStatus | null) => void;

  workspaceFiles: WorkspaceFile[];
  setWorkspaceFiles: (files: WorkspaceFile[]) => void;
  selectedFile: WorkspaceFile | null;
  setSelectedFile: (file: WorkspaceFile | null) => void;

  attachments: AttachmentDescriptor[];
  addAttachment: (attachment: AttachmentDescriptor) => void;
  removeAttachment: (attachmentId: string) => void;
  clearAttachments: () => void;

  pendingExecute: PendingExecuteRequest | null;
  setPendingExecute: (request: PendingExecuteRequest | null) => void;

  activity: ActivityItem[];
  addActivity: (item: Omit<ActivityItem, 'id' | 'createdAt'>) => void;

  processes: Process[];
  setProcesses: (processes: Process[]) => void;
  addProcess: (process: Process) => void;
  updateProcess: (processId: string, updates: Partial<Process>) => void;
  removeProcess: (processId: string) => void;

  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  dockOpen: boolean;
  setDockOpen: (open: boolean) => void;
  toggleDock: () => void;
}

const reviveDate = (value: Date | string) => value instanceof Date ? value : new Date(value);

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      currentSessionId: null,
      setCurrentSessionId: (sessionId) => set({ currentSessionId: sessionId }),

      mode: 'ask',
      setMode: (mode) => set({ mode }),
      agentPhase: 'idle',
      setAgentPhase: (phase) => set({ agentPhase: phase }),

      messages: [],
      setMessages: (messages) =>
        set({
          messages: messages.map((message) => ({
            ...message,
            createdAt: reviveDate(message.createdAt),
          })),
        }),
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, { ...message, createdAt: reviveDate(message.createdAt) }],
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

      sessions: [],
      setSessions: (sessions) =>
        set({
          sessions: sessions.map((session) => ({
            ...session,
            createdAt: reviveDate(session.createdAt),
            lastActiveAt: reviveDate(session.lastActiveAt),
          })),
        }),
      addSession: (session) =>
        set((state) => ({
          sessions: [
            { ...session, createdAt: reviveDate(session.createdAt), lastActiveAt: reviveDate(session.lastActiveAt) },
            ...state.sessions.filter((item) => item.id !== session.id),
          ],
        })),
      removeSession: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== sessionId),
          currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
        })),

      isConnected: false,
      setIsConnected: (connected) => set({ isConnected: connected }),

      runtimeStatus: null,
      setRuntimeStatus: (status) => set({ runtimeStatus: status }),

      workspaceFiles: [],
      setWorkspaceFiles: (files) => set({ workspaceFiles: files }),
      selectedFile: null,
      setSelectedFile: (file) => set({ selectedFile: file }),

      attachments: [],
      addAttachment: (attachment) =>
        set((state) => ({
          attachments: [...state.attachments.filter((item) => item.id !== attachment.id), attachment],
        })),
      removeAttachment: (attachmentId) =>
        set((state) => ({
          attachments: state.attachments.filter((item) => item.id !== attachmentId),
        })),
      clearAttachments: () => set({ attachments: [] }),

      pendingExecute: null,
      setPendingExecute: (request) => set({ pendingExecute: request }),

      activity: [],
      addActivity: (item) =>
        set((state) => ({
          activity: [
            { ...item, id: crypto.randomUUID(), createdAt: new Date() },
            ...state.activity,
          ].slice(0, 8),
        })),

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

      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      dockOpen: true,
      setDockOpen: (open) => set({ dockOpen: open }),
      toggleDock: () => set((state) => ({ dockOpen: !state.dockOpen })),
    }),
    {
      name: 'claude-ssh-chat-storage',
      partialize: (state) => ({
        currentSessionId: state.currentSessionId,
        mode: state.mode,
        sessions: state.sessions,
        sidebarOpen: state.sidebarOpen,
        dockOpen: state.dockOpen,
      }),
    }
  )
);
