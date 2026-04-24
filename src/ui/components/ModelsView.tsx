import { useState, useEffect, useCallback } from "react";
import { agentsApi } from "../services/api";

interface ModelRow {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
}

export function ModelsView() {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await agentsApi.listAllModels();
      setModels(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load models");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const providers = Array.from(new Set(models.map((m) => m.provider).filter(Boolean)));
  const q = filter.toLowerCase();
  const filtered = models.filter(
    (m) => !q || m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-ink-600">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading models...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full p-6 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
          <button
            onClick={fetchModels}
            className="mt-3 px-3 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-ink-900">Models ({models.length})</h2>
          <input
            type="text"
            placeholder="Filter by name or provider..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-72 px-3 py-2 text-sm rounded-lg border border-ink-900/10 bg-surface focus:border-accent focus:outline-none"
          />
        </div>

        {providers.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button
              onClick={() => setFilter("")}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                !filter
                  ? "bg-accent text-white border-accent"
                  : "border-ink-900/10 text-ink-700 hover:bg-ink-900/5"
              }`}
            >
              All
            </button>
            {providers.map((p) => (
              <button
                key={p}
                onClick={() => setFilter(filter === p ? "" : p)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  filter === p
                    ? "bg-accent text-white border-accent"
                    : "border-ink-900/10 text-ink-700 hover:bg-ink-900/5"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-ink-900/10 bg-surface overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr] px-4 py-3 border-b border-ink-900/10 bg-surface-cream text-xs font-semibold text-ink-700 uppercase tracking-wide">
            <span>Model</span>
            <span>Provider</span>
            <span>Context</span>
          </div>
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-center text-ink-500">
              No models match filter
            </div>
          ) : (
            filtered.map((m) => (
              <div
                key={m.id}
                className="grid grid-cols-[2fr_1fr_1fr] px-4 py-3 border-b border-ink-900/5 last:border-b-0 hover:bg-ink-900/[0.02] transition-colors"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-ink-900">{m.name}</span>
                  <code className="text-xs text-ink-500 font-mono">{m.id}</code>
                </div>
                <span className="text-sm text-ink-700 self-center">{m.provider || "—"}</span>
                <span className="text-sm text-ink-700 self-center">
                  {m.contextWindow ? `${(m.contextWindow / 1000).toFixed(0)}k` : "—"}
                </span>
              </div>
            ))
          )}
        </div>

        <p className="mt-4 text-xs text-ink-500">
          Models are backend options — attach any model to any agent when you create it.
        </p>
      </div>
    </div>
  );
}
