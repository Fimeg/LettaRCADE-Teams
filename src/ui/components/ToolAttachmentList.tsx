import type { ToolAttachment } from "../store/useAppStore";

interface ToolAttachmentListProps {
  tools: ToolAttachment[];
  readOnly?: boolean;
  onToggleTool?: (toolId: string, enabled: boolean) => void;
}

export function ToolAttachmentList({
  tools,
  readOnly = true,
  onToggleTool,
}: ToolAttachmentListProps) {
  if (tools.length === 0) {
    return (
      <div className="rounded-xl border border-ink-900/5 bg-surface-secondary px-4 py-6 text-center">
        <p className="text-sm text-muted">No tools attached</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {tools.map((tool) => (
        <div
          key={tool.id}
          className={`rounded-xl border p-3 transition-colors ${
            tool.enabled
              ? "border-accent/20 bg-accent-subtle"
              : "border-ink-900/5 bg-surface-secondary"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <svg
                viewBox="0 0 24 24"
                className={`h-4 w-4 shrink-0 ${
                  tool.enabled ? "text-accent" : "text-ink-500"
                }`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              <span
                className={`text-sm font-medium truncate ${
                  tool.enabled ? "text-ink-800" : "text-ink-600"
                }`}
              >
                {tool.name}
              </span>
            </div>
            {!readOnly && onToggleTool && (
              <button
                onClick={() => onToggleTool(tool.id, !tool.enabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  tool.enabled ? "bg-accent" : "bg-ink-400"
                }`}
                aria-label={tool.enabled ? "Disable tool" : "Enable tool"}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    tool.enabled ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            )}
            {readOnly && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${
                  tool.enabled
                    ? "bg-accent/10 text-accent"
                    : "bg-ink-900/5 text-ink-500"
                }`}
              >
                {tool.enabled ? "Active" : "Inactive"}
              </span>
            )}
          </div>
          {tool.description && (
            <p className="mt-1.5 text-xs text-ink-500 line-clamp-2">
              {tool.description}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
