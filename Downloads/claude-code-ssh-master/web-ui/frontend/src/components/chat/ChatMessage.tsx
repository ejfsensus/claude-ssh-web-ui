import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message } from '@/lib/store/chatStore';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <div className="px-4 py-2 bg-muted rounded-md text-sm text-muted-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex gap-3 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300',
        isUser && 'flex-row-reverse'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-semibold',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-blue-600 text-white'
        )}
      >
        {isUser ? 'U' : 'C'}
      </div>

      {/* Content */}
      <div className={cn('flex-1 min-w-0', isUser && 'flex flex-col items-end')}>
        <div className="text-xs text-muted-foreground mb-1">
          {isUser ? 'You' : 'Claude'}
        </div>

        {message.attachments && message.attachments.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {message.attachments.map((file, idx) => (
              <div
                key={idx}
                className="px-3 py-1.5 bg-muted rounded-md text-xs text-muted-foreground flex items-center gap-2"
              >
                <span>📎</span>
                <span>{file}</span>
              </div>
            ))}
          </div>
        )}

        <div className="message-text text-sm leading-relaxed">
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                code: ({ className, children, ...props }: any) => {
                  const inline = !(className || '').includes('language-');
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match ? match[1] : 'text'}
                      PreTag="div"
                      className="rounded-md"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code
                      className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}
