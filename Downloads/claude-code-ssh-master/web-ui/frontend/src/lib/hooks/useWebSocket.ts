import { useCallback, useEffect } from 'react';
import { useChatStore } from '@/lib/store/chatStore';
import type { AgentMode, AttachmentDescriptor } from '@/lib/store/chatStore';
import { apiClient } from '@/lib/api/client';

let sharedSocket: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
let isConnecting = false;

const clearReconnect = () => {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = undefined;
  }
};

const clearHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = undefined;
  }
};

export function useWebSocket() {
  const setIsConnected = useChatStore((state) => state.setIsConnected);
  const isConnected = useChatStore((state) => state.isConnected);

  const connect = useCallback(() => {
    if (
      sharedSocket?.readyState === WebSocket.OPEN ||
      sharedSocket?.readyState === WebSocket.CONNECTING ||
      isConnecting
    ) {
      return;
    }

    try {
      isConnecting = true;
      const ws = apiClient.connectWebSocket();
      sharedSocket = ws;

      ws.onopen = () => {
        const store = useChatStore.getState();
        isConnecting = false;
        setIsConnected(true);
        store.setAgentPhase('idle');
        store.addActivity({ label: 'Agent channel connected', tone: 'success' });
        store.addConsoleEvent({ kind: 'websocket', level: 'success', label: 'Agent channel connected' });
        clearReconnect();

        if (!heartbeatInterval) {
          heartbeatInterval = setInterval(() => {
            if (sharedSocket?.readyState === WebSocket.OPEN) {
              sharedSocket.send(JSON.stringify({ type: 'ping' }));
            }
          }, 30000);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const store = useChatStore.getState();

          switch (data.type) {
            case 'connected':
              store.addConsoleEvent({
                kind: 'websocket',
                level: 'info',
                label: 'Backend accepted WebSocket',
                metadata: { connectionId: data.connectionId },
              });
              break;

            case 'session_created':
              store.setCurrentSessionId(data.sessionId);
              store.addSession({
                id: data.sessionId,
                title: 'New Chat',
                createdAt: new Date(),
                lastActiveAt: new Date(),
              });
              store.addConsoleEvent({
                kind: 'session',
                level: 'info',
                label: 'Session created',
                metadata: { sessionId: data.sessionId },
              });
              break;

            case 'thinking':
              store.setAgentPhase('thinking');
              store.addActivity({ label: 'Claude Code is reading the request', tone: 'neutral' });
              store.addConsoleEvent({ kind: 'agent', level: 'info', label: 'Claude Code thinking' });
              break;

            case 'token':
              store.setAgentPhase('streaming');
              store.appendToLastMessage(data.content);
              break;

            case 'needs_approval':
              store.setAgentPhase('approval');
              store.addActivity({ label: 'Execution needs approval', tone: 'warning' });
              store.addConsoleEvent({ kind: 'approval', level: 'warning', label: 'Execution approval required' });
              break;

            case 'done':
              store.setAgentPhase('idle');
              store.addActivity({ label: 'Response complete', tone: 'success' });
              store.addConsoleEvent({ kind: 'agent', level: 'success', label: 'Response complete' });
              break;

            case 'error':
              store.setAgentPhase('error');
              store.addActivity({ label: data.message || 'Agent error', tone: 'danger' });
              store.addConsoleEvent({
                kind: 'error',
                level: 'error',
                label: data.message || 'Agent error',
              });
              store.addMessage({
                id: crypto.randomUUID(),
                role: 'system',
                content: `Error: ${data.message}`,
                createdAt: new Date(),
              });
              break;

            case 'pong':
              break;

            default:
              console.log('Unknown WebSocket message type:', data.type);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        const store = useChatStore.getState();
        isConnecting = false;
        sharedSocket = null;
        clearHeartbeat();
        setIsConnected(false);
        store.setAgentPhase('error');
        store.addActivity({ label: 'Agent channel disconnected', tone: 'danger' });
        store.addConsoleEvent({ kind: 'websocket', level: 'warning', label: 'Agent channel disconnected' });

        reconnectTimeout = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        isConnecting = false;
        const store = useChatStore.getState();
        store.setAgentPhase('error');
        store.addConsoleEvent({ kind: 'websocket', level: 'error', label: 'WebSocket error' });
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      isConnecting = false;
      const store = useChatStore.getState();
      store.setAgentPhase('error');
      store.addConsoleEvent({ kind: 'websocket', level: 'error', label: 'WebSocket connection failed' });
      console.error('Failed to connect WebSocket:', error);

      reconnectTimeout = setTimeout(() => {
        connect();
      }, 5000);
    }
  }, [setIsConnected]);

  const disconnect = useCallback(() => {
    clearReconnect();
    clearHeartbeat();

    if (sharedSocket) {
      sharedSocket.close();
      sharedSocket = null;
    }

    isConnecting = false;
    setIsConnected(false);
  }, [setIsConnected]);

  const sendMessage = useCallback((
    content: string,
    options: {
      mode?: AgentMode;
      attachments?: AttachmentDescriptor[];
      approved?: boolean;
      clientActionId?: string;
    } = {}
  ) => {
    if (!sharedSocket || sharedSocket.readyState !== WebSocket.OPEN) {
      useChatStore.getState().addActivity({ label: 'Message could not send, channel offline', tone: 'danger' });
      useChatStore.getState().addConsoleEvent({ kind: 'chat', level: 'error', label: 'Message send failed: channel offline' });
      return;
    }

    const store = useChatStore.getState();
    const mode = options.mode || store.mode;
    const attachments = options.attachments || store.attachments;
    const clientActionId = options.clientActionId || crypto.randomUUID();

    store.setAgentPhase(mode === 'execute' && !options.approved ? 'approval' : 'listening');
    store.addConsoleEvent({
      kind: 'chat',
      level: 'info',
      label: `Sending ${mode} message`,
      metadata: { attachments: attachments.length, clientActionId },
    });
    store.addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content,
      attachments,
      createdAt: new Date(),
    });

    store.addMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      createdAt: new Date(),
    });

    sharedSocket.send(
      JSON.stringify({
        type: 'message',
        content,
        sessionId: store.currentSessionId,
        attachments,
        mode,
        approved: Boolean(options.approved),
        clientActionId,
      })
    );

    store.clearAttachments();
  }, []);

  useEffect(() => {
    return () => {
      clearReconnect();
    };
  }, []);

  return {
    connect,
    disconnect,
    sendMessage,
    isConnected,
  };
}
