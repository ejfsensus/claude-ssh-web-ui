import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, FileUp, Mic2, Send, ShieldCheck, X } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { useChatStore } from '@/lib/store/chatStore';
import type { AgentMode } from '@/lib/store/chatStore';
import { cn } from '@/lib/utils';

const modeLabels: Record<AgentMode, string> = {
  ask: 'Ask',
  plan: 'Plan',
  execute: 'Execute',
};

const mutationPattern = /\b(apply|build|commit|delete|deploy|edit|install|migrate|push|remove|restart|run|write)\b/i;

export function ChatInput() {
  const [message, setMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { sendMessage, isConnected } = useWebSocket();
  const {
    addActivity,
    addAttachment,
    attachments,
    clearAttachments,
    mode,
    pendingExecute,
    removeAttachment,
    setAgentPhase,
    setMode,
    setPendingExecute,
  } = useChatStore();

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '28px';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [message]);

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of files) {
        const response = await apiClient.uploadFile(file);
        addAttachment(response.file);
        addActivity({ label: `Attached ${response.file.name}`, tone: 'success' });
      }
    } catch (error) {
      addActivity({
        label: error instanceof Error ? error.message : 'Upload failed',
        tone: 'danger',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const submit = (approved = false, overrideContent?: string) => {
    const content = (overrideContent || message).trim();
    if (!content || !isConnected) return;

    const requiresApproval = mode === 'execute' || mutationPattern.test(content);
    if (requiresApproval && !approved) {
      const clientActionId = crypto.randomUUID();
      setPendingExecute({ content, attachments, clientActionId });
      setAgentPhase('approval');
      addActivity({ label: 'Waiting for execution approval', tone: 'warning' });
      return;
    }

    sendMessage(content, {
      mode: requiresApproval ? 'execute' : mode,
      attachments,
      approved,
      clientActionId: pendingExecute?.clientActionId,
    });
    setMessage('');
    clearAttachments();
    setPendingExecute(null);
  };

  const handleConfirmExecute = () => {
    if (!pendingExecute) return;
    sendMessage(pendingExecute.content, {
      mode: 'execute',
      attachments: pendingExecute.attachments,
      approved: true,
      clientActionId: pendingExecute.clientActionId,
    });
    setMessage('');
    clearAttachments();
    setPendingExecute(null);
  };

  const cancelExecute = () => {
    setPendingExecute(null);
    setAgentPhase('idle');
    addActivity({ label: 'Execution request cancelled', tone: 'neutral' });
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    uploadFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <div className="composer-shell">
      {pendingExecute && (
        <div className="approval-sheet" role="dialog" aria-label="Confirm execute mode">
          <div className="flex items-start gap-3">
            <div className="approval-mark">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3>Confirm execute mode</h3>
              <p>
                This request may change files, run commands, or affect the deployment. Confirm before it reaches Claude Code.
              </p>
              <blockquote>{pendingExecute.content}</blockquote>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="primary-action" onClick={handleConfirmExecute}>
                  <Check className="h-4 w-4" />
                  Confirm
                </button>
                <button className="quiet-action" onClick={cancelExecute}>
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isDragging && (
        <div className="drop-field">
          <FileUp className="h-5 w-5" />
          Drop files to attach
        </div>
      )}

      <div
        className="composer"
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className="composer-topline">
          <div className="mode-switch" role="tablist" aria-label="Agent mode">
            {(Object.keys(modeLabels) as AgentMode[]).map((item) => (
              <button
                key={item}
                className={cn(mode === item && 'mode-active')}
                onClick={() => setMode(item)}
                role="tab"
                aria-selected={mode === item}
              >
                {modeLabels[item]}
              </button>
            ))}
          </div>
          <span className="safety-note">
            <AlertTriangle className="h-3.5 w-3.5" />
            Execute asks first
          </span>
        </div>

        {attachments.length > 0 && (
          <div className="attachment-row">
            {attachments.map((attachment) => (
              <button
                key={attachment.id}
                className="attachment-chip"
                onClick={() => removeAttachment(attachment.id)}
                title="Remove attachment"
              >
                <FileUp className="h-3.5 w-3.5" />
                <span>{attachment.name}</span>
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Ask Claude Code..."
          className="composer-input"
          rows={1}
        />

        <div className="composer-actions">
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            multiple
            onChange={(event) => uploadFiles(Array.from(event.target.files || []))}
          />
          <div className="flex items-center gap-2">
            <button
              className="icon-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="Attach file"
              aria-label="Attach file"
            >
              <FileUp className="h-4 w-4" />
            </button>
            <button
              className="icon-button"
              disabled
              title="Voice unavailable in this build"
              aria-label="Voice unavailable"
            >
              <Mic2 className="h-4 w-4" />
            </button>
          </div>
          <button
            className="send-button"
            onClick={() => submit()}
            disabled={!message.trim() || !isConnected}
          >
            <span>{isConnected ? 'Send' : 'Connecting'}</span>
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
