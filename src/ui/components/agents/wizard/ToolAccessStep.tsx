import { useState, useEffect } from 'react';
import { getLettaClient } from '../../../services/api';
import type { Letta } from '@letta-ai/letta-client';

interface ToolAccessStepProps {
  selectedTools: string[];
  onChange: (tools: string[]) => void;
}

interface Tool {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
}

export function ToolAccessStep({ selectedTools, onChange }: ToolAccessStepProps) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    try {
      setLoading(true);
      const client = getLettaClient();
      const allTools: Letta.Tool[] = [];
      for await (const t of client.tools.list()) allTools.push(t);
      // SDK Tool.name is string | null | undefined; coerce for local type.
      const normalized: Tool[] = allTools.map((t) => ({
        id: t.id,
        name: t.name ?? 'unnamed',
        description: t.description ?? undefined,
        tags: t.tags ?? undefined,
      }));
      setTools(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tools');
    } finally {
      setLoading(false);
    }
  };

  const toggleTool = (toolId: string) => {
    if (selectedTools.includes(toolId)) {
      onChange(selectedTools.filter((id) => id !== toolId));
    } else {
      onChange([...selectedTools, toolId]);
    }
  };

  const filteredTools = tools.filter(
    (t) =>
      t.name.toLowerCase().includes(filter.toLowerCase()) ||
      t.description?.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="flex items-center gap-2 text-muted">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm">Loading tools...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter tools..."
          className="flex-1 px-3 py-2 rounded-lg border border-ink-900/10 bg-surface focus:border-accent focus:outline-none"
        />
        <span className="ml-3 text-sm text-muted">
          {selectedTools.length} selected
        </span>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filteredTools.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">
            No tools found
          </p>
        ) : (
          filteredTools.map((tool) => (
            <label
              key={tool.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedTools.includes(tool.id)
                  ? 'border-accent bg-accent/5'
                  : 'border-ink-900/10 hover:border-ink-900/20'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedTools.includes(tool.id)}
                onChange={() => toggleTool(tool.id)}
                className="mt-0.5 w-4 h-4 rounded border-ink-300 text-accent focus:ring-accent"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-ink-800">{tool.name}</p>
                {tool.description && (
                  <p className="text-xs text-muted mt-0.5">{tool.description}</p>
                )}
                {tool.tags && tool.tags.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {tool.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-ink-900/5 text-ink-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
