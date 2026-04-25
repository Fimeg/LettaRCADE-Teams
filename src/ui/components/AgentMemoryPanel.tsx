import { useState, useCallback, useEffect, useMemo } from "react";
import { useAppStore, isMemfsEnabledAgent, type MemoryBlock } from "../store/useAppStore";
import { useSacredBlocks } from "../hooks/useSacredBlocks";
import { calculateMemoryHealth, classifyTier, tierColors } from "../utils/memoryHealth";
import { MemoryPressureGauge } from "./MemoryPressureGauge";
import { BlockPressureIndicator } from "./BlockPressureIndicator";
import { SacredToggle } from "./SacredToggle";
import { MemfsFileTree } from "./MemfsFileTree";
import { getLettaClient, getApiBase } from "../services/api";
import { ConfirmDialog } from "./ConfirmDialog";

interface AgentMemoryPanelProps {
  agentId: string;
  /** @deprecated kept for call-site compatibility; the api client owns the base URL */
  apiUrl?: string;
}

type MemoryTab = "core" | "archival";
type CoreViewMode = "blocks" | "files";  // For memfs-compatible agents

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

  // Store integration
  const agent = useAppStore((s) => s.agents[agentId]);
  const updateMemoryBlock = useAppStore((s) => s.updateMemoryBlock);
  const loadAgent = useAppStore((s) => s.loadAgent);

  // Curator / Memory Health state
  const { toggleSacred, isSacred, loaded: sacredLoaded } = useSacredBlocks(agentId);

  // Memfs / File tree view state
  const [coreViewMode, setCoreViewMode] = useState<CoreViewMode>("blocks");

  // /memfs enable confirmation modal — match the confirmation pattern used
  // by the per-agent settings panel on the left of the workspace. Memfs
  // activation is an irreversible-ish, agent-altering change; never one-click.
  const [showMemfsEnableConfirm, setShowMemfsEnableConfirm] = useState(false);
  const [memfsEnableNotice, setMemfsEnableNotice] = useState<string | null>(null);

  // Memory block edit confirmation — prevents accidental clobbering
  const [pendingSave, setPendingSave] = useState<{ blockLabel: string; original: string; draft: string } | null>(null);

  // Memfs activation: see isMemfsEnabledAgent in useAppStore for the full
  // signal hierarchy. We also pass the loaded memoryBlocks so a path-style
  // label (e.g. "system/skills/git.md") triggers memfs UI even when the
  // SDK's retrieve response doesn't include the canonical `memory.git_enabled`.
  const supportsMemfs = useMemo(
    () => isMemfsEnabledAgent({
      memory: (agent?.raw as { memory?: { git_enabled?: boolean } | null } | undefined)?.memory,
      tags: (agent?.raw as { tags?: string[] | null } | undefined)?.tags,
      memoryBlocks: agent?.memoryBlocks,
    }),
    [agent],
  );

  const residency = useMemo(() => {
    const base = getApiBase();
    let host = base;
    try { host = new URL(base).host; } catch { /* keep raw */ }
    const id = agent?.id ?? agentId;
    const shortId = id.length > 16 ? `${id.slice(0, 14)}…${id.slice(-4)}` : id;
    return { host, shortId };
  }, [agent, agentId]);

  const memoryBlocks = agent?.memoryBlocks ?? [];

  // Create a memory block on the server and attach it to this agent. Used for
  // memfs "new file" / "new folder" / "new block" actions — the SDK doesn't
  // expose a one-shot endpoint, so we create then attach.
  const createAndAttachBlock = async (label: string, value: string) => {
    const client = getLettaClient();
    const block = await client.blocks.create({ label, value });
    if (!block.id) throw new Error('Block creation returned no id');
    await client.agents.blocks.attach(block.id, { agent_id: agentId });
    return block;
  };

  // ═══ Archival Memory API Functions ═══
  const [passageError, setPassageError] = useState<string | null>(null);
  const [passageToDelete, setPassageToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const searchArchival = async () => {
    setPassageError(null);
    setIsSearching(true);
    try {
      const search = searchQuery.trim() || undefined;
      const options = search ? { search, limit: 20 } : { limit: 20 };
      const results = await getLettaClient().agents.passages.list(agentId, options);
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
      await getLettaClient().agents.passages.create(agentId, { text: newPassageText.trim() });
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
      await getLettaClient().agents.passages.delete(passageId, { agent_id: agentId });
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

  // Save the edited block — shows confirmation first to prevent accidental clobbering
  const saveEdit = useCallback(async () => {
    if (!editing.blockId || !agent) return;

    const block = memoryBlocks.find((b) => b.id === editing.blockId);
    if (!block) return;

    // Don't save if value hasn't changed
    if ((block.value || '') === editing.draftValue) {
      cancelEdit();
      return;
    }

    // Show confirmation with diff preview before saving
    setPendingSave({
      blockLabel: block.label,
      original: block.value || '',
      draft: editing.draftValue,
    });
  }, [editing, agent, memoryBlocks, cancelEdit]);

  // Actually perform the save after user confirms
  const confirmSave = useCallback(async () => {
    if (!pendingSave || !agent) return;

    setEditing((prev) => ({ ...prev, isSaving: true, error: null }));

    try {
      await updateMemoryBlock(agentId, pendingSave.blockLabel, pendingSave.draft);
      setPendingSave(null);
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
  }, [pendingSave, agent, agentId, updateMemoryBlock]);

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

      {/* Memory residency — where this memory actually lives.
          Shows storage backend, server host, and short agent id so the
          user can audit at a glance. */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-ink-900/10 bg-surface-cream/40 text-[11px] text-ink-600">
        <span
          className={`px-1.5 py-0.5 rounded font-medium uppercase tracking-wide ${
            supportsMemfs
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-ink-900/5 text-ink-500'
          }`}
          title={
            supportsMemfs
              ? 'memfs detected — agent uses git-backed memory with path-style block labels (files are the source of truth, blocks are a cache)'
              : 'No memfs signal — agent uses traditional flat memory blocks only'
          }
        >
          {supportsMemfs ? 'memfs' : 'blocks'}
        </span>
        <span className="text-ink-400">·</span>
        <span title="Connected Letta server (brain in a jar)">
          <span className="text-ink-400">server </span>
          <span className="font-mono">{residency.host}</span>
        </span>
        <span className="text-ink-400">·</span>
        <span title={agent?.id ?? agentId}>
          <span className="text-ink-400">agent </span>
          <span className="font-mono">{residency.shortId}</span>
        </span>
        <button
          onClick={() => navigator.clipboard?.writeText(agent?.id ?? agentId)}
          className="ml-1 text-ink-400 hover:text-ink-700 transition-colors"
          title="Copy full agent id"
          aria-label="Copy full agent id"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
        {!supportsMemfs && (
          <button
            onClick={() => setShowMemfsEnableConfirm(true)}
            className="ml-auto px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-medium transition-colors"
            title="Enable git-backed memfs for this agent. Requires confirmation."
          >
            Enable memfs
          </button>
        )}
        {memfsEnableNotice && (
          <span className="ml-auto text-[11px] text-emerald-700" title={memfsEnableNotice}>
            {memfsEnableNotice}
          </span>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "core" && (
          <>
            {/* Memory Health Indicator */}
            <div className="mb-4 rounded-xl border border-ink-900/10 bg-surface-secondary p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-medium text-ink-700">Memory Pressure</div>
                {/* Branch toggle for memfs-compatible agents */}
                {supportsMemfs && (
                  <div className="flex items-center gap-1 bg-ink-900/5 rounded-lg p-0.5">
                    <button
                      onClick={() => setCoreViewMode("blocks")}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                        coreViewMode === "blocks"
                          ? "bg-surface text-accent shadow-sm"
                          : "text-ink-500 hover:text-ink-700"
                      }`}
                      title="Traditional block view"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                      Blocks
                    </button>
                    <button
                      onClick={() => setCoreViewMode("files")}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                        coreViewMode === "files"
                          ? "bg-surface text-accent shadow-sm"
                          : "text-ink-500 hover:text-ink-700"
                      }`}
                      title="File tree view"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      Files
                    </button>
                  </div>
                )}
              </div>
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

            {/* Core view: Blocks or File Tree */}
            {coreViewMode === "files" && supportsMemfs ? (
              <div className="rounded-xl border border-ink-900/10 overflow-hidden" style={{ height: '400px' }}>
                <MemfsFileTree
                  blocks={memoryBlocks}
                  onUpdateFile={async (path, content) => {
                    await updateMemoryBlock(agentId, path, content);
                  }}
                  onCreateFile={async (path) => {
                    try {
                      await createAndAttachBlock(path, '');
                      await loadAgent(agentId);
                    } catch (err) {
                      console.error('[AgentMemoryPanel] create file failed:', err);
                      alert(`Failed to create file: ${err instanceof Error ? err.message : String(err)}`);
                    }
                  }}
                  onCreateFolder={async (path) => {
                    // Folders in memfs are implicit — they exist by virtue of a
                    // file living under that path. Create a placeholder
                    // README.md inside so the directory shows up.
                    try {
                      const placeholder = path.endsWith('/') ? `${path}README.md` : `${path}/README.md`;
                      await createAndAttachBlock(placeholder, '');
                      await loadAgent(agentId);
                    } catch (err) {
                      console.error('[AgentMemoryPanel] create folder failed:', err);
                      alert(`Failed to create folder: ${err instanceof Error ? err.message : String(err)}`);
                    }
                  }}
                  onDeleteNode={async (path) => {
                    const block = memoryBlocks.find((b) => b.label === path);
                    if (!block?.id) {
                      console.warn('[AgentMemoryPanel] delete: no block found for path', path);
                      return;
                    }
                    if (!confirm(`Detach "${path}" from this agent? The block remains in your library; this only removes it from this agent.`)) return;
                    try {
                      await getLettaClient().agents.blocks.detach(block.id, { agent_id: agentId });
                      await loadAgent(agentId);
                    } catch (err) {
                      console.error('[AgentMemoryPanel] delete failed:', err);
                      alert(`Failed to delete: ${err instanceof Error ? err.message : String(err)}`);
                    }
                  }}
                />
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs text-ink-500">
                    {memoryBlocks.length} block{memoryBlocks.length === 1 ? '' : 's'}
                  </span>
                  <button
                    onClick={async () => {
                      const label = prompt('New block label (use slash-paths for memfs, e.g. "system/skills/git.md"):');
                      if (!label) return;
                      const trimmed = label.trim();
                      if (!trimmed) return;
                      if (memoryBlocks.some((b) => b.label === trimmed)) {
                        alert(`A block with label "${trimmed}" already exists on this agent.`);
                        return;
                      }
                      try {
                        await createAndAttachBlock(trimmed, '');
                        await loadAgent(agentId);
                      } catch (err) {
                        alert(`Failed to create block: ${err instanceof Error ? err.message : String(err)}`);
                      }
                    }}
                    className="px-2 py-1 rounded-md text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
                  >
                    + New block
                  </button>
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

      </div>

      {/* Memory block edit confirmation — prevents accidental clobbering */}
      <ConfirmDialog
        open={!!pendingSave}
        variant="default"
        title={`Save changes to "${pendingSave?.blockLabel}"?`}
        message={
          pendingSave
            ? `You are about to overwrite the memory block "${pendingSave.blockLabel}". ` +
              `This will replace ${pendingSave.original.length} characters with ${pendingSave.draft.length} characters. ` +
              `This action cannot be undone.`
            : ''
        }
        confirmLabel="Save Changes"
        onCancel={() => setPendingSave(null)}
        onConfirm={confirmSave}
      />

      <ConfirmDialog
        open={showMemfsEnableConfirm}
        title="Enable memfs for this agent?"
        message={
          `This enables git-backed memory for "${agent?.name ?? agentId}". After enabling:\n` +
          `  • Files become the source of truth; existing blocks are seeded as the initial commit.\n` +
          `  • The server must have the external-memfs core patch applied (check Settings).\n` +
          `  • The agent will be tagged "git-memory-enabled".\n\n` +
          `The action runs the slash command "/memfs enable" against this agent's chat. ` +
          `This UI will copy the command to your clipboard — paste it into the chat to fire it. ` +
          `(Direct invocation will be wired once AgentWorkspace exposes a setInputValue store action.)`
        }
        confirmLabel="Copy /memfs enable"
        onCancel={() => setShowMemfsEnableConfirm(false)}
        onConfirm={() => {
          navigator.clipboard?.writeText('/memfs enable');
          setShowMemfsEnableConfirm(false);
          setMemfsEnableNotice('Copied — paste in chat');
          setTimeout(() => setMemfsEnableNotice(null), 4000);
        }}
      />
    </div>
  );
}
