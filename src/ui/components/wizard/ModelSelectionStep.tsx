import { useState, useEffect } from 'react';

interface Model {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
}

interface ModelSelectionStepProps {
  selectedModel: string;
  onSelect: (model: string) => void;
}

const MOCK_MODELS: Model[] = [
  { id: 'gpt-4', name: 'GPT-4', provider: 'openai', contextWindow: 8192 },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', contextWindow: 128000 },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', contextWindow: 16385 },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic', contextWindow: 200000 },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'anthropic', contextWindow: 200000 },
  { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'anthropic', contextWindow: 200000 },
  { id: 'letta/letta-free', name: 'Letta Free', provider: 'letta', contextWindow: 8192 },
];

export function ModelSelectionStep({ selectedModel, onSelect }: ModelSelectionStepProps) {
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<Model[]>([]);
  const [filter, setFilter] = useState('');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    // Simulate API call to fetch models
    const fetchModels = async () => {
      try {
        const res = await fetch('/api/server/models');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.length > 0) {
            setModels(data.data);
          } else {
            setModels(MOCK_MODELS);
          }
        } else {
          setModels(MOCK_MODELS);
        }
      } catch {
        setModels(MOCK_MODELS);
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, []);

  const providers = [...new Set(models.map((m) => m.provider))].sort();

  const filtered = filter ? models.filter((m) => m.provider === filter) : models;

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
        <p className="mt-4 text-sm text-ink-500">Loading models...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-ink-800">Select Model</h3>
        <p className="mt-1 text-sm text-ink-500">
          Choose the LLM that will power this agent. Leave empty to use Letta&apos;s default.
        </p>
      </div>

      {/* Provider Filter */}
      {providers.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === ''
                ? 'bg-accent text-white'
                : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
            }`}
            onClick={() => setFilter('')}
          >
            All
          </button>
          {providers.map((p) => (
            <button
              key={p}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === p
                  ? 'bg-accent text-white'
                  : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
              }`}
              onClick={() => setFilter(p)}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Model Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map((model) => (
          <div
            key={model.id}
            className={`cursor-pointer rounded-lg border p-3 transition-all hover:border-accent ${
              selectedModel === model.id
                ? 'border-accent bg-accent/5'
                : 'border-ink-200 bg-white'
            }`}
            onClick={() => onSelect(model.id)}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                checked={selectedModel === model.id}
                onChange={() => onSelect(model.id)}
                className="mt-0.5 h-4 w-4 text-accent focus:ring-accent"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink-800">{model.name}</span>
                  <span className="rounded px-1.5 py-0.5 text-xs bg-ink-100 text-ink-600">
                    {model.provider}
                  </span>
                </div>
                {model.contextWindow && (
                  <p className="mt-1 text-xs text-ink-500">
                    {Math.round(model.contextWindow / 1000)}K context window
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-ink-500 text-sm">
          No models available{filter ? ` for ${filter}` : ''}
        </div>
      )}

      {/* Custom Endpoint Toggle */}
      <div className="pt-4 border-t border-border">
        <button
          className="flex items-center gap-2 text-sm text-accent hover:text-accent-hover"
          onClick={() => setShowCustom(!showCustom)}
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 transition-transform ${showCustom ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
          {showCustom ? 'Hide custom endpoint' : 'Use custom endpoint'}
        </button>

        {showCustom && (
          <div className="mt-3 space-y-2">
            <label className="block text-sm font-medium text-ink-700">Custom Model Endpoint</label>
            <input
              type="text"
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              placeholder="e.g., http://localhost:11434/v1"
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="text-xs text-ink-500">
              Enter a custom OpenAI-compatible endpoint URL
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ModelSelectionStep;
