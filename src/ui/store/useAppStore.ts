import { create } from 'zustand';
import { Letta } from '@letta-ai/letta-client';
import { getServerClient, getLettaClient } from '../services/api';
import type { Conversation as ApiConversation } from '../services/api';
import type { ServerEvent, SessionStatus, StreamMessage } from "../types";

export type TopTab = 'home' | 'agents' | 'teams' | 'settings';

export interface AgentSummary {
  id: string;
  name: string;
  description?: string | null;
  model?: string | null;
  toolCount?: number;
  createdAt?: string | null;
  lastRun?: string | null;
  conversationCount?: number;
  tags?: string[];
  /** Resolved at list time so card-level UI can render a chip without
   *  digging into raw memory shapes. Reads `agent.memory.git_enabled`
   *  (canonical) and falls back to the `git-memory-enabled` tag. */
  memfsEnabled?: boolean;
  /** Number of non-archived conversations idle ≥ STALE_CONVERSATION_DAYS.
   *  Populated lazily when an agent is opened (loadAgent), so unopened
   *  agents show no badge until first inspection. */
  staleConversationCount?: number;
  /** If this agent is also a Teams teammate, the teammate name. */
  teammateName?: string;
}

export const MEMFS_AGENT_TAG = 'git-memory-enabled';

/** Canonical memfs detection.
 *
 *  Signals, in priority order:
 *    1. `agent.memory.git_enabled === true` (authoritative — server flips
 *       this on `/memfs enable` or a PATCH).
 *    2. `git-memory-enabled` tag present (legacy fallback; unreliable
 *       across Letta server versions).
 *    3. Any memory block has a path-style label (`a/b.md`). This is a
 *       structural signal — only memfs-enabled agents end up with
 *       slash-delimited block labels in practice. We need this fallback
 *       because some SDK retrieve responses omit `memory.git_enabled`,
 *       leaving the UI unable to recognize an already-enabled agent.
 *
 *  Pass the full agent record (or `agent.raw`) plus optionally the loaded
 *  `memoryBlocks`. The legacy `(tags)` call shape is kept for back-compat
 *  and uses tag-only detection.
 */
export function isMemfsEnabledAgent(
  input?:
    | {
        memory?: { git_enabled?: boolean } | null;
        tags?: string[] | null;
        memoryBlocks?: Array<{ label?: string | null }> | null;
      }
    | string[]
    | null,
): boolean {
  if (!input) return false;
  if (Array.isArray(input)) {
    return input.includes(MEMFS_AGENT_TAG);
  }
  if (input.memory?.git_enabled === true) return true;
  if (Array.isArray(input.tags) && input.tags.includes(MEMFS_AGENT_TAG)) return true;
  if (Array.isArray(input.memoryBlocks) && input.memoryBlocks.some((b) => typeof b?.label === 'string' && b.label.includes('/'))) {
    return true;
  }
  return false;
}

const STALE_CONVERSATION_DAYS = 14;
const STALE_CONVERSATION_MS = STALE_CONVERSATION_DAYS * 24 * 60 * 60 * 1000;

export function isConversationStale(conv: { archived?: boolean; last_message_at?: string | null; updated_at?: string | null; created_at?: string | null }): boolean {
  if (conv.archived) return false;
  const ts = conv.last_message_at ?? conv.updated_at ?? conv.created_at ?? null;
  if (!ts) return false;
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return false;
  return Date.now() - t > STALE_CONVERSATION_MS;
}

export type PermissionRequest = {
  toolUseId: string;
  toolName: string;
  input: unknown;
  /** When the request was created (epoch ms). Used for timeout display. */
  createdAt?: number;
};

/**
 * Extract text content from SDK 0.1.14 memory block content.
 * Handles both new format (content object with text field) and legacy format (string value).
 *
 * SDK 0.1.14 changed memory blocks from:
 * - Old: { value: string }
 * - New: { content: { text?: string, ... } | string }
 */
export function extractBlockText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (content && typeof content === 'object' && 'text' in content) {
    return String(content.text ?? '');
  }
  if (content && typeof content === 'object' && 'value' in content) {
    // Legacy fallback for old format
    return String((content as { value?: unknown }).value ?? '');
  }
  return '';
}

/**
 * Normalize block content to SDK 0.1.14 format.
 * Returns the content in the new format, handling legacy `value` field.
 */
