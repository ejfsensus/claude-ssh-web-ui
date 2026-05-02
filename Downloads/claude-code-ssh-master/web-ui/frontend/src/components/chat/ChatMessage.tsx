import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, FileText, UserRound } from 'lucide-react';
import { Message } from '@/lib/store/chatStore';
import type { AttachmentDescriptor } from '@/lib/store/chatStore';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: Message;
}

const attachmentName = (attachment: AttachmentDescriptor | string) => (
  typeof attachment === 'string' ? attachment : attachment.name
);

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="system-message">
        <span>{message.content}</span>
      </div>
    );
  }

  return (
    <article className={cn('message-row', isUser && 'message-row-user')}>
      <div className={cn('message-avatar', isUser && 'message-avatar-user')}>
        {isUser ? <UserRound className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={cn('message-stack', isUser && 'message-stack-user')}>
        <div className="message-meta">
          <span>{isUser ? 'You' : 'Claude Code'}</span>
          <time>{message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
        </div>

        {message.attachments && message.attachments.length > 0 && (
          <div className="message-attachments">
            {message.attachments.map((attachment, index) => (
              <div key={`${attachmentName(attachment)}-${index}`} className="message-attachment">
                <FileText className="h-3.5 w-3.5" />
                <span>{attachmentName(attachment)}</span>
              </div>
            ))}
          </div>
        )}

        <div className={cn('message-bubble message-text', isUser && 'message-bubble-user')}>
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="mb-3 list-disc pl-5">{children}</ul>,
                ol: ({ children }) => <ol className="mb-3 list-decimal pl-5">{children}</ol>,
                code: ({ className, children, ...props }: any) => {
                  const inline = !(className || '').includes('language-');
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline ? (
                    <pre className="code-block">
                      {match && <span className="code-language">{match[1]}</span>}
                      <code {...props}>{String(children).replace(/\n$/, '')}</code>
                    </pre>
                  ) : (
                    <code className="inline-code" {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content || ' '}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </article>
  );
}
