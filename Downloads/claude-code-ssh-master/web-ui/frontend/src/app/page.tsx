'use client';

import { useEffect, useRef } from 'react';
import { useChatStore } from '@/lib/store/chatStore';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { Header } from '@/components/chat/Header';
import { Sidebar } from '@/components/chat/Sidebar';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MenuIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const { messages, sidebarOpen, toggleSidebar } = useChatStore();
  const { connect } = useWebSocket();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Connect to WebSocket on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="max-w-4xl mx-auto px-6 py-8">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-20">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-6">
                    C
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">Welcome to Claude SSH</h2>
                  <p className="text-muted-foreground max-w-md">
                    Start chatting with Claude Code CLI. I can help you write code,
                    debug issues, manage files, and run background processes.
                  </p>
                  <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-2xl">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="text-2xl mb-2">💬</div>
                      <h3 className="font-semibold mb-1">Chat</h3>
                      <p className="text-sm text-muted-foreground">
                        Ask questions and get help with coding tasks
                      </p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="text-2xl mb-2">📁</div>
                      <h3 className="font-semibold mb-1">Files</h3>
                      <p className="text-sm text-muted-foreground">
                        Upload, edit, and manage workspace files
                      </p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="text-2xl mb-2">⚡</div>
                      <h3 className="font-semibold mb-1">MCP</h3>
                      <p className="text-sm text-muted-foreground">
                        Extend capabilities with MCP servers
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <ChatMessage key={message.id} message={message} />
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
          </ScrollArea>

          <ChatInput />
        </main>
      </div>

      {/* Mobile sidebar toggle */}
      {!sidebarOpen && (
        <div className="fixed bottom-6 left-6 z-50">
          <Button
            size="icon"
            onClick={toggleSidebar}
            className="h-12 w-12 rounded-full shadow-lg"
          >
            <MenuIcon className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  );
}