export function normalizeBlockContent(block: { content?: unknown; value?: unknown }): { text?: string } | string {
  // If content exists, use it (new format)
  if (block.content !== undefined) {
    if (typeof block.content === 'string') {
      return block.content;
    }
    if (block.content && typeof block.content === 'object') {
      return block.content as { text?: string };
    }
  }
  // Fallback to legacy value field
  if (block.value !== undefined) {
    return { text: String(block.value) };
  }
  return { text: '' };
}

export type SessionView = {
  id: string;
  title: string;
  status: SessionStatus;
  cwd?: string;
  agentId?: string;
  messages: StreamMessage[];
  permissionRequests: PermissionRequest[];
  lastPrompt?: string;
  createdAt?: number;
  updatedAt?: number;
  hydrated: boolean;
};

// Agent-related types
/**
 * Memory block representation for SDK 0.1.14+.
 * Supports both legacy `value` field and new `content` field.
 *
 * SDK 0.1.14 changed memory blocks from:
 * - Old: { value: string }
 * - New: { content: string | { text: string } }
 */
export interface MemoryBlock {
  id: string;
  label: string;
  /** Legacy field - SDK <0.1.14 used `value` */
  value?: string;
  /** New field - SDK 0.1.14+ uses `content` */
  content?: string | { text?: string };
  limit?: number;
}

export interface ToolAttachment {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  model: string;
  systemMessage?: string;
  temperature?: number;
  memoryBlocks: MemoryBlock[];
  tools: ToolAttachment[];
  conversations: ApiConversation[];
  /** Raw agent object from the server — LLM config, tags, context window, etc. */
  raw?: Record<string, unknown>;
  loaded: boolean;
  createdAt: number;
  updatedAt: number;
}

interface AppState {
  sessions: Record<string, SessionView>;
  activeSessionId: string | null;
  selectedAgentId: string | null;
  agents: Record<string, Agent>;
  agentList: AgentSummary[];
  agentsLoading: boolean;
  agentsError: string | null;
  activeTab: TopTab;
  serverConnected: boolean | null;
  activeConversationId: string | null;
  lastConversationPerAgent: Record<string, string>;
  /** Persisted favorite agent ID for the "home" dashboard view */
  favoriteAgentId: string | null;
  /** Operator profile (single-user-per-install). `null` after load = setup
   *  wizard should be shown. Loaded once at app boot via Electron IPC. */
  operatorProfile: OperatorProfileData | null;
  operatorProfileLoaded: boolean;
  prompt: string;
  cwd: string;
  pendingStart: boolean;
  globalError: string | null;
  sessionsLoaded: boolean;
  showStartModal: boolean;
  historyRequested: Set<string>;
  /** AbortController for in-flight message requests - used to cancel when switching conversations */
  messagesAbortController: AbortController | null;

  setPrompt: (prompt: string) => void;
  setCwd: (cwd: string) => void;
  setPendingStart: (pending: boolean) => void;
  setGlobalError: (error: string | null) => void;
  setShowStartModal: (show: boolean) => void;
  setActiveSessionId: (id: string | null) => void;
  setSelectedAgentId: (id: string | null) => void;
  setActiveTab: (tab: TopTab) => void;
  // Atomic navigation helper for the Companion / Home dashboard buttons.
  // Sets selectedAgentId + activeTab in one mutation so the workspace
  // doesn't render against half-applied state. (Two separate store calls
  // worked in theory but the Home → Chat handoff was unreliable in
  // practice — see UI/UX punch list, session 5.)
  navigateToAgent: (id: string, tab?: TopTab) => void;
  setServerConnected: (connected: boolean | null) => void;
  setActiveConversationId: (id: string | null) => void;
  setFavoriteAgentId: (id: string | null) => void;
  loadOperatorProfile: () => Promise<void>;
  saveOperatorProfile: (profile: { displayName?: string; memfsGitUrlTemplate?: string }) => Promise<void>;
  loadAgentList: () => Promise<void>;
  loadAgent: (id: string) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  toggleTool: (agentId: string, toolId: string, nextEnabled: boolean) => Promise<void>;
  updateAgent: (id: string, updates: Record<string, unknown>) => Promise<void>;
  createConversation: (agentId: string) => Promise<ApiConversation | null>;
  deleteConversation: (conversationId: string) => Promise<boolean>;
  updateMemoryBlock: (agentId: string, blockLabel: string, newValue: string) => Promise<void>;
  updateMemoryBlocks: (agentId: string, blocks: MemoryBlock[]) => void;
  markHistoryRequested: (sessionId: string) => void;
  resolvePermissionRequest: (sessionId: string, toolUseId: string) => void;
  handleServerEvent: (event: ServerEvent) => void;
  /** Load messages from API into a session's state (single source of truth) */
  getMessages: (conversationId: string, sessionId: string) => Promise<void>;
  /** Clear messages for a session */
  clearMessages: (sessionId: string) => void;
  /** Abort any in-flight message requests (call when switching conversations) */
  abortMessageRequests: () => void;
}

