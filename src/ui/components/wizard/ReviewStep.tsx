interface ReviewStepProps {
  name: string;
  description: string;
  model: string;
  toolCount: number;
  includeBaseTools: boolean;
  systemPrompt: string;
}

export function ReviewStep({
  name,
  description,
  model,
  toolCount,
  includeBaseTools,
  systemPrompt,
}: ReviewStepProps) {
  const modelDisplay = model
    ? model.split('/').pop()?.split(':')[0] || model
    : 'Default (Letta)';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-ink-800">Review & Create</h3>
        <p className="mt-1 text-sm text-ink-500">
          Confirm your agent configuration before creating.
        </p>
      </div>

      {/* Review Card */}
      <div className="rounded-xl border border-ink-200 bg-white overflow-hidden">
        {/* Name */}
        <div className="px-4 py-3 border-b border-ink-100">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-500">Name</span>
          <p className="mt-1 text-sm font-medium text-ink-800">{name}</p>
        </div>

        {/* Description */}
        {description && (
          <div className="px-4 py-3 border-b border-ink-100">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
              Description
            </span>
            <p className="mt-1 text-sm text-ink-700">{description}</p>
          </div>
        )}

        {/* Model */}
        <div className="px-4 py-3 border-b border-ink-100">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-500">Model</span>
          <div className="mt-1">
            <span className="inline-flex items-center rounded-md bg-accent/10 px-2 py-1 text-sm font-medium text-accent">
              {modelDisplay}
            </span>
          </div>
        </div>

        {/* Tools */}
        <div className="px-4 py-3 border-b border-ink-100">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-500">Tools</span>
          <p className="mt-1 text-sm text-ink-700">
            {toolCount} custom tool{toolCount !== 1 ? 's' : ''}
            {includeBaseTools && (
              <span className="text-ink-500"> + base tools (memory, archival)</span>
            )}
          </p>
        </div>

        {/* System Prompt */}
        <div className="px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
            System Prompt
          </span>
          {systemPrompt ? (
            <div className="mt-1 rounded-md bg-ink-50 p-2">
              <p className="text-xs font-mono text-ink-600 line-clamp-4">{systemPrompt}</p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-ink-500 italic">Default (Letta built-in)</p>
          )}
        </div>
      </div>

      {/* Note */}
      <div className="rounded-lg bg-accent/5 border border-accent/20 p-3">
        <p className="text-xs text-accent">
          After creation, you can fine-tune all parameters (temperature, context window,
          reasoning, etc.) in the Agent Detail view.
        </p>
      </div>
    </div>
  );
}

export default ReviewStep;
