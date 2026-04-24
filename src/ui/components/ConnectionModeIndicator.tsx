/**
 * ConnectionModeIndicator — Shows connection status and mode toggle.
 * Server mode: Direct SDK (management only)
 * Local mode: Connected to letta-code (full tool use)
 */

import React, { useState } from 'react';

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

  return (
    <div className="connection-mode">
      <div className="mode-toggle">
        <button
          className={mode === 'server' ? 'active' : ''}
          onClick={() => onModeChange('server')}
          title="Server Mode: Direct SDK (management only)"
        >
          Server
        </button>
        <button
          className={mode === 'local' ? 'active' : ''}
          onClick={() => onModeChange('local')}
          title="Local Mode: Full tool use via letta-code"
        >
          Local
        </button>
      </div>

      {mode === 'local' && (
        <div className="local-connection">
          <span
            className="status-indicator"
            style={{ background: statusColor }}
            title={lettaCodeStatus}
          />

          {lettaCodeStatus === 'connected' ? (
            <>
              <span className="status-label">Connected</span>
              <button
                className="disconnect-btn"
                onClick={onDisconnect}
                title="Disconnect from letta-code"
              >
                Disconnect
              </button>
            </>
          ) : (
            <>
              <button
                className="connect-btn"
                onClick={() => setShowConfig(!showConfig)}
              >
                {lettaCodeStatus === 'connecting' ? 'Connecting...' : 'Connect'}
              </button>

              {showConfig && (
                <div className="connect-config">
                  <input
                    type="text"
                    value={lettaCodeUrl}
                    onChange={e => onLettaCodeUrlChange(e.target.value)}
                    placeholder="ws://localhost:8283/ws"
                    onKeyDown={e => {
                      if (e.key === 'Enter') onConnect();
                    }}
                  />
                  <button onClick={onConnect}>Connect</button>
                </div>
              )}
            </>
          )}

          {supportedCommands.length > 0 && lettaCodeStatus === 'connected' && (
            <span className="supported-commands" title={`Commands: ${supportedCommands.join(', ')}`}>
              {supportedCommands.length} commands
            </span>
          )}
        </div>
      )}
    </div>
  );
}
