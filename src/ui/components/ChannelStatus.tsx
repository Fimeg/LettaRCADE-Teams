import { useState, useEffect } from 'react';
import type { ChannelType, ChannelStatus, DeployedChannel } from '../services/api';
import { deployApi } from '../services/api';

const { getDeployStatus, undeployChannel } = deployApi;

interface ChannelStatusProps {
  agentId: string;
}

interface ChannelBadgeProps {
  channel: DeployedChannel;
  onRemove?: (type: ChannelType) => void;
}

const statusColors: Record<ChannelStatus, string> = {
  connected: 'bg-green-500',
  connecting: 'bg-yellow-500',
  disconnected: 'bg-red-500',
};

const statusIcons: Record<ChannelType, React.ReactNode> = {
  matrix: (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
    </svg>
  ),
  cli: (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 17l6-6-6-6" />
      <path d="M12 19h8" />
    </svg>
  ),
};

function ChannelBadge({ channel, onRemove }: ChannelBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => onRemove?.(channel.type)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50 transition-colors"
      >
        <span className={`h-2 w-2 rounded-full ${statusColors[channel.status]}`} />
        <span className="text-ink-600">{statusIcons[channel.type]}</span>
        <span>{channel.name}</span>
        {onRemove && (
          <svg
            viewBox="0 0 24 24"
            className="h-3 w-3 text-ink-400 hover:text-red-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" x2="6" y1="6" y2="18" />
            <line x1="6" x2="18" y1="6" y2="18" />
          </svg>
        )}
      </button>

      {showTooltip && channel.config && (
        <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2">
          <div className="rounded-lg bg-ink-800 px-3 py-2 text-xs text-white shadow-lg whitespace-nowrap">
            {channel.config.room && <div>Room: {channel.config.room}</div>}
            {channel.config.chat && <div>Chat: {channel.config.chat}</div>}
            {channel.config.cwd && <div>CWD: {channel.config.cwd}</div>}
            <div className="mt-1 text-ink-400 capitalize">{channel.status}</div>
            <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-ink-800" />
          </div>
        </div>
      )}
    </div>
  );
}

export function ChannelStatus({ agentId }: ChannelStatusProps) {
  const [channels, setChannels] = useState<DeployedChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const loadStatus = async () => {
      try {
        const status = await getDeployStatus(agentId);
        setChannels(status);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load status');
      } finally {
        setIsLoading(false);
      }
    };

    loadStatus();
    // Poll every 10 seconds for status updates
    interval = setInterval(loadStatus, 10000);

    return () => clearInterval(interval);
  }, [agentId]);

  const handleRemove = async (type: ChannelType) => {
    const success = await undeployChannel(agentId, type);
    if (success) {
      setChannels(prev => prev.filter(ch => ch.type !== type));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <span className="text-xs text-muted">Loading channels...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-red-500">
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" x2="12" y1="8" y2="12" />
          <line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
        {error}
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="text-xs text-muted italic">
        Not deployed to any channels
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {channels.map(channel => (
        <ChannelBadge
          key={channel.type}
          channel={channel}
          onRemove={channel.status !== 'disconnected' ? handleRemove : undefined}
        />
      ))}
    </div>
  );
}

export default ChannelStatus;
