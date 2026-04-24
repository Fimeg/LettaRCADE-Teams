interface WizardData {
  name: string;
  description: string;
  tags: string;
  model: string;
  systemPrompt: string;
  selectedTools: string[];
}

interface ReviewStepProps {
  data: WizardData;
  onEdit: (step: number) => void;
  onCreate: () => void;
  isCreating: boolean;
  error: string | null;
}

export function ReviewStep({ data, onEdit, onCreate, isCreating, error }: ReviewStepProps) {
  const tagList = data.tags.split(',').map(t => t.trim()).filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Error Display */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Review Card */}
      <div className="rounded-xl border border-ink-900/10 bg-surface-secondary overflow-hidden">
        {/* Basic Info Section */}
        <div className="flex items-center justify-between p-4 border-b border-ink-900/10">
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">Basic Info</p>
            <h3 className="text-lg font-semibold text-ink-900">{data.name}</h3>
            {data.description && (
              <p className="text-sm text-ink-600 mt-1">{data.description}</p>
            )}
            {tagList.length > 0 && (
              <div className="flex gap-1 mt-2">
                {tagList.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => onEdit(1)}
            className="text-xs text-accent hover:text-accent-hover px-3 py-1.5 rounded-lg hover:bg-accent/10 transition-colors"
          >
            Edit
          </button>
        </div>

        {/* Model Section */}
        <div className="flex items-center justify-between p-4 border-b border-ink-900/10">
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">Model</p>
            <p className="text-sm font-medium text-ink-800">{data.model}</p>
          </div>
          <button
            onClick={() => onEdit(2)}
            className="text-xs text-accent hover:text-accent-hover px-3 py-1.5 rounded-lg hover:bg-accent/10 transition-colors"
          >
            Edit
          </button>
        </div>

        {/* System Prompt Section */}
        <div className="flex items-start justify-between p-4 border-b border-ink-900/10">
          <div className="flex-1 mr-4">
            <p className="text-xs text-muted uppercase tracking-wide mb-2">System Prompt</p>
            <pre className="text-xs text-ink-600 font-mono whitespace-pre-wrap bg-surface p-3 rounded-lg border border-ink-900/10">
              {data.systemPrompt || '(No system prompt set)'}
            </pre>
          </div>
          <button
            onClick={() => onEdit(3)}
            className="text-xs text-accent hover:text-accent-hover px-3 py-1.5 rounded-lg hover:bg-accent/10 transition-colors shrink-0"
          >
            Edit
          </button>
        </div>

        {/* Tools Section */}
        <div className="flex items-start justify-between p-4">
          <div>
            <p className="text-xs text-muted uppercase tracking-wide mb-2">Tools</p>
            {data.selectedTools.length === 0 ? (
              <p className="text-sm text-muted">No tools selected</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {data.selectedTools.map((tool) => (
                  <span
                    key={tool}
                    className="text-xs px-2 py-0.5 rounded bg-ink-900/5 text-ink-600"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => onEdit(4)}
            className="text-xs text-accent hover:text-accent-hover px-3 py-1.5 rounded-lg hover:bg-accent/10 transition-colors shrink-0"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Create Button */}
      <button
        onClick={onCreate}
        disabled={isCreating}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isCreating ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Creating Agent...
          </>
        ) : (
          'Create Agent'
        )}
      </button>
    </div>
  );
}
