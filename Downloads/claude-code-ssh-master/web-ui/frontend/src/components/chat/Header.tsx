import React from 'react';
import { Settings, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/lib/store/chatStore';

export function Header() {
  const { isConnected } = useChatStore();

  return (
    <header className="h-16 border-b border-border bg-background flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center text-white text-sm font-bold">
            C
          </div>
          <span className="font-semibold text-lg">Claude SSH</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full text-xs">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`}
          />
          <span className="text-muted-foreground">
            {isConnected ? 'Connected' : 'Connecting...'}
          </span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full text-xs text-green-500">
          <span>⚡</span>
          <span>3 MCP Servers Active</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-2">
          <Monitor className="h-4 w-4" />
          Monitor
        </Button>
        <Button variant="ghost" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </div>
    </header>
  );
}
