import { useState, useCallback } from "react";
import { useAppStore, type MemoryBlock } from "../store/useAppStore";

interface AgentMemoryPanelProps {
  agentId: string;
}

type MemoryTab = "core" | "archival";

interface EditingState {
  blockId: string | null;
  draftValue: string;
  isSaving: boolean;
  error: string | null;
}

export function AgentMemoryPanel({ agentId }: AgentMemoryPanelProps) {
  const [activeTab, setActiveTab] = useState<MemoryTab>("core");
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditingState>({
    blockId: null,
    draftValue: "",
    isSaving: false,
    error: null,
  });

  // Store integration
  const agent = useAppStore((s) => s.agents[agentId]);
  const updateMemoryBlock = useAppStore((s) => s.updateMemoryBlock);

  const memoryBlocks = agent?.memoryBlocks ?? [];

  // Toggle block expansion
  const toggleExpanded = useCallback((blockId: string) => {
    setExpandedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  }, []);

  // Start editing a block
  const startEdit = useCallback((block: MemoryBlock) => {
    setEditing({
      blockId: block.id,
      draftValue: block.value,
      isSaving: false,
      error: null,
    });
  }, []);

  // Cancel editing
  const cancelEdit = useCallback(() => {
    setEditing({
      blockId: null,
      draftValue: "",
      isSaving: false,
      error: null,
    });
  }, []);

  // Save the edited block
  const saveEdit = useCallback(async () => {
    if (!editing.blockId || !agent) return;

    const block = memoryBlocks.find((b) => b.id === editing.blockId);
    if (!block) return;

    // Don't save if value hasn't changed
    if (block.value === editing.draftValue) {
      cancelEdit();
      return;
    }

    setEditing((prev) => ({ ...prev, isSaving: true, error: null }));

    try {
      await updateMemoryBlock(agentId, block.label, editing.draftValue);
      // On success, exit edit mode
      setEditing({
        blockId: null,
        draftValue: "",
        isSaving: false,
        error: null,
      });
    } catch (err) {
      setEditing((prev) => ({
        ...prev,
        isSaving: false,
        error: err instanceof Error ? err.message : "Failed to save memory block",
      }));
    }
  }, [editing, agent, agentId, memoryBlocks, updateMemoryBlock, cancelEdit]);

  // Get color coding for block type
  const getBlockColor = (label: string): string => {
    switch (label.toLowerCase()) {
      case "human":
        return "border-l-4 border-l-blue-500";
      case "persona":
        return "border-l-4 border-l-purple-500";
      default:
        return "border-l-4 border-l-gray-400";
    }
  };

  // Get background tint for block type
  const getBlockBg = (label: string): string => {
    switch (label.toLowerCase()) {
      case "human":
        return "bg-blue-50/50 dark:bg-blue-900/10";
      case "persona":
        return "bg-purple-50/50 dark:bg-purple-900/10";
      default:
        return "";
    }
  };

  // Calculate character count color based on limit
  const getCharCountColor = (current: number, limit?: number): string => {
    if (!limit) return "text-muted";
    const ratio = current / limit;
    if (ratio > 1) return "text-red-600 font-medium";
    if (ratio > 0.9) return "text-orange-500 font-medium";
    if (ratio > 0.8) return "text-amber-500";
    return "text-muted";
  };

  if (!agent) {
    return (
      <div className="h-full bg-surface p-4">
        <div className="rounded-xl border border-ink-900/10 bg-surface-secondary px-4 py-8 text-center">
          <p className="text-sm text-muted">No agent selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-surface flex flex-col">
      {/* Header with tabs */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink-900/10">
        <h2 className="text-sm font-semibold text-ink-900">Memory</h2>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("core")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === "core"
                ? "bg-accent text-white"
                : "text-ink-600 hover:bg-ink-900/5"
            }`}
          >
            CORE
          </button>
          <button
            onClick={() => setActiveTab("archival")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === "archival"
                ? "bg-accent text-white"
                : "text-ink-600 hover:bg-ink-900/5"
            }`}
          >
            ARCHIVAL
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "core" ? (
          <>
            {memoryBlocks.length === 0 ? (
              <div className="rounded-xl border border-ink-900/10 bg-surface-secondary px-4 py-8 text-center">
                <p className="text-sm text-muted">No memory blocks configured</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {memoryBlocks.map((block) => {
                  const isExpanded = expandedBlocks.has(block.id);
                  const isEditing = editing.blockId === block.id;
                  const displayValue = isExpanded
                    ? block.value
                    : block.value.length > 100
                    ? `${block.value.slice(0, 100)}...`
                    : block.value;

                  return (
                    <div
                      key={block.id}
                      className={`rounded-xl border border-ink-900/10 bg-surface-secondary overflow-hidden transition-all hover:border-ink-900/20 ${getBlockColor(
                        block.label
                      )} ${getBlockBg(block.label)}`}
                    >
                      {/* Block header */}
                      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-ink-900/5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-ink-800 truncate">
                            {block.label}
                          </span>
                          {block.limit !== undefined && (
                            <span className="text-xs text-muted px-1.5 py-0.5 rounded bg-ink-900/5">
                              Limit: {block.limit}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Expand/Collapse button */}
                          {block.value.length > 100 && !isEditing && (
                            <button
                              onClick={() => toggleExpanded(block.id)}
                              className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-900/10 hover:text-accent transition-colors"
                              aria-label={isExpanded ? "Collapse" : "Expand"}
                              title={isExpanded ? "Collapse" : "Expand"}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className={`h-3.5 w-3.5 transition-transform ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M6 9l6 6 6-6" />
                              </svg>
                            </button>
                          )}

                          {/* Edit button */}
                          {!isEditing && (
                            <button
                              onClick={() => startEdit(block)}
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

                      {/* Block content */}
                      <div className="px-3 py-3">
                        {isEditing ? (
                          /* Edit mode */
                          <div className="space-y-3">
                            <textarea
                              value={editing.draftValue}
                              onChange={(e) =>
                                setEditing((prev) => ({
                                  ...prev,
                                  draftValue: e.target.value,
                                }))
                              }
                              rows={8}
                              disabled={editing.isSaving}
                              className="w-full rounded-lg border border-ink-900/10 bg-surface px-3 py-2 text-xs font-mono text-ink-800 focus:border-accent focus:outline-none resize-vertical disabled:opacity-50"
                              placeholder={`Enter ${block.label} memory content...`}
                            />

                            {/* Character count */}
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-xs ${getCharCountColor(
                                  editing.draftValue.length,
                                  block.limit
                                )}`}
                              >
                                {block.limit
                                  ? `${editing.draftValue.length} / ${block.limit} characters`
                                  : `${editing.draftValue.length} characters`}
                              </span>

                              {/* Error message */}
                              {editing.error && (
                                <span className="text-xs text-red-600">
                                  {editing.error}
                                </span>
                              )}
                            </div>

                            {/* Save/Cancel buttons */}
                            <div className="flex gap-2">
                              <button
                                onClick={saveEdit}
                                disabled={editing.isSaving}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {editing.isSaving ? (
                                  <>
                                    <svg
                                      className="h-3 w-3 animate-spin"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                    >
                                      <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                      />
                                      <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                      />
                                    </svg>
                                    Saving...
                                  </>
                                ) : (
                                  "Save"
                                )}
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={editing.isSaving}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-tertiary text-ink-600 hover:bg-ink-900/10 transition-colors disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* View mode */
                          <>
                            <div
                              className="text-xs text-ink-600 font-mono whitespace-pre-wrap break-words leading-relaxed cursor-pointer hover:text-ink-800"
                              onClick={() => startEdit(block)}
                            >
                              {displayValue}
                            </div>
                            {!isExpanded && block.value.length > 100 && (
                              <button
                                onClick={() => toggleExpanded(block.id)}
                                className="mt-2 text-xs text-accent hover:text-accent-hover transition-colors"
                              >
                                Show more
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Archival tab placeholder */
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <svg
              className="h-10 w-10 text-ink-300 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <p className="text-sm text-muted">
              Archival memory search coming soon
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
