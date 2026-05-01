import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { PaperclipIcon, MicIcon, SendIcon } from 'lucide-react';

export function ChatInput() {
  const [message, setMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, isConnected } = useWebSocket();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleSend = () => {
    if (message.trim() && isConnected) {
      sendMessage(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = '24px';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    // TODO: Handle file uploads
    console.log('Dropped files:', files);
  };

  return (
    <div className="p-6 border-t border-border bg-muted/30">
      <div className="max-w-4xl mx-auto">
        {isDragging && (
          <div className="mb-4 p-6 border-2 border-dashed border-primary rounded-lg text-center text-sm text-muted-foreground bg-primary/5">
            📁 Drop files here to upload
          </div>
        )}

        <div
          className="bg-background rounded-xl border border-border overflow-hidden transition-shadow duration-200 focus-within:ring-2 focus-within:ring-ring"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Claude..."
            className="min-h-[60px] max-h-[200px] resize-none border-0 focus-visible:ring-0"
            rows={1}
          />

          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Attach file"
              >
                <PaperclipIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Voice input"
              >
                <MicIcon className="h-4 w-4" />
              </Button>
            </div>

            <Button
              onClick={handleSend}
              disabled={!message.trim() || !isConnected}
              size="sm"
              className="gap-2"
            >
              <span>Send</span>
              <SendIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!isConnected && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            Connecting to Claude...
          </p>
        )}
      </div>
    </div>
  );
}
