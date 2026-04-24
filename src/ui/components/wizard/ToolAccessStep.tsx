import { useState, useEffect } from 'react';

interface Tool {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

const MOCK_TOOLS: Tool[] = [
  {
    id: 'web_search',
    name: 'Web Search',
    description: 'Search the web for current information',
    category: 'research',
  },
  {
    id: 'file_read',
    name: 'File Read',
    description: 'Read contents of files',
    category: 'files',
  },
  {
    id: 'file_write',
    name: 'File Write',
    description: 'Write or modify files',
    category: 'files',
  },
  {
    id: 'code_execute',
    name: 'Code Execution',
    description: 'Execute code in a sandboxed environment',
    category: 'code',
  },
  {
    id: 'calendar',
    name: 'Calendar',
    description: 'Access and manage calendar events',
    category: 'productivity',
  },
  {
    id: 'calculator',
    name: 'Calculator',
    description: 'Perform mathematical calculations',
    category: 'math',
  },
  {
    id: 'database_query',
    name: 'Database Query',
    description: 'Query connected databases',
    category: 'data',
  },
  {
    id: 'send_email',
    name: 'Send Email',
    description: 'Send emails through configured provider',
    category: 'communication',
  },
];

interface ToolAccessStepProps {
  selectedToolIds: string[];
  includeBaseTools: boolean;
  onToggleTool: (toolId: string) => void;
  onToggleBaseTools: (value: boolean) => void;
}

export function ToolAccessStep({
  selectedToolIds,
  includeBaseTools,
  onToggleTool,
  onToggleBaseTools,
}: ToolAccessStepProps) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchTools = async () => {
      try {
        const res = await fetch('/api/agents/tools');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.length > 0) {
            setTools(data.data);
          } else {
            setTools(MOCK_TOOLS);
          }
        } else {
          setTools(MOCK_TOOLS);
        }
      } catch {
        setTools(MOCK_TOOLS);
      } finally {
        setLoading(false);
      }
    };

    fetchTools();
  }, []);

  // Group tools by category
  const grouped = tools.reduce<Record<string, Tool[]>>((acc, tool) => {
    const cat = tool.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tool);
    return acc;
  }, {});

  // Filter tools by search
  const filteredTools = searchQuery
    ? tools.filter(
        (t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      )
    : tools;

  const categoryOrder = ['research', 'files', 'code', 'data', 'communication', 'productivity', 'math', 'other'];
  const sortedCategories = Object.keys(grouped).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <svg
          className="h-8 w-8 animate-spin text-accent"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
        </svg>
        <p className="mt-4 text-sm text-ink-500">Loading available tools...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-ink-800">Tool Access</h3>
        <p className="mt-1 text-sm text-ink-500">
          Select which tools this agent can use. Base tools (memory read/write) are included by
          default.
        </p>
      </div>

      {/* Base Tools Toggle */}
      <div className="flex items-center gap-3 rounded-lg bg-ink-50 border border-ink-200 p-3">
        <input
          type="checkbox"
          checked={includeBaseTools}
          onChange={(e) => onToggleBaseTools(e.target.checked)}
          className="h-4 w-4 rounded border-ink-300 text-accent focus:ring-accent"
        />
        <div>
          <p className="text-sm font-medium text-ink-800">Include base tools</p>
          <p className="text-xs text-ink-500">Core memory read/write, archival memory</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400"
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
          placeholder="Search tools..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white border border-ink-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
        />
      </div>

      {/* Tool Categories */}
      {searchQuery ? (
        // Show flat list when searching
        <div className="space-y-2">
          {filteredTools.length === 0 ? (
            <p className="text-sm text-ink-500 text-center py-4">No tools found</p>
          ) : (
            filteredTools.map((tool) => (
              <ToolItem
                key={tool.id}
                tool={tool}
                isSelected={selectedToolIds.includes(tool.id)}
                onToggle={() => onToggleTool(tool.id)}
              />
            ))
          )}
        </div>
      ) : (
        // Show grouped by category when not searching
        sortedCategories.map((category) => (
          <div key={category} className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {category}
            </h4>
            <div className="space-y-2">
              {grouped[category].map((tool) => (
                <ToolItem
                  key={tool.id}
                  tool={tool}
                  isSelected={selectedToolIds.includes(tool.id)}
                  onToggle={() => onToggleTool(tool.id)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Summary */}
      <div className="pt-4 border-t border-border">
        <p className="text-sm text-ink-600">
          <span className="font-medium">{selectedToolIds.length}</span> custom tool
          {selectedToolIds.length !== 1 ? 's' : ''} selected
          {includeBaseTools && ' + base tools'}
        </p>
      </div>
    </div>
  );
}

interface ToolItemProps {
  tool: Tool;
  isSelected: boolean;
  onToggle: () => void;
}

function ToolItem({ tool, isSelected, onToggle }: ToolItemProps) {
  return (
    <label
      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all hover:border-accent ${
        isSelected ? 'border-accent bg-accent/5' : 'border-ink-200 bg-white'
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 rounded border-ink-300 text-accent focus:ring-accent"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-800">{tool.name}</p>
        {tool.description && (
          <p className="text-xs text-ink-500 mt-0.5 truncate">{tool.description}</p>
        )}
      </div>
    </label>
  );
}

export default ToolAccessStep;