/**
 * Extract string content from a StreamMessage for accumulation.
 * SDK 0.1.14 uses string content for most message types.
 */
function extractMessageContent(message: StreamMessage): string {
  // Only process message types that have content
  if (message.type === 'assistant' || message.type === 'reasoning' || message.type === 'tool_result') {
    return message.content || '';
  }
  return '';
}

/**
 * Merge accumulated text into a message while preserving SDK format.
 * SDK 0.1.14 uses simple string content.
 */
function mergeMessageContent(_existingMsg: StreamMessage, newMsg: StreamMessage, accumulatedText: string): StreamMessage {
  // Only merge for message types with content field
  if (newMsg.type === 'assistant' || newMsg.type === 'reasoning' || newMsg.type === 'tool_result') {
    return { ...newMsg, content: accumulatedText };
  }
  return newMsg;
}

/**
 * Normalize message content to handle SDK 0.1.14 format.
 * No transformation needed for SDK 0.1.14 as it uses consistent string content.
 */
function normalizeMessageContent(message: StreamMessage): StreamMessage {
  return message;
}

function createSession(id: string): SessionView {
  return { id, title: "", status: "idle", messages: [], permissionRequests: [], hydrated: false };
}

const FAVORITE_AGENT_KEY = 'letta-community-ade:favorite-agent';

function getStoredFavorite(): string | null {
  try {
    return localStorage.getItem(FAVORITE_AGENT_KEY);
  } catch {
    return null;
  }
}

function setStoredFavorite(id: string | null) {
  try {
    if (id) localStorage.setItem(FAVORITE_AGENT_KEY, id);
    else localStorage.removeItem(FAVORITE_AGENT_KEY);
  } catch { /* ignore */ }
}

