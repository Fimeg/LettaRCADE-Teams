import { useState, useCallback, useEffect } from "react";
import { useAppStore, type MemoryBlock } from "../store/useAppStore";
import { useSacredBlocks } from "../hooks/useSacredBlocks";
import { calculateMemoryHealth, classifyTier, tierColors } from "../utils/memoryHealth";
import { MemoryPressureGauge } from "./MemoryPressureGauge";
import { BlockPressureIndicator } from "./BlockPressureIndicator";
import { SacredToggle } from "./SacredToggle";
import { agentsApi } from "../services/api";

interface AgentMemoryPanelProps {
  agentId: string;
  /** @deprecated kept for call-site compatibility; the api client owns the base URL */
  apiUrl?: string;
}

type MemoryTab = "core" | "archival" | "sources";

interface EditingState {
  blockId: string | null;
  draftValue: string;
  isSaving: boolean;
  error: string | null;
}

interface Passage {
  id: string;
  text: string;
  createdAt: string | null;
  tags: string[];
  score?: number;
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

  // Archival memory state
  const [passages, setPassages] = useState<Passage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newPassageText, setNewPassageText] = useState("");
  const [isInserting, setIsInserting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Curator / Memory Health state
  const { toggleSacred, isSacred, loaded: sacredLoaded } = useSacredBlocks(agentId);

  // Store integration
  const agent = useAppStore((s) => s.agents[agentId]);
  const updateMemoryBlock = useAppStore((s) => s.updateMemoryBlock);

  const memoryBlocks = agent?.memoryBlocks ?? [];

  // ═══ Archival Memory API Functions ═══
  const [passageError, setPassageError] = useState<string | null>(null);
  const [passageToDelete, setPassageToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const searchArchival = async () => {
    setPassageError(null);
    setIsSearching(true);
    try {
      const results = await agentsApi.getPassages(agentId, searchQuery.trim() || undefined, 20);
      // SDK 0.1.14 Passage shape may differ from local Passage type; normalize.
      const normalized: Passage[] = (results as unknown as Array<{
        id: string;
        text: string;
        created_at?: string;
        createdAt?: string;
        tags?: string[] | null;
        score?: number;
      }>).map((p) => ({
        id: p.id,
        text: p.text,
        createdAt: p.createdAt ?? p.created_at ?? null,
        tags: p.tags ?? [],
        score: p.score,
      }));
      setPassages(normalized);
    } catch (err) {
      setPassageError(err instanceof Error ? err.message : 'Failed to load passages');
    } finally {
      setIsSearching(false);
    }
  };

  const insertPassage = async () => {
    if (!newPassageText.trim()) return;
    setIsInserting(true);
    setPassageError(null);
    try {
      await agentsApi.createPassage(agentId, newPassageText.trim());
      setNewPassageText("");
      await searchArchival();
    } catch (err) {
      setPassageError(err instanceof Error ? err.message : 'Failed to create passage');
    } finally {
      setIsInserting(false);
    }
  };

  const deletePassage = async (passageId: string) => {
    setIsDeleting(true);
    setPassageError(null);
    try {
      await agentsApi.deletePassage(agentId, passageId);
      setPassageToDelete(null);
      await searchArchival();
    } catch (err) {
      setPassageError(err instanceof Error ? err.message : 'Failed to delete passage');
    } finally {
      setIsDeleting(false);
    }
  };

  // Load passages when switching to archival tab
  useEffect(() => {
    if (activeTab === "archival" && agentId) {
      searchArchival();
    }
  }, [activeTab, agentId]);

  // Calculate memory health from blocks
  const memoryHealth = calculateMemoryHealth(memoryBlocks);

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
      draftValue: block.value || '',
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
    if ((block.value || '') === editing.draftValue) {
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
          <button
            onClick={() => setActiveTab("sources")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === "sources"
                ? "bg-accent text-white"
                : "text-ink-600 hover:bg-ink-900/5"
            }`}
          >
            SOURCES
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "core" && (
          <>
            {/* Memory Health Indicator */}
            <div className="mb-4 rounded-xl border border-ink-900/10 bg-surface-secondary p-4">
              <div className="text-xs font-medium text-ink-700 mb-3">Memory Pressure</div>
              <MemoryPressureGauge health={memoryHealth} />
              {memoryHealth.needsAttention && (
                <div className="mt-3 flex items-center gap-2 text-xs text-amber-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Memory needs attention</span>
                </div>
              )}
            </div>

            {memoryBlocks.length === 0 ? (
              <div className="rounded-xl border border-ink-900/10 bg-surface-secondary px-4 py-8 text-center">
                <p className="text-sm text-muted">No memory blocks configured</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {memoryBlocks.map((block) => {
                  const tier = classifyTier(block.label);
                  const isExpanded = expandedBlocks.has(block.id);
                  const isEditing = editing.blockId === block.id;
                  const blockValue = block.value || '';
                  const displayValue = isExpanded
                    ? blockValue
                    : blockValue.length > 100
                    ? `${blockValue.slice(0, 100)}...`
                    : blockValue;

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
                          {/* Tier Classification Badge */}
                          {tier !== "default" && (
                            <span
                              className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded text-white"
                              style={{ background: tierColors[tier] }}
                            >
                              {tier}
                            </span>
                          )}
                          {/* Block Pressure Indicator */}
                          {block.limit !== undefined && block.limit > 0 && (
                            <BlockPressureIndicator block={block} showBar={true} />
                          )}
                          {/* Sacred Block Toggle */}
                          <SacredToggle
                            blockLabel={block.label}
                            isSacred={isSacred(block.label)}
                            onToggle={() => toggleSacred(block.label)}
                            disabled={!sacredLoaded}
                          />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Expand/Collapse button */}
                          {(block.value || '').length > 100 && !isEditing && (
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
                            {!isExpanded && (block.value || '').length > 100 && (
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
        )}

        {activeTab === "archival" && (
          <div className="flex flex-col gap-4">
            {/* Error display */}
            {passageError && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                {passageError}
              </div>
            )}

            {/* Insert passage */}
            <div className="space-y-2">
              <textarea
                value={newPassageText}
                onChange={(e) => setNewPassageText(e.target.value)}
                placeholder="Add a passage to archival memory..."
                rows={3}
                className="w-full rounded-lg border border-ink-900/10 bg-surface px-3 py-2 text-xs text-ink-800 focus:border-accent focus:outline-none resize-vertical"
              />
              <button
                onClick={insertPassage}
                disabled={isInserting || !newPassageText.trim()}
                className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isInserting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Adding...
                  </span>
                ) : (
                  "Add to Archival Memory"
                )}
              </button>
            </div>

            {/* Search */}
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchArchival()}
                placeholder="Search archival memory..."
                className="flex-1 rounded-lg border border-ink-900/10 bg-surface px-3 py-2 text-xs text-ink-800 focus:border-accent focus:outline-none"
              />
              <button
                onClick={searchArchival}
                disabled={isSearching}
                className="px-3 py-2 text-xs font-medium rounded-lg bg-surface-tertiary text-ink-700 hover:bg-ink-900/10 transition-colors disabled:opacity-50"
              >
                {isSearching ? (
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Passage list */}
            <div className="flex flex-col gap-2">
              {passages.length === 0 ? (
                <p className="text-sm text-muted text-center py-4">No archival memories found.</p>
              ) : (
                passages.map((passage) => (
                  <div key={passage.id} className="rounded-lg border border-ink-900/10 bg-surface-secondary p-3">
                    <pre className="text-xs text-ink-700 font-mono whitespace-pre-wrap break-words leading-relaxed">
                      {passage.text}
                    </pre>
                    <div className="flex items-center gap-2 mt-2 flex-wrap justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        {passage.createdAt && (
                          <span className="text-xs text-muted">
                            {new Date(passage.createdAt).toLocaleDateString()}
                          </span>
                        )}
                        {passage.score !== undefined && (
                          <span className="text-xs text-accent font-medium">
                            Score: {passage.score.toFixed(3)}
                          </span>
                        )}
                        {passage.tags.length > 0 &&
                          passage.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent"
                            >
                              {tag}
                            </span>
                          ))}
                      </div>
                      <button
                        onClick={() => setPassageToDelete(passage.id)}
                        className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                        title="Delete passage"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Delete confirmation modal */}
            {passageToDelete && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="rounded-xl bg-surface p-4 shadow-lg max-w-sm mx-4">
                  <p className="text-sm text-ink-800 mb-4">Delete this passage from archival memory?</p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setPassageToDelete(null)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-tertiary text-ink-600 hover:bg-ink-900/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => deletePassage(passageToDelete)}
                      disabled={isDeleting}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "sources" && (
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
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <p className="text-sm text-muted">Sources management coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}
