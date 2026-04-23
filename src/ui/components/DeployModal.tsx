import { useState, useEffect, useCallback } from 'react';
import type { ChannelType, DeployConfig } from '../services/api';
import { deployApi } from '../services/api';

const { deployAgent, getMatrixRooms, getTelegramChats } = deployApi;

interface DeployModalProps {
  agentId: string;
  agentName: string;
  isOpen: boolean;
  onClose: () => void;
  onDeployed?: (channels: ChannelType[]) => void;
}

interface RoomOption {
  id: string;
  name: string;
}

export function DeployModal({
  agentId,
  agentName,
  isOpen,
  onClose,
  onDeployed,
}: DeployModalProps) {
  const [selectedChannels, setSelectedChannels] = useState<Set<ChannelType>>(new Set());
  const [matrixRoom, setMatrixRoom] = useState('');
  const [telegramChat, setTelegramChat] = useState('');
  const [cliCwd, setCliCwd] = useState('/home/ani');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matrixRooms, setMatrixRooms] = useState<RoomOption[]>([]);
  const [telegramChats, setTelegramChats] = useState<RoomOption[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Load available rooms/chats
      Promise.all([getMatrixRooms(), getTelegramChats()]).then(
        ([rooms, chats]) => {
          setMatrixRooms(rooms);
          setTelegramChats(chats);
          if (rooms.length > 0 && !matrixRoom) {
            setMatrixRoom(rooms[0].id);
          }
          if (chats.length > 0 && !telegramChat) {
            setTelegramChat(chats[0].id);
          }
        }
      );
    }
  }, [isOpen, matrixRoom, telegramChat]);

  const toggleChannel = useCallback((channel: ChannelType) => {
    setSelectedChannels(prev => {
      const next = new Set(prev);
      if (next.has(channel)) {
        next.delete(channel);
      } else {
        next.add(channel);
      }
      return next;
    });
  }, []);

  const handleDeploy = async () => {
    if (selectedChannels.size === 0) {
      setError('Please select at least one channel');
      return;
    }

    setIsLoading(true);
    setError(null);

    const config: DeployConfig = {
      channels: Array.from(selectedChannels),
      matrixRoom: selectedChannels.has('matrix') ? matrixRoom : undefined,
      telegramChat: selectedChannels.has('telegram') ? telegramChat : undefined,
      cliCwd: selectedChannels.has('cli') ? cliCwd : undefined,
    };

    try {
      const result = await deployAgent(agentId, config);
      if (result.success) {
        onDeployed?.(Array.from(selectedChannels));
        onClose();
        // Reset state
        setSelectedChannels(new Set());
      } else {
        setError(result.message || 'Deployment failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedChannels(new Set());
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const ChannelCheckbox = ({
    channel,
    label,
    icon,
  }: {
    channel: ChannelType;
    label: string;
    icon: React.ReactNode;
  }) => (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input
        type="checkbox"
        checked={selectedChannels.has(channel)}
        onChange={() => toggleChannel(channel)}
        className="mt-1 h-4 w-4 rounded border-ink-300 text-accent focus:ring-accent"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-ink-800">{label}</span>
        </div>
      </div>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-surface shadow-2xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
            <h2 className="text-base font-semibold text-ink-800">Deploy Agent</h2>
          </div>
          <button
            onClick={handleCancel}
            className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-4 space-y-4">
          <p className="text-sm text-muted">
            Deploy <span className="font-medium text-ink-700">{agentName}</span> to selected
            channels:
          </p>

          {/* Matrix Channel */}
          <div className="rounded-lg border border-ink-900/5 bg-surface-secondary p-3 space-y-2">
            <ChannelCheckbox
              channel="matrix"
              label="Matrix"
              icon={
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-matrix"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
                </svg>
              }
            />
            {selectedChannels.has('matrix') && (
              <div className="ml-7 mt-2">
                <label className="block text-xs text-muted mb-1">Room</label>
                <select
                  value={matrixRoom}
                  onChange={e => setMatrixRoom(e.target.value)}
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {matrixRooms.map(room => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Telegram Channel */}
          <div className="rounded-lg border border-ink-900/5 bg-surface-secondary p-3 space-y-2">
            <ChannelCheckbox
              channel="telegram"
              label="Telegram"
              icon={
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-telegram"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                </svg>
              }
            />
            {selectedChannels.has('telegram') && (
              <div className="ml-7 mt-2">
                <label className="block text-xs text-muted mb-1">Chat</label>
                <select
                  value={telegramChat}
                  onChange={e => setTelegramChat(e.target.value)}
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {telegramChats.map(chat => (
                    <option key={chat.id} value={chat.id}>
                      {chat.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* CLI Channel */}
          <div className="rounded-lg border border-ink-900/5 bg-surface-secondary p-3 space-y-2">
            <ChannelCheckbox
              channel="cli"
              label="CLI"
              icon={
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-cli"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 17l6-6-6-6" />
                  <path d="M12 19h8" />
                </svg>
              }
            />
            {selectedChannels.has('cli') && (
              <div className="ml-7 mt-2">
                <label className="block text-xs text-muted mb-1">Working Directory</label>
                <input
                  type="text"
                  value={cliCwd}
                  onChange={e => setCliCwd(e.target.value)}
                  placeholder="/home/ani"
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            onClick={handleCancel}
            disabled={isLoading}
            className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDeploy}
            disabled={isLoading || selectedChannels.size === 0}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                </svg>
                Deploying...
              </>
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
                Deploy
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeployModal;
