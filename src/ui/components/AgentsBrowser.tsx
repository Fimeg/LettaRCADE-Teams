import { useState } from 'react';
import type { AgentSummary } from '../store/useAppStore';

interface AgentsBrowserProps {
  agents: AgentSummary[];
  loading: boolean;
  onSelectAgent: (agentId: string) => void;
  onCreateAgent: () => void;
  favoriteAgentId?: string | null;
  onSetFavorite?: (agentId: string | null) => void;
}

export function AgentsBrowser({ agents, loading, onSelectAgent, onCreateAgent, favoriteAgentId, onSetFavorite }: AgentsBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'model'>('created');

  const filteredAgents = agents.filter((agent) => {
    const query = searchQuery.toLowerCase();
    return (
      agent.name.toLowerCase().includes(query) ||
      (agent.description?.toLowerCase() || '').includes(query) ||
      (agent.model?.toLowerCase() || '').includes(query)
    );
  });

  const sortedAgents = [...filteredAgents].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'created':
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      case 'model':
        return (a.model || '').localeCompare(b.model || '');
      default:
        return 0;
    }
  });

  const showWelcome = !searchQuery && !loading && agents.length > 0;

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Welcome hero — only while not searching and agents exist */}
      {showWelcome && (
        <div className="px-6 pt-6 pb-4 border-b border-ink-900/10 bg-gradient-to-br from-accent/5 via-surface to-surface">
          <div className="max-w-4xl">
            <h1 className="text-xl font-semibold text-ink-900">Your Agents</h1>
            <p className="mt-1 text-sm text-ink-600">
              {agents.length} agent{agents.length !== 1 ? 's' : ''} running on Letta Community ADE.
              Pick one to continue a conversation, edit its memory, or tune its settings.
            </p>
          </div>
        </div>
      )}

      {/* Header with search and actions */}
      <div className="flex items-center justify-between p-4 border-b border-ink-900/10">
        <div className="flex items-center gap-4 flex-1 max-w-xl">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-cream border border-ink-900/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-2 bg-surface-cream border border-ink-900/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            <option value="created">Sort by Created</option>
            <option value="name">Sort by Name</option>
            <option value="model">Sort by Model</option>
          </select>
        </div>
        <button
          onClick={onCreateAgent}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Agent
        </button>
      </div>

      {/* Agent grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-3 text-ink-600">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Loading agents...</span>
            </div>
          </div>
        ) : sortedAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-ink-600">
            {searchQuery ? (
              <>
                <svg className="w-12 h-12 mb-4 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-sm">No agents match "{searchQuery}"</p>
              </>
            ) : (
              <>
                <svg className="w-12 h-12 mb-4 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="text-sm mb-4">No agents found</p>
                <button
                  onClick={onCreateAgent}
                  className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
                >
                  Create your first agent
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onClick={() => onSelectAgent(agent.id)}
                isFavorite={favoriteAgentId === agent.id}
                onToggleFavorite={onSetFavorite ? (e) => {
                  e.stopPropagation();
                  onSetFavorite(favoriteAgentId === agent.id ? null : agent.id);
                } : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-ink-900/10 bg-surface-cream text-xs text-ink-500">
        <span>{agents.length} agent{agents.length !== 1 ? 's' : ''} total</span>
        <span>{filteredAgents.length} shown</span>
      </div>
    </div>
  );
}

function relativeTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diff = Date.now() - then;
  const min = 60_000, hr = 60 * min, day = 24 * hr;
  if (diff < min) return 'just now';
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function statusForLastRun(iso: string | null | undefined): { dot: string; label: string } {
  if (!iso) return { dot: 'bg-ink-400', label: 'Never run' };
  const diff = Date.now() - new Date(iso).getTime();
  const hr = 60 * 60 * 1000;
  if (diff < 6 * hr) return { dot: 'bg-green-500', label: 'Active' };
  if (diff < 7 * 24 * hr) return { dot: 'bg-amber-500', label: 'Idle' };
  return { dot: 'bg-ink-400', label: 'Stale' };
}

interface AgentCardProps {
  agent: AgentSummary;
  onClick: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
}

function AgentCard({ agent, onClick, isFavorite, onToggleFavorite }: AgentCardProps) {
  const modelDisplay = agent.model
    ? agent.model.split('/').pop()?.split(':')[0] || agent.model
    : 'Unknown';
  const status = statusForLastRun(agent.lastRun);
  const lastRunRel = relativeTime(agent.lastRun);
  const createdRel = relativeTime(agent.createdAt);

  return (
    <div
      onClick={onClick}
      className="group p-4 bg-surface border border-ink-900/10 rounded-xl cursor-pointer hover:border-accent/50 hover:shadow-sm transition-all flex flex-col"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent font-semibold text-sm shrink-0">
            {agent.name.slice(0, 2).toUpperCase()}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface ${status.dot}`}
              title={status.label}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-medium text-ink-900 text-sm line-clamp-1">{agent.name}</h3>
              {agent.memfsEnabled && (
                <span
                  className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-medium uppercase tracking-wide"
                  title="git-memory-enabled — agent uses memfs (git-backed memory)"
                >
                  memfs
                </span>
              )}
            </div>
            <p className="text-xs text-ink-500 font-mono line-clamp-1">{modelDisplay}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Favorite star button */}
          {onToggleFavorite && (
            <button
              onClick={onToggleFavorite}
              className={`p-1.5 rounded-md transition-colors ${
                isFavorite
                  ? 'text-amber-500 hover:text-amber-600'
                  : 'text-ink-400 opacity-0 group-hover:opacity-100 hover:text-amber-500'
              }`}
              title={isFavorite ? 'Unfavorite (remove from home)' : 'Favorite (set as home agent)'}
            >
              <svg className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
          )}
          <svg
            className="w-4 h-4 text-ink-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {agent.description ? (
        <p className="text-xs text-ink-600 line-clamp-2 mb-3 min-h-[2rem]">{agent.description}</p>
      ) : (
        <p className="text-xs text-ink-400 italic mb-3 min-h-[2rem]">No description</p>
      )}

      <div className="mt-auto pt-2 border-t border-ink-900/5 flex items-center justify-between text-xs text-ink-500">
        <div className="flex items-center gap-3">
          {agent.toolCount !== undefined && (
            <span className="flex items-center gap-1" title={`${agent.toolCount} tool${agent.toolCount !== 1 ? 's' : ''} attached`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
              </svg>
              {agent.toolCount}
            </span>
          )}
          {agent.staleConversationCount !== undefined && agent.staleConversationCount > 0 && (
            <span
              className="flex items-center gap-1 text-amber-700"
              title={`${agent.staleConversationCount} conversation${agent.staleConversationCount === 1 ? '' : 's'} idle ≥2 weeks. Open the agent to wrap them up.`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3M3.05 11a9 9 0 1117.45 4M21 21v-5h-5" />
              </svg>
              {agent.staleConversationCount} stale
            </span>
          )}
          {lastRunRel ? (
            <span className="flex items-center gap-1" title={`Last run: ${new Date(agent.lastRun!).toLocaleString()}`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {lastRunRel}
            </span>
          ) : createdRel && (
            <span className="flex items-center gap-1" title={`Created: ${new Date(agent.createdAt!).toLocaleString()}`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              new · {createdRel}
            </span>
          )}
        </div>
        <span className={`text-[10px] font-medium uppercase tracking-wide ${
          status.label === 'Active' ? 'text-green-600' :
          status.label === 'Idle' ? 'text-amber-600' : 'text-ink-400'
        }`}>
          {status.label}
        </span>
      </div>
    </div>
  );
}
