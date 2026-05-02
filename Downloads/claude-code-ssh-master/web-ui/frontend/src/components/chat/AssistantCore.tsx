import React from 'react';
import { CheckCircle2, Loader2, Mic2, Radio, ShieldAlert, Sparkles, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentPhase } from '@/lib/store/chatStore';

const phaseCopy: Record<AgentPhase, { label: string; detail: string; icon: React.ElementType }> = {
  idle: {
    label: 'Ready',
    detail: 'Conversation channel is open',
    icon: CheckCircle2,
  },
  listening: {
    label: 'Listening',
    detail: 'Your request is being handed over',
    icon: Mic2,
  },
  thinking: {
    label: 'Thinking',
    detail: 'Claude Code is reading context',
    icon: Sparkles,
  },
  streaming: {
    label: 'Responding',
    detail: 'Live answer in progress',
    icon: Loader2,
  },
  approval: {
    label: 'Approval',
    detail: 'Execution needs your confirmation',
    icon: ShieldAlert,
  },
  error: {
    label: 'Offline',
    detail: 'Reconnecting to the agent channel',
    icon: WifiOff,
  },
};

interface AssistantCoreProps {
  phase: AgentPhase;
  connected: boolean;
}

export function AssistantCore({ phase, connected }: AssistantCoreProps) {
  const state = connected ? phaseCopy[phase] : phaseCopy.error;
  const Icon = state.icon;
  const isActive = connected && ['listening', 'thinking', 'streaming'].includes(phase);

  return (
    <section className="assistant-core" aria-label="Assistant status">
      <div className={cn('core-aura', isActive && 'core-aura-active')} />
      <div className="core-orb" aria-hidden="true">
        <div className="core-starfield" />
        <div className="core-horizon" />
        <div className="core-pulse" />
      </div>
      <div className="core-status">
        <span className={cn('runline', connected && `runline-${phase}`)}>
          <Radio className="h-3.5 w-3.5" />
        </span>
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Icon className={cn('h-4 w-4', phase === 'streaming' && 'animate-spin')} />
            {state.label}
          </div>
          <p className="text-xs text-muted-foreground">{state.detail}</p>
        </div>
      </div>
    </section>
  );
}
