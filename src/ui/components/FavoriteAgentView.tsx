import { useState } from 'react';
import type { AgentSummary } from '../store/useAppStore';

interface FavoriteAgentViewProps {
  agent: AgentSummary;
  onChat: () => void;
  onEditMemory: () => void;
  onSettings: () => void;
  onViewAllAgents: () => void;
  recentConversations?: Array<{
    id: string;
    title: string;
    lastMessageAt?: string;
    messageCount?: number;
  }>;
  health?: {
    memoryPressure: number; // 0-100
    lastActivityAt?: string;
    curatorHealth?: 'healthy' | 'degraded' | 'critical';
    status: 'active' | 'idle' | 'stale' | 'unknown';
  };
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'unknown';
  const diff = Date.now() - then;
  const min = 60_000, hr = 60 * min, day = 24 * hr;
  if (diff < min) return 'just now';
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function statusDot(status: string): string {
  switch (status) {
    case 'active': return 'bg-green-500';
    case 'idle': return 'bg-amber-500';
    case 'stale': return 'bg-ink-400';
    case 'critical': return 'bg-red-500';
    default: return 'bg-ink-400';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'active': return 'Active';
    case 'idle': return 'Idle';
    case 'stale': return 'Stale';
    case 'critical': return 'Needs attention';
    default: return 'Unknown';
  }
}

// Icon components using inline SVG (matches project pattern)
const IconMessage = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
  </svg>
);

const IconBrain = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const IconSettings = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconActivity = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const IconHash = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
  </svg>
);

