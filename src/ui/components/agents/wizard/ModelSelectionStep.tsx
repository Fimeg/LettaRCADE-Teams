import { useState, useEffect } from 'react';
import { listLLMModels } from '../../../services/api';

interface ModelSelectionStepProps {
  selectedModel: string;
  onSelect: (model: string) => void;
}

interface ModelOption {
  id: string;
  name: string;
  provider: string;
  description?: string;
  contextWindow?: number;
}

export function ModelSelectionStep({ selectedModel, onSelect }: ModelSelectionStepProps) {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      setLoading(true);
      const agentModels = await listLLMModels();
      // Fallback to common models if API doesn't return models
      const fallbackModels: ModelOption[] = [
        { id: 'anthropic/claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'anthropic', contextWindow: 200000 },
        { id: 'anthropic/claude-opus-4-7-20251001', name: 'Claude Opus 4.7', provider: 'anthropic', contextWindow: 200000 },
        { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openai', contextWindow: 128000 },
        { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', contextWindow: 128000 },
      ];
      setModels(agentModels.length > 0 ? agentModels : fallbackModels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setLoading(false);
    }
  };

  const filteredModels = models.filter(m =>
    m.name.toLowerCase().includes(filter.toLowerCase()) ||
    m.provider.toLowerCase().includes(filter.toLowerCase())
  );

  const groupedModels = filteredModels.reduce((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = [];
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, ModelOption[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="flex items-center gap-2 text-muted">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm">Loading models...</span>
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
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter models..."
        className="w-full px-3 py-2 rounded-lg border border-ink-900/10 bg-surface focus:border-accent focus:outline-none"
      />

      <div className="space-y-4 max-h-[400px] overflow-y-auto">
        {Object.entries(groupedModels).map(([provider, providerModels]) => (
          <div key={provider}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
              {provider}
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {providerModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => onSelect(model.id)}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                    selectedModel === model.id
                      ? 'border-accent bg-accent/5'
                      : 'border-ink-900/10 hover:border-ink-900/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        selectedModel === model.id
                          ? 'border-accent'
                          : 'border-ink-300'
                      }`}
                    >
                      {selectedModel === model.id && (
                        <div className="w-2 h-2 rounded-full bg-accent" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink-800">{model.name}</p>
                      {model.contextWindow && (
                        <p className="text-xs text-muted">
                          Context: {(model.contextWindow / 1000).toFixed(0)}k tokens
                        </p>
                      )}
                    </div>
                  </div>
                  <code className="text-xs text-muted font-mono">{model.id}</code>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
