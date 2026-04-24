/**
 * ConnectionModeIndicator — Shows connection status and mode toggle.
 * Server mode: Direct SDK (management only)
 * Local mode: Connected to letta-code (full tool use)
 */

import { useState } from 'react';

export type ConnectionMode = 'server' | 'local';

interface Props {
  mode: ConnectionMode;
  onModeChange: (mode: ConnectionMode) => void;
  lettaCodeStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  lettaCodeUrl: string;
  onLettaCodeUrlChange: (url: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  supportedCommands?: string[];
}

export default function ConnectionModeIndicator({
  mode,
  onModeChange,
  lettaCodeStatus,
  lettaCodeUrl,
  onLettaCodeUrlChange,
  onConnect,
  onDisconnect,
  supportedCommands = [],
}: Props) {
  const [showConfig, setShowConfig] = useState(false);

  const statusColor = {
    connected: 'var(--green)',
    connecting: 'var(--orange)',
    disconnected: 'var(--gray)',
    error: 'var(--red)',
  }[lettaCodeStatus];

  const getStatusDotClass = () => {
    switch (lettaCodeStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-amber-500 animate-pulse';
      case 'error': return 'bg-red-500';
      default: return 'bg-ink-300';
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Mode Toggle */}
      <div className="flex bg-surface-cream rounded-lg p-1 border border-ink-900/10">
        <button
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mode === 'server'
              ? 'bg-accent text-white shadow-sm'
              : 'text-ink-600 hover:bg-ink-900/5'
          }`}
          onClick={() => onModeChange('server')}
          title="Server Mode: Direct SDK (management only)"
        >
          Server
        </button>
        <button
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mode === 'local'
              ? 'bg-accent text-white shadow-sm'
              : 'text-ink-600 hover:bg-ink-900/5'
          }`}
          onClick={() => onModeChange('local')}
          title="Local Mode: Full tool use via letta-code"
        >
          Local
        </button>
      </div>

      {mode === 'local' && (
        <div className="flex items-center gap-2">
          {/* Status Dot */}
          <div className={`w-2 h-2 rounded-full ${getStatusDotClass()}`} title={lettaCodeStatus} />

          {lettaCodeStatus === 'connected' ? (
            <>
              <span className="text-xs text-ink-600">Connected</span>
              <button
                onClick={onDisconnect}
                className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                title="Disconnect from letta-code"
              >
                Disconnect
              </button>
            </>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="text-xs text-accent hover:text-accent-hover px-2 py-1 rounded hover:bg-accent/10 transition-colors"
              >
                {lettaCodeStatus === 'connecting' ? 'Connecting...' : 'Connect'}
              </button>

              {showConfig && (
                <div className="absolute top-full right-0 mt-2 bg-surface border border-ink-900/10 rounded-lg shadow-lg p-3 flex gap-2 z-50 min-w-[280px]">
                  <input
                    type="text"
                    value={lettaCodeUrl}
                    onChange={e => onLettaCodeUrlChange(e.target.value)}
                    placeholder="ws://localhost:8283/ws"
                    onKeyDown={e => {
                      if (e.key === 'Enter') onConnect();
                    }}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-ink-900/10 bg-surface-secondary focus:border-accent focus:outline-none"
                  />
                  <button
                    onClick={onConnect}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
                  >
                    Connect
                  </button>
                </div>
              )}
            </div>
          )}

          {supportedCommands.length > 0 && lettaCodeStatus === 'connected' && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent"
              title={`Commands: ${supportedCommands.join(', ')}`}
            >
              {supportedCommands.length} commands
            </span>
          )}
        </div>
      )}
    </div>
  );
}