const IconClock = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconZap = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const IconChevronRight = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export function FavoriteAgentView({
  agent,
  onChat,
  onEditMemory,
  onSettings,
  onViewAllAgents,
  recentConversations = [],
  health,
}: FavoriteAgentViewProps) {
  const [showAllConvs, setShowAllConvs] = useState(false);
  const visibleConvs = showAllConvs ? recentConversations : recentConversations.slice(0, 5);

  return (
    <div className="h-full flex flex-col bg-surface overflow-y-auto">
      {/* Header gradient */}
      <div className="bg-gradient-to-br from-accent/5 via-surface to-surface border-b border-ink-900/10">
        <div className="px-6 py-8 max-w-5xl mx-auto">
          <div className="flex items-center gap-2 text-xs text-ink-500 mb-4">
            <span className="uppercase tracking-wide font-medium">Your Companion</span>
            <IconChevronRight className="w-3 h-3" />
            <button
              onClick={onViewAllAgents}
              className="hover:text-accent transition-colors"
            >
              All Agents
            </button>
          </div>

          <div className="flex items-start gap-6">
            {/* Avatar / Contact Card */}
            <div className="relative shrink-0 hover:scale-[1.02] transition-transform duration-200">
              <div className="w-24 h-24 rounded-2xl bg-accent/10 border-2 border-accent/20 flex items-center justify-center text-accent text-3xl font-semibold">
                {agent.name.slice(0, 2).toUpperCase()}
              </div>
              <span
                className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-[3px] border-surface ${statusDot(health?.status || 'unknown')} animate-pulse`}
                title={statusLabel(health?.status || 'unknown')}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-semibold text-ink-900 truncate">{agent.name}</h1>
                <span className={`text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full ${
                  health?.status === 'active' ? 'bg-green-500/10 text-green-600' :
                  health?.status === 'idle' ? 'bg-amber-500/10 text-amber-600' :
                  'bg-ink-400/10 text-ink-500'
                }`}>
                  {statusLabel(health?.status || 'unknown')}
                </span>
              </div>

              <p className="text-sm text-ink-600 line-clamp-2 max-w-xl mb-4">
                {agent.description || `${agent.name} is ready to help. Start a conversation, review memory, or tune settings.`}
              </p>

              {/* Quick actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={onChat}
                  className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
                >
                  <IconMessage className="w-4 h-4" />
                  Chat
                </button>
                <button
                  onClick={onEditMemory}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-tertiary text-ink-700 rounded-lg text-sm font-medium hover:bg-ink-900/10 transition-colors"
                >
                  <IconBrain className="w-4 h-4" />
                  Memory
                </button>
                <button
                  onClick={onSettings}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-tertiary text-ink-700 rounded-lg text-sm font-medium hover:bg-ink-900/10 transition-colors"
                >
                  <IconSettings className="w-4 h-4" />
                  Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard grid */}
      <div className="flex-1 px-6 py-6 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Health monitor card */}
          <div className="bg-surface border border-ink-900/10 rounded-xl p-4 hover:scale-[1.01] transition-transform duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-accent/10">
                <IconActivity className="text-accent w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Health</h3>
                <p className="text-[10px] text-ink-500 uppercase tracking-wide">system status</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-ink-600">Memory pressure</span>
                  <span className="text-ink-900 font-medium">{health?.memoryPressure ?? 0}%</span>
                </div>
                <div className="h-1.5 bg-ink-900/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      (health?.memoryPressure || 0) > 80 ? 'bg-red-500' :
                      (health?.memoryPressure || 0) > 50 ? 'bg-amber-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(health?.memoryPressure || 0, 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs py-1 border-t border-ink-900/5">
                <span className="text-ink-600">Last activity</span>
                <span className="text-ink-900">{relativeTime(health?.lastActivityAt)}</span>
              </div>

              <div className="flex items-center justify-between text-xs py-1 border-t border-ink-900/5">
                <span className="text-ink-600">Curator</span>
                <span className={`font-medium ${
                  health?.curatorHealth === 'healthy' ? 'text-green-600' :
                  health?.curatorHealth === 'degraded' ? 'text-amber-600' : 'text-red-500'
                }`}>
                  {health?.curatorHealth || 'unknown'}
                </span>
              </div>
            </div>
          </div>

          {/* Stats card */}
          <div className="bg-surface border border-ink-900/10 rounded-xl p-4 hover:scale-[1.01] transition-transform duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-green-500/10">
                <IconHash className="text-green-600 w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Stats</h3>
                <p className="text-[10px] text-ink-500 uppercase tracking-wide">activity summary</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-2 bg-ink-900/5 rounded-lg">
                <div className="text-lg font-semibold text-ink-900">{recentConversations.length}</div>
                <div className="text-[10px] text-ink-500 uppercase tracking-wide">Conversations</div>
              </div>
              <div className="p-2 bg-ink-900/5 rounded-lg">
                <div className="text-lg font-semibold text-ink-900">{agent.toolCount ?? 0}</div>
                <div className="text-[10px] text-ink-500 uppercase tracking-wide">Tools</div>
              </div>
              <div className="p-2 bg-ink-900/5 rounded-lg">
                <div className="text-lg font-semibold text-ink-900">{relativeTime(agent.createdAt)}</div>
                <div className="text-[10px] text-ink-500 uppercase tracking-wide">Created</div>
              </div>
              <div className="p-2 bg-ink-900/5 rounded-lg">
                <div className="text-lg font-semibold text-ink-900 truncate" title={agent.model || 'Unknown'}>
                  {agent.model ? agent.model.split('/').pop()?.split(':')[0] : '—'}
                </div>
                <div className="text-[10px] text-ink-500 uppercase tracking-wide">Model</div>
              </div>
            </div>
          </div>

          {/* Schedule / Sleep card */}
          <div className="bg-surface border border-ink-900/10 rounded-xl p-4 hover:scale-[1.01] transition-transform duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <IconClock className="text-amber-600 w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Schedule</h3>
                <p className="text-[10px] text-ink-500 uppercase tracking-wide">sleep & wake</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-ink-600">Sleeptime</span>
                <span className="text-ink-900">Enabled (auto)</span>
              </div>
              <div className="flex items-center justify-between py-1 border-t border-ink-900/5">
                <span className="text-ink-600">Quiet hours</span>
                <span className="text-ink-900">22:00 — 08:00</span>
              </div>
              <div className="flex items-center justify-between py-1 border-t border-ink-900/5">
                <span className="text-ink-600">Next check</span>
                <span className="text-ink-900">in 2h 14m</span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-ink-900/5">
              <div className="flex items-center gap-2 text-[10px] text-ink-500">
                <IconZap className="w-3 h-3" />
                <span>Auto-curate runs every 6 hours</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent conversations */}
        <div className="mt-4 bg-surface border border-ink-900/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <IconMessage className="w-4 h-4 text-accent" />
              <h3 className="font-medium text-sm">Recent Conversations</h3>
            </div>
            <button
              onClick={onChat}
              className="text-xs text-accent hover:text-accent-hover transition-colors"
            >
              New conversation →
            </button>
          </div>

          <div className="divide-y divide-ink-900/5">
            {visibleConvs.length > 0 ? (
              visibleConvs.map((conv) => (
                <div
                  key={conv.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    <span className="truncate">{conv.title || 'Untitled'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-ink-500 shrink-0 ml-3">
                    {conv.messageCount !== undefined && (
                      <span>{conv.messageCount} msgs</span>
                    )}
                    <span>{relativeTime(conv.lastMessageAt)}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-ink-500 italic py-4 text-center">
                No conversations yet. Start chatting to create one.
              </p>
            )}
          </div>

          {recentConversations.length > 5 && (
            <button
              onClick={() => setShowAllConvs(!showAllConvs)}
              className="mt-2 text-xs text-accent hover:text-accent-hover transition-colors"
            >
              {showAllConvs ? 'Show less' : `+ ${recentConversations.length - 5} more`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
