import { useState } from "react";
import type { MemoryBlock } from "../store/useAppStore";

interface MemoryBlockListProps {
  blocks: MemoryBlock[];
  readOnly?: boolean;
  onEditBlock?: (block: MemoryBlock) => void;
}

export function MemoryBlockList({ blocks, readOnly = true, onEditBlock }: MemoryBlockListProps) {
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);

  if (blocks.length === 0) {
    return (
      <div className="rounded-xl border border-ink-900/5 bg-surface-secondary px-4 py-6 text-center">
        <p className="text-sm text-muted">No memory blocks configured</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block) => {
        const isExpanded = expandedBlock === block.id;
        const displayValue = isExpanded
          ? block.value
          : block.value.length > 100
            ? `${block.value.slice(0, 100)}...`
            : block.value;

        return (
          <div
            key={block.id}
            className="rounded-xl border border-ink-900/5 bg-surface-secondary p-3 transition-colors hover:border-ink-900/10"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0 text-accent"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                <span className="text-sm font-medium text-ink-800 truncate">
                  {block.label}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {block.limit !== undefined && (
                  <span className="text-xs text-muted px-1.5 py-0.5 rounded bg-surface-tertiary">
                    Limit: {block.limit}
                  </span>
                )}
                {!readOnly && onEditBlock && (
                  <button
                    onClick={() => onEditBlock(block)}
                    className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-900/10 hover:text-accent transition-colors"
                    aria-label="Edit memory block"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <div className="mt-2 text-xs text-ink-600 font-mono whitespace-pre-wrap break-words leading-relaxed">
              {displayValue}
            </div>
            {block.value.length > 100 && (
              <button
                onClick={() => setExpandedBlock(isExpanded ? null : block.id)}
                className="mt-2 text-xs text-accent hover:text-accent-hover transition-colors"
              >
                {isExpanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