export const useAppStore = create<AppState>((set, get) => ({
  sessions: {},
  activeSessionId: null,
  selectedAgentId: null,
  agents: {},
  agentList: [],
  agentsLoading: false,
  agentsError: null,
  activeTab: 'home',
  serverConnected: null,
  activeConversationId: null,
  lastConversationPerAgent: {},
  favoriteAgentId: getStoredFavorite(),
  operatorProfile: null,
  operatorProfileLoaded: false,
  prompt: "",
  cwd: "",
  pendingStart: false,
  globalError: null,
  sessionsLoaded: false,
  showStartModal: false,
  historyRequested: new Set(),
  messagesAbortController: null,

  setPrompt: (prompt) => set({ prompt }),
  setCwd: (cwd) => set({ cwd }),
  setPendingStart: (pendingStart) => set({ pendingStart }),
  setGlobalError: (globalError) => set({ globalError }),
  setShowStartModal: (showStartModal) => set({ showStartModal }),
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setSelectedAgentId: (id) => set((state) => ({
    selectedAgentId: id,
    activeConversationId: id ? (state.lastConversationPerAgent[id] ?? null) : null,
  })),
  setActiveTab: (activeTab) => set({ activeTab }),
  navigateToAgent: (id, tab = 'agents') => set((state) => ({
    selectedAgentId: id,
    activeTab: tab,
    activeConversationId: id ? (state.lastConversationPerAgent[id] ?? null) : null,
  })),
  setServerConnected: (serverConnected) => set({ serverConnected }),
  setFavoriteAgentId: (id) => {
    setStoredFavorite(id);
    set({ favoriteAgentId: id });
  },

  loadOperatorProfile: async () => {
    if (typeof window === 'undefined' || !window.electron?.getOperatorProfile) {
      // Non-Electron context (Vite-only dev). Mark loaded so the gate
      // doesn't block; profile stays null but the wizard won't render
      // because save would fail anyway (see App.tsx gate condition).
      set({ operatorProfileLoaded: true, operatorProfile: null });
      return;
    }
    try {
      const profile = await window.electron.getOperatorProfile();
      set({ operatorProfile: profile, operatorProfileLoaded: true });
    } catch (err) {
      console.error('[operator-profile] load failed:', err);
      set({ operatorProfileLoaded: true });
    }
  },

  saveOperatorProfile: async (partial) => {
    if (typeof window === 'undefined' || !window.electron?.saveOperatorProfile) {
      throw new Error('Operator profile save unavailable (no Electron context)');
    }
    const saved = await window.electron.saveOperatorProfile(partial);
    set({ operatorProfile: saved });
  },
  setActiveConversationId: (activeConversationId) => set((state) => {
    const agentId = state.selectedAgentId;
    if (!agentId) return { activeConversationId };
    const nextMap = { ...state.lastConversationPerAgent };
    if (activeConversationId) {
      nextMap[agentId] = activeConversationId;
    } else {
      delete nextMap[agentId];
    }
    return { activeConversationId, lastConversationPerAgent: nextMap };
  }),

  loadAgentList: async () => {
    set({ agentsLoading: true, agentsError: null });
    try {
      const client = getServerClient();
      const list: Letta.AgentState[] = [];
      for await (const agent of client.agents.list()) {
        list.push(agent);
      }

      // Cross-reference with Teams teammates, if available.
      let agentTeammateMap: Record<string, string> = {};
      try {
        if (typeof window !== 'undefined' && window.electron?.teams?.getAgentTeammateMap) {
          agentTeammateMap = await window.electron.teams.getAgentTeammateMap();
        }
      } catch {
        // Teams runtime not available — skip cross-reference.
      }

      const summaries: AgentSummary[] = list.map((a) => {
        const anyA = a as unknown as Record<string, unknown>;
        const tools = anyA.tools as unknown[] | undefined;
        const toolCount = typeof anyA.toolCount === 'number'
          ? (anyA.toolCount as number)
          : Array.isArray(tools) ? tools.length : undefined;
        const rawTags = anyA.tags;
        const tags = Array.isArray(rawTags)
          ? rawTags.filter((t): t is string => typeof t === 'string')
          : undefined;
        const memory = anyA.memory as { git_enabled?: boolean } | null | undefined;
        const memfsEnabled = isMemfsEnabledAgent({ memory, tags });
        return {
          id: a.id,
          name: a.name,
          description: a.description ?? null,
          model: a.model ?? null,
          toolCount,
          createdAt: a.created_at ?? null,
          lastRun: (anyA.last_run_completion as string | null | undefined) ?? null,
          tags,
          memfsEnabled,
          teammateName: agentTeammateMap[a.id],
        };
      });
      set({ agentList: summaries, agentsLoading: false });
    } catch (err) {
      set({
        agentsLoading: false,
        agentsError: err instanceof Error ? err.message : 'Failed to load agents',
      });
    }
  },

  loadAgent: async (id) => {
    try {
      const client = getServerClient();
      // Fetch agent detail, blocks, and conversations in parallel.
      // Note: SDK agents.retrieve() does NOT include blocks — fetch separately.
      const [detail, blocks, conversations] = await Promise.all([
        client.agents.retrieve(id),
        (async () => {
          try {
            const out: Letta.BlockResponse[] = [];
            for await (const b of client.agents.blocks.list(id)) out.push(b);
            return out;
          } catch (err) {
            console.error('[useAppStore] Failed to load memory blocks:', err);
            return [] as Letta.BlockResponse[];
          }
        })(),
        client.conversations.list({ agent_id: id }).catch((err) => {
          console.error('[useAppStore] Failed to list conversations:', err);
          return [] as ApiConversation[];
        }),
      ]);
      // The SDK's AgentState does not nest fields under a `raw` key — they're
      // at the top level. Treat the full detail object as the raw source so
      // downstream readers (e.g. AgentWorkspace.populateConfigForm) see real
      // values instead of an empty object.
      const raw = detail as unknown as Record<string, unknown>;
      const llm = (raw.llm_config as Record<string, unknown> | undefined) ?? {};

      // Map blocks from SDK response
      const memoryBlocks: MemoryBlock[] = blocks.map((b) => {
        // Extract text from either new `content` field or legacy `value` field
        const extractedText = extractBlockText(
          (b as { content?: unknown }).content ?? (b as { value?: unknown }).value,
        );
        return {
          id: (b.id || b.label || 'unknown') as string,
          label: (b.label || 'unknown') as string,
          // Set both fields for backwards compatibility
          value: extractedText,  // Legacy field
          content: { text: extractedText },  // SDK 0.1.14+ format
          limit: b.limit,
        };
      });

      // Attached tool IDs come back in raw.tools as either strings or {id} objects; enabled = attached.
      const rawTools = (raw.tools as unknown[] | undefined) ?? [];
      const attachedIds = new Set<string>(
        rawTools
          .map((t) => (typeof t === 'string' ? t : typeof t === 'object' && t !== null && 'id' in t ? String((t as { id: unknown }).id) : null))
          .filter((v): v is string => !!v),
      );

      // FIX: Handle null/undefined tool name with default, ensure description is string | undefined (not null)
      const tools: ToolAttachment[] = detail.tools.map((t) => ({
        id: t.id,
        name: (t.name || 'Unnamed Tool') as string,
        description: t.description ?? undefined,
        enabled: attachedIds.size === 0 ? true : attachedIds.has(t.id),
      }));

      const nowCreated = (raw.created_at as string | undefined) ? Date.parse(raw.created_at as string) : Date.now();
      const nowUpdated = (raw.updated_at as string | undefined) ? Date.parse(raw.updated_at as string) : Date.now();

      const agent: Agent = {
        id,
        name: String(raw.name ?? ''),
        description: raw.description as string | undefined,
        model: String(raw.model ?? (llm.handle as string | undefined) ?? (llm.model as string | undefined) ?? ''),
        systemMessage: (raw.system as string | undefined) ?? '',
        temperature: llm.temperature as number | undefined,
        memoryBlocks,
        tools,
        conversations,
        raw,
        loaded: true,
        createdAt: nowCreated,
        updatedAt: nowUpdated,
      };

      const staleConversationCount = conversations.filter(isConversationStale).length;
      set((state) => ({
        agents: { ...state.agents, [id]: agent },
        agentList: state.agentList.map((s) =>
          s.id === id
            ? { ...s, conversationCount: conversations.length, staleConversationCount }
            : s,
        ),
      }));

      // Auto-select a conversation if none active. Prefer the last one the
      // user had open for this agent; fall back to the first available.
      const state = get();
      if (!state.activeConversationId && agent.conversations.length > 0) {
        const remembered = state.lastConversationPerAgent[id];
        const pick = remembered && agent.conversations.some(c => c.id === remembered)
          ? remembered
          : agent.conversations[0].id;
        get().setActiveConversationId(pick);
      }
    } catch (err) {
      console.error('[useAppStore] Failed to load agent:', err);
      set({ globalError: err instanceof Error ? err.message : 'Failed to load agent' });
    }
  },

  deleteAgent: async (id) => {
    try {
      await getServerClient().agents.delete(id);
      set((state) => {
        const nextAgents = { ...state.agents };
        delete nextAgents[id];
        const nextLastConv = { ...state.lastConversationPerAgent };
        delete nextLastConv[id];
        return {
          agents: nextAgents,
          agentList: state.agentList.filter((a) => a.id !== id),
          selectedAgentId: state.selectedAgentId === id ? null : state.selectedAgentId,
          activeConversationId: state.selectedAgentId === id ? null : state.activeConversationId,
          lastConversationPerAgent: nextLastConv,
        };
      });
    } catch (err) {
      set({ globalError: err instanceof Error ? err.message : 'Failed to delete agent' });
    }
  },

  toggleTool: async (agentId, toolId, nextEnabled) => {
    // Optimistic update
    set((state) => {
      const agent = state.agents[agentId];
      if (!agent) return {};
      return {
        agents: {
          ...state.agents,
          [agentId]: {
            ...agent,
            tools: agent.tools.map((t) => (t.id === toolId ? { ...t, enabled: nextEnabled } : t)),
          },
        },
      };
    });
    try {
      const client = getLettaClient();
      if (nextEnabled) {
        await client.agents.tools.attach(toolId, { agent_id: agentId });
      } else {
        await client.agents.tools.detach(toolId, { agent_id: agentId });
      }
    } catch (err) {
      console.error('[useAppStore] Failed to toggle tool:', err);
      // Revert
      set((state) => {
        const agent = state.agents[agentId];
        if (!agent) return {};
        return {
          agents: {
            ...state.agents,
            [agentId]: {
              ...agent,
              tools: agent.tools.map((t) => (t.id === toolId ? { ...t, enabled: !nextEnabled } : t)),
            },
          },
          globalError: err instanceof Error ? err.message : 'Failed to toggle tool',
        };
      });
    }
  },

  updateAgent: async (id, updates) => {
    try {
      await getLettaClient().agents.update(id, updates as Letta.AgentUpdateParams);
      // Refresh agent data after update
      await get().loadAgent(id);
    } catch (err) {
      console.error('[useAppStore] Failed to update agent:', err);
      set({ globalError: err instanceof Error ? err.message : 'Failed to update agent' });
      throw err;
    }
  },

  createConversation: async (agentId) => {
    try {
      const conv = await getLettaClient().conversations.create({ agent_id: agentId });
      // Refresh agent to get updated conversations list
      await get().loadAgent(agentId);
      return conv;
    } catch (err) {
      console.error('[useAppStore] Failed to create conversation:', err);
      set({ globalError: err instanceof Error ? err.message : 'Failed to create conversation' });
      return null;
    }
  },

  deleteConversation: async (conversationId) => {
    try {
      await getLettaClient().conversations.delete(conversationId);
      // Refresh current agent to get updated conversations list
      const agentId = get().selectedAgentId;
      if (agentId) {
        await get().loadAgent(agentId);
      }
      // Clear active conversation if it was deleted
      if (get().activeConversationId === conversationId) {
        const agent = agentId ? get().agents[agentId] : null;
        const nextConv = agent?.conversations[0];
        get().setActiveConversationId(nextConv?.id ?? null);
      }
      return true;
    } catch (err) {
      console.error('[useAppStore] Failed to delete conversation:', err);
      set({ globalError: err instanceof Error ? err.message : 'Failed to delete conversation' });
      return false;
    }
  },

  updateMemoryBlock: async (agentId, blockLabel, newValue) => {
    // Update local state immediately for responsiveness
    set((state) => {
      const agent = state.agents[agentId];
      if (!agent) return {};

      const updatedBlocks = agent.memoryBlocks.map(block =>
        block.label === blockLabel
          ? { ...block, value: newValue, content: { text: newValue } }  // Update both fields
          : block
      );

      return {
        agents: {
          ...state.agents,
          [agentId]: { ...agent, memoryBlocks: updatedBlocks, updatedAt: Date.now() }
        }
      };
    });

    // Sync to API (community-ade uses label as identifier)
    // API expects `value` field (legacy format)
    const client = getLettaClient();
    try {
      await client.agents.blocks.update(blockLabel, { agent_id: agentId, value: newValue });
    } catch (error) {
      console.error('[useAppStore] Failed to update memory block:', error);
      // Revert on error by re-fetching
      const blocks: Letta.BlockResponse[] = [];
      for await (const b of client.agents.blocks.list(agentId)) blocks.push(b);
      // FIX: Map BlockResponse to MemoryBlock with proper null-safety
      const mappedBlocks: MemoryBlock[] = blocks.map((b) => ({
        id: (b.id || b.label || 'unknown') as string,
        label: (b.label || 'unknown') as string,
        value: (b as { value?: string }).value || '',
        content: (b as { content?: string | { text?: string } }).content || { text: (b as { value?: string }).value || '' },
        limit: b.limit,
      }));
      get().updateMemoryBlocks(agentId, mappedBlocks);
    }
  },

  updateMemoryBlocks: (agentId, blocks) => {
    set((state) => {
      const agent = state.agents[agentId];
      if (!agent) return {};

      return {
        agents: {
          ...state.agents,
          [agentId]: { ...agent, memoryBlocks: blocks, updatedAt: Date.now() }
        }
      };
    });
  },

  markHistoryRequested: (sessionId) => {
    set((state) => {
      const next = new Set(state.historyRequested);
      next.add(sessionId);
      return { historyRequested: next };
    });
  },

  resolvePermissionRequest: (sessionId, toolUseId) => {
    set((state) => {
      const existing = state.sessions[sessionId];
      if (!existing) return {};
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...existing,
            permissionRequests: existing.permissionRequests.filter(req => req.toolUseId !== toolUseId)
          }
        }
      };
    });
  },

  handleServerEvent: (event) => {
    const state = get();

    switch (event.type) {
      case "session.list": {
        const nextSessions: Record<string, SessionView> = {};
        for (const session of event.payload.sessions) {
          const existing = state.sessions[session.id] ?? createSession(session.id);
          nextSessions[session.id] = {
            ...existing,
            status: session.status,
            title: session.title,
            cwd: session.cwd,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt
          };
        }

        set({ sessions: nextSessions, sessionsLoaded: true });

        const hasSessions = event.payload.sessions.length > 0;
        set({ showStartModal: !hasSessions });

        if (!hasSessions) {
          get().setActiveSessionId(null);
        }

        if (!state.activeSessionId && event.payload.sessions.length > 0) {
          const sorted = [...event.payload.sessions].sort((a, b) => {
            const aTime = a.updatedAt ?? a.createdAt ?? 0;
            const bTime = b.updatedAt ?? b.createdAt ?? 0;
            return aTime - bTime;
          });
          const latestSession = sorted[sorted.length - 1];
          if (latestSession) {
            get().setActiveSessionId(latestSession.id);
          }
        } else if (state.activeSessionId) {
          const stillExists = event.payload.sessions.some(
            (session) => session.id === state.activeSessionId
          );
          if (!stillExists) {
            get().setActiveSessionId(null);
          }
        }
        break;
      }

      case "session.history": {
        const { sessionId, messages: historyMessages, status } = event.payload;
        set((state) => {
          const existing = state.sessions[sessionId] ?? createSession(sessionId);
          // Merge: history messages first, then any existing messages (like user_prompt added during init)
          const mergedMessages = [...historyMessages, ...existing.messages];
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: { ...existing, status, messages: mergedMessages, hydrated: true }
            }
          };
        });
        break;
      }

      case "session.status": {
        const { sessionId, status, title, cwd, agentId } = event.payload as { sessionId: string; status: SessionStatus; title?: string; cwd?: string; agentId?: string };

        // Treat "idle" (after abort) similarly to "completed" for pendingStart
        const isTerminalStatus = status === "completed" || status === "error" || status === "idle";

        set((state) => {
          const existing = state.sessions[sessionId] ?? createSession(sessionId);
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...existing,
                status,
                title: title ?? existing.title,
                cwd: cwd ?? existing.cwd,
                agentId: agentId ?? existing.agentId,
                updatedAt: Date.now(),
                // Clear permission requests on abort/idle
                ...(status === "idle" ? { permissionRequests: [] } : {})
              }
            }
          };
        });

        if (state.pendingStart && isTerminalStatus) {
          get().setActiveSessionId(sessionId);
          if (agentId) {
            get().setSelectedAgentId(agentId);
          }
          set({ pendingStart: false, showStartModal: false, prompt: "" });
        }
        break;
      }

      case "session.deleted": {
        const { sessionId } = event.payload;
        const state = get();

        const nextSessions = { ...state.sessions };
        delete nextSessions[sessionId];

        const nextHistoryRequested = new Set(state.historyRequested);
        nextHistoryRequested.delete(sessionId);

        const hasRemaining = Object.keys(nextSessions).length > 0;

        set({
          sessions: nextSessions,
          historyRequested: nextHistoryRequested,
          showStartModal: !hasRemaining
        });

        if (state.activeSessionId === sessionId) {
          const remaining = Object.values(nextSessions).sort(
            (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
          );
          get().setActiveSessionId(remaining[0]?.id ?? null);
        }
        break;
      }

      case "stream.message": {
        const { sessionId, message } = event.payload;
        set((state) => {
          const existing = state.sessions[sessionId] ?? createSession(sessionId);
          const messages = [...existing.messages];

          // Get message ID (uuid for SDK messages)
          const msgId = 'uuid' in message ? message.uuid : undefined;
          const msgType = message.type;

          if (msgId) {
            // Find existing message with same ID
            const existingIdx = messages.findIndex(
              (m) => 'uuid' in m && m.uuid === msgId
            );
            if (existingIdx >= 0) {
              // For streaming messages, ACCUMULATE content (SDK sends deltas)
              if (msgType === "reasoning" || msgType === "assistant") {
                const existingMsg = messages[existingIdx];
                // Extract text from content using SDK 0.1.14 compatible method
                const existingText = extractMessageContent(existingMsg);
                const newText = extractMessageContent(message);
                // Merge content preserving new format
                messages[existingIdx] = mergeMessageContent(existingMsg, message, existingText + newText);
              } else {
                // Other messages: replace with normalized content
                messages[existingIdx] = normalizeMessageContent(message);
              }
            } else {
              messages.push(normalizeMessageContent(message));
            }
          } else {
            messages.push(normalizeMessageContent(message));
          }

          return {
            sessions: {
              ...state.sessions,
              [sessionId]: { ...existing, messages }
            }
          };
        });
        break;
      }

      case "stream.user_prompt": {
        const { sessionId, prompt } = event.payload;
        set((state) => {
          const existing = state.sessions[sessionId] ?? createSession(sessionId);
          const newMessages = [...existing.messages, { type: "user_prompt" as const, prompt }];
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...existing,
                messages: newMessages
              }
            }
          };
        });
        break;
      }

      case "permission.request": {
        const { sessionId, toolUseId, toolName, input } = event.payload;
        set((state) => {
          const existing = state.sessions[sessionId] ?? createSession(sessionId);
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...existing,
                permissionRequests: [...existing.permissionRequests, { toolUseId, toolName, input, createdAt: Date.now() }]
              }
            }
          };
        });
        break;
      }

      case "runner.error": {
        set({ globalError: event.payload.message });
        break;
      }
    }
  },

  // ============================================================================
  // Message State Management (Single Source of Truth in sessions)
  // ============================================================================

  /**
   * Load messages from API into a session's state.
   * This consolidates message state - sessions are the single source of truth.
   * AbortController prevents race conditions when switching conversations.
   */
  getMessages: async (conversationId: string, sessionId: string) => {
    // Abort any existing request to prevent race conditions
    const existingController = get().messagesAbortController;
    if (existingController) {
      existingController.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    set({ messagesAbortController: abortController });

    try {
      const client = getLettaClient();
      const page = await client.conversations.messages.list(conversationId, {
        limit: 200,
        order: "asc",
      });
      const apiMessages = page.getPaginatedItems();

      // Transform API messages to StreamMessage format
      const streamMessages: StreamMessage[] = apiMessages.map((msg): StreamMessage => {
        const msgWithProps = msg as {
          id?: string;
          content?: unknown;
          role?: string;
          created_at?: string | number;
        };

        let content = '';
        if (typeof msgWithProps.content === 'string') {
          content = msgWithProps.content;
        } else if (msgWithProps.content && typeof msgWithProps.content === 'object') {
          const contentObj = msgWithProps.content as { text?: string; [key: string]: unknown };
          if ('text' in contentObj && typeof contentObj.text === 'string') {
            content = contentObj.text;
          } else if (Array.isArray(msgWithProps.content)) {
            interface ContentBlock {
              type?: string;
              text?: string;
            }
            content = msgWithProps.content
              .filter((c: ContentBlock) => c.type === 'text' || typeof c.text === 'string')
              .map((c: ContentBlock) => c.text || '')
              .join('');
          }
        }

        const baseMessage = {
          uuid: msgWithProps.id || `msg-${Date.now()}`,
          createdAt: msgWithProps.created_at ? new Date(msgWithProps.created_at).getTime() : Date.now(),
        };

        if (msgWithProps.role === 'user') {
          return { ...baseMessage, type: 'user_prompt' as const, prompt: content };
        } else if (msgWithProps.role === 'assistant') {
          return { ...baseMessage, type: 'assistant' as const, content };
        } else if (msgWithProps.role === 'system') {
          return { ...baseMessage, type: 'system' as const, content };
        } else {
          return { ...baseMessage, type: 'assistant' as const, content };
        }
      });

      // Update session with loaded messages (single source of truth)
      set((state) => {
        const existing = state.sessions[sessionId] ?? createSession(sessionId);
        return {
          sessions: {
            ...state.sessions,
            [sessionId]: { ...existing, messages: streamMessages, hydrated: true }
          }
        };
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // Request was aborted - this is expected when switching conversations
        return;
      }
      console.error('[useAppStore] Failed to load messages:', err);
      set({ globalError: err instanceof Error ? err.message : 'Failed to load messages' });
    } finally {
      // Clear the abort controller if it's still ours
      const currentController = get().messagesAbortController;
      if (currentController === abortController) {
        set({ messagesAbortController: null });
      }
    }
  },

  /**
   * Clear messages for a session.
   * Use this when switching conversations or resetting state.
   */
  clearMessages: (sessionId: string) => {
    set((state) => {
      const existing = state.sessions[sessionId];
      if (!existing) return {};
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...existing, messages: [], hydrated: false }
        }
      };
    });
  },

  /**
   * Abort any in-flight message requests.
   * Call this when switching conversations to prevent stale data.
   */
  abortMessageRequests: () => {
    const controller = get().messagesAbortController;
    if (controller) {
      controller.abort();
      set({ messagesAbortController: null });
    }
  },
}));
