import { useState } from 'react';
import type { AgentSummary } from '../store/useAppStore';
import { AgentCard } from './ui/business/AgentCard';

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
                agent={{
                  id: agent.id,
                  name: agent.name,
                  description: agent.description,
                  model: agent.model,
                  toolCount: agent.toolCount,
                  createdAt: agent.createdAt,
                  lastRun: agent.lastRun,
                  memfsEnabled: agent.memfsEnabled,
                  staleConversationCount: agent.staleConversationCount,
                }}
                variant="full"
                onSelect={() => onSelectAgent(agent.id)}
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
