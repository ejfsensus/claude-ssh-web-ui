import React from 'react';
import {
  CircleDot,
  LayoutPanelLeft,
  PanelRight,
  Radio,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useChatStore } from '@/lib/store/chatStore';
import { cn } from '@/lib/utils';
import { VoiceAgent } from '@/components/chat/VoiceAgent';

const phaseLabel = {
  idle: 'Ready',
  listening: 'Listening',
  thinking: 'Thinking',
  streaming: 'Streaming',
  approval: 'Approval',
  error: 'Offline',
};

export function Header() {
  const {
    agentPhase,
    dockOpen,
    isConnected,
    mode,
    runtimeStatus,
    sidebarOpen,
    toggleDock,
    toggleSidebar,
  } = useChatStore();

  const StatusIcon = isConnected ? Wifi : WifiOff;
  const compact = () => typeof window !== 'undefined' && window.innerWidth <= 880;
  const handleSidebar = () => {
    if (compact() && !sidebarOpen && dockOpen) toggleDock();
    toggleSidebar();
  };
  const handleDock = () => {
    if (compact() && !dockOpen && sidebarOpen) toggleSidebar();
    toggleDock();
  };

  return (
    <header className="studio-header">
      <div className="header-left">
        <button
          className={cn('icon-button', sidebarOpen && 'icon-button-active')}
          onClick={handleSidebar}
          aria-label="Toggle chat history"
          title="Chat history"
        >
          <LayoutPanelLeft className="h-4 w-4" />
        </button>

        <div className="brand-lockup">
          <div className="brand-sigil">
            <CircleDot className="h-4 w-4" />
          </div>
          <div>
            <p>Personal AI</p>
            <h1>Agent Studio</h1>
          </div>
        </div>
      </div>

      <div className="header-center" aria-label="Runtime state">
        <div className={cn('status-pill', isConnected ? 'status-good' : 'status-bad')}>
          <StatusIcon className="h-3.5 w-3.5" />
          <span>{isConnected ? 'Connected' : 'Reconnecting'}</span>
        </div>
        <div className="status-pill">
          <Radio className="h-3.5 w-3.5" />
          <span>{phaseLabel[agentPhase]}</span>
        </div>
        <div className="status-pill">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>{mode[0].toUpperCase() + mode.slice(1)}</span>
        </div>
        <div className={cn('status-pill', runtimeStatus?.agent?.available && 'status-good')}>
          <span className="state-dot" />
          <span>{runtimeStatus?.agent?.available ? 'Claude Code' : 'Checking agent'}</span>
        </div>
      </div>

      <div className="header-right">
        <VoiceAgent />
        <button
          className={cn('icon-button', dockOpen && 'icon-button-active')}
          onClick={handleDock}
          aria-label="Toggle context dock"
          title="Context dock"
        >
          <PanelRight className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
