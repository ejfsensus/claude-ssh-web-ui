import { useCallback, useEffect } from 'react';
import { useChatStore } from '@/lib/store/chatStore';
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
        isConnecting = false;
        setIsConnected(true);
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
              break;

            case 'session_created':
              store.setCurrentSessionId(data.sessionId);
              store.addSession({
                id: data.sessionId,
                title: 'New Chat',
                createdAt: new Date(),
                lastActiveAt: new Date(),
              });
              break;

            case 'token':
              store.appendToLastMessage(data.content);
              break;

            case 'done':
              break;

            case 'error':
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
        isConnecting = false;
        sharedSocket = null;
        clearHeartbeat();
        setIsConnected(false);

        reconnectTimeout = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        isConnecting = false;
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      isConnecting = false;
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

  const sendMessage = useCallback((content: string, attachments: string[] = []) => {
    if (!sharedSocket || sharedSocket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      return;
    }

    const store = useChatStore.getState();

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
      })
    );
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
