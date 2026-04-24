import { create } from 'zustand';
import { agentsApi, chatApi } from '../services/api';
import type { Conversation as ApiConversation } from '../services/api';
import type { ServerEvent, SessionStatus, StreamMessage } from "../types";

export type TopTab = 'agents' | 'models' | 'settings';

export interface AgentSummary {
  id: string;
  name: string;
  description?: string | null;
  model?: string | null;
  toolCount?: number;
  createdAt?: string | null;
}

export type PermissionRequest = {
  toolUseId: string;
  toolName: string;
  input: unknown;
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
export interface MemoryBlock {
  id: string;
  label: string;
  value: string;
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
  prompt: string;
  cwd: string;
  pendingStart: boolean;
  globalError: string | null;
  sessionsLoaded: boolean;
  showStartModal: boolean;
  historyRequested: Set<string>;

  setPrompt: (prompt: string) => void;
  setCwd: (cwd: string) => void;
  setPendingStart: (pending: boolean) => void;
  setGlobalError: (error: string | null) => void;
  setShowStartModal: (show: boolean) => void;
  setActiveSessionId: (id: string | null) => void;
  setSelectedAgentId: (id: string | null) => void;
  setActiveTab: (tab: TopTab) => void;
  setServerConnected: (connected: boolean | null) => void;
  setActiveConversationId: (id: string | null) => void;
  loadAgentList: () => Promise<void>;
  loadAgent: (id: string) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  toggleTool: (agentId: string, toolId: string, nextEnabled: boolean) => Promise<void>;
  updateAgent: (agent: Agent) => void;
  updateMemoryBlock: (agentId: string, blockLabel: string, newValue: string) => Promise<void>;
  updateMemoryBlocks: (agentId: string, blocks: MemoryBlock[]) => void;
  markHistoryRequested: (sessionId: string) => void;
  resolvePermissionRequest: (sessionId: string, toolUseId: string) => void;
  handleServerEvent: (event: ServerEvent) => void;
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

export const useAppStore = create<AppState>((set, get) => ({
  sessions: {},
  activeSessionId: null,
  selectedAgentId: null,
  agents: {},
  agentList: [],
  agentsLoading: false,
  agentsError: null,
  activeTab: 'agents',
  serverConnected: null,
  activeConversationId: null,
  prompt: "",
  cwd: "",
  pendingStart: false,
  globalError: null,
  sessionsLoaded: false,
  showStartModal: false,
  historyRequested: new Set(),

  setPrompt: (prompt) => set({ prompt }),
  setCwd: (cwd) => set({ cwd }),
  setPendingStart: (pendingStart) => set({ pendingStart }),
  setGlobalError: (globalError) => set({ globalError }),
  setShowStartModal: (showStartModal) => set({ showStartModal }),
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setSelectedAgentId: (id) => set({ selectedAgentId: id, activeConversationId: null }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setServerConnected: (serverConnected) => set({ serverConnected }),
  setActiveConversationId: (activeConversationId) => set({ activeConversationId }),

  loadAgentList: async () => {
    set({ agentsLoading: true, agentsError: null });
    try {
      const list = await agentsApi.listAgents();
      const summaries: AgentSummary[] = list.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description ?? null,
        model: a.model ?? null,
        // @ts-expect-error — community-ade returns toolCount but base Agent type doesn't declare it
        toolCount: typeof a.toolCount === 'number' ? a.toolCount : undefined,
        createdAt: a.created_at ?? null,
      }));
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
      const detail = await agentsApi.getAgent(id);
      const raw = (detail.raw ?? {}) as Record<string, unknown>;
      const llm = (raw.llm_config as Record<string, unknown> | undefined) ?? {};

      const memoryBlocks: MemoryBlock[] = detail.blocks.map((b) => ({
        id: b.id ?? b.label,
        label: b.label,
        value: extractBlockText(
          // API returns either { value } or { content }
          (b as { content?: unknown }).content ?? b.value,
        ),
        limit: b.limit,
      }));

      // Attached tool IDs come back in raw.tools as either strings or {id} objects; enabled = attached.
      const rawTools = (raw.tools as unknown[] | undefined) ?? [];
      const attachedIds = new Set<string>(
        rawTools
          .map((t) => (typeof t === 'string' ? t : typeof t === 'object' && t !== null && 'id' in t ? String((t as { id: unknown }).id) : null))
          .filter((v): v is string => !!v),
      );

      const tools: ToolAttachment[] = detail.tools.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
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
        conversations: detail.conversations ?? [],
        raw,
        loaded: true,
        createdAt: nowCreated,
        updatedAt: nowUpdated,
      };

      set((state) => ({
        agents: { ...state.agents, [id]: agent },
      }));

      // Auto-select first conversation if none active
      const state = get();
      if (!state.activeConversationId && agent.conversations.length > 0) {
        set({ activeConversationId: agent.conversations[0].id });
      }
    } catch (err) {
      console.error('[useAppStore] Failed to load agent:', err);
      set({ globalError: err instanceof Error ? err.message : 'Failed to load agent' });
    }
  },

  deleteAgent: async (id) => {
    try {
      await agentsApi.deleteAgent(id);
      set((state) => {
        const nextAgents = { ...state.agents };
        delete nextAgents[id];
        return {
          agents: nextAgents,
          agentList: state.agentList.filter((a) => a.id !== id),
          selectedAgentId: state.selectedAgentId === id ? null : state.selectedAgentId,
          activeConversationId: state.selectedAgentId === id ? null : state.activeConversationId,
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
      if (nextEnabled) {
        await agentsApi.attachTool(agentId, toolId);
      } else {
        await agentsApi.detachTool(agentId, toolId);
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

  updateAgent: (agent) => set((state) => ({
    agents: { ...state.agents, [agent.id]: agent }
  })),

  updateMemoryBlock: async (agentId, blockLabel, newValue) => {
    // Update local state immediately for responsiveness
    set((state) => {
      const agent = state.agents[agentId];
      if (!agent) return {};

      const updatedBlocks = agent.memoryBlocks.map(block =>
        block.label === blockLabel ? { ...block, value: newValue } : block
      );

      return {
        agents: {
          ...state.agents,
          [agentId]: { ...agent, memoryBlocks: updatedBlocks, updatedAt: Date.now() }
        }
      };
    });

    // Sync to API (community-ade uses label as identifier)
    try {
      await agentsApi.updateMemoryBlock(agentId, blockLabel, newValue);
    } catch (error) {
      console.error('[useAppStore] Failed to update memory block:', error);
      // Revert on error by re-fetching
      const blocks = await agentsApi.getMemoryBlocks(agentId);
      get().updateMemoryBlocks(agentId, blocks);
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
                updatedAt: Date.now()
              }
            }
          };
        });

        if (state.pendingStart) {
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
                permissionRequests: [...existing.permissionRequests, { toolUseId, toolName, input }]
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
  }
}));
