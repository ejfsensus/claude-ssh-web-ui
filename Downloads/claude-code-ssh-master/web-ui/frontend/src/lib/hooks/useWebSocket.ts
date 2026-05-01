import { useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '@/lib/store/chatStore';
import { apiClient } from '@/lib/api/client';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const {
    setIsConnected,
    currentSessionId,
    addMessage,
    appendToLastMessage,
    addSession,
    setCurrentSessionId,
  } = useChatStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = apiClient.connectWebSocket();
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);

        // Clear any pending reconnection
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'connected':
              console.log('WebSocket connection confirmed:', data.connectionId);
              break;

            case 'session_created':
              console.log('Session created:', data.sessionId);
              setCurrentSessionId(data.sessionId);
              addSession({
                id: data.sessionId,
                title: 'New Chat',
                createdAt: new Date(),
                lastActiveAt: new Date(),
              });
              break;

            case 'token':
              // Append streaming token to last assistant message
              appendToLastMessage(data.content);
              break;

            case 'done':
              console.log('Message complete:', data.sessionId);
              break;

            case 'error':
              console.error('WebSocket error:', data.message);
              addMessage({
                id: Date.now().toString(),
                role: 'system',
                content: `Error: ${data.message}`,
                createdAt: new Date(),
              });
              break;

            case 'pong':
              // Heartbeat response
              break;

            default:
              console.log('Unknown WebSocket message type:', data.type);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);

        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);

      // Retry connection after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    }
  }, [setIsConnected, addSession, setCurrentSessionId, addMessage, appendToLastMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, [setIsConnected]);

  const sendMessage = useCallback(
    (content: string, attachments: string[] = []) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.error('WebSocket is not connected');
        return;
      }

      // Add user message to store
      addMessage({
        id: Date.now().toString(),
        role: 'user',
        content,
        attachments,
        createdAt: new Date(),
      });

      // Create placeholder assistant message for streaming
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        createdAt: new Date(),
      });

      // Send message to server
      wsRef.current.send(
        JSON.stringify({
          type: 'message',
          content,
          sessionId: currentSessionId,
          attachments,
        })
      );
    },
    [currentSessionId, addMessage]
  );

  // Send heartbeat every 30 seconds
  useEffect(() => {
    const heartbeatInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => clearInterval(heartbeatInterval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    sendMessage,
    isConnected: useChatStore((state) => state.isConnected),
  };
}
