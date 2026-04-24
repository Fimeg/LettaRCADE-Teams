import { useState } from 'react';
import type { AgentSummary } from '../store/useAppStore';

interface AgentsBrowserProps {
  agents: AgentSummary[];
  loading: boolean;
  onSelectAgent: (agentId: string) => void;
  onCreateAgent: () => void;
}

export function AgentsBrowser({ agents, loading, onSelectAgent, onCreateAgent }: AgentsBrowserProps) {
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

  return (
    <div className="h-full flex flex-col bg-surface">
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
              <AgentCard key={agent.id} agent={agent} onClick={() => onSelectAgent(agent.id)} />
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

function AgentCard({ agent, onClick }: { agent: AgentSummary; onClick: () => void }) {
  const modelDisplay = agent.model
    ? agent.model.split('/').pop()?.split(':')[0] || agent.model
    : 'Unknown';

  return (
    <div
      onClick={onClick}
      className="group p-4 bg-surface border border-ink-900/10 rounded-xl cursor-pointer hover:border-accent/50 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent font-semibold text-sm">
            {agent.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="font-medium text-ink-900 text-sm line-clamp-1">{agent.name}</h3>
            <p className="text-xs text-ink-500">{modelDisplay}</p>
          </div>
        </div>
        <svg
          className="w-4 h-4 text-ink-400 opacity-0 group-hover:opacity-100 transition-opacity"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>

      {agent.description && (
        <p className="text-xs text-ink-600 line-clamp-2 mb-3">{agent.description}</p>
      )}

      <div className="flex items-center gap-3 text-xs text-ink-500">
        {agent.toolCount !== undefined && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {agent.toolCount} tool{agent.toolCount !== 1 ? 's' : ''}
          </span>
        )}
        {agent.createdAt && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Date(agent.createdAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}
