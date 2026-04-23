import { create } from 'zustand';
import type { ServerEvent, SessionStatus, StreamMessage } from "../types";

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
  model: string;
  systemMessage?: string;
  temperature?: number;
  memoryBlocks: MemoryBlock[];
  tools: ToolAttachment[];
  createdAt: number;
  updatedAt: number;
}

interface AppState {
  sessions: Record<string, SessionView>;
  activeSessionId: string | null;
  selectedAgentId: string | null;
  agents: Record<string, Agent>;
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
  updateAgent: (agent: Agent) => void;
  updateMemoryBlock: (agentId: string, blockId: string, newValue: string) => Promise<void>;
  updateMemoryBlocks: (agentId: string, blocks: MemoryBlock[]) => void;
  markHistoryRequested: (sessionId: string) => void;
  resolvePermissionRequest: (sessionId: string, toolUseId: string) => void;
  handleServerEvent: (event: ServerEvent) => void;
}

/**
 * Extract string content from a StreamMessage for accumulation.
 * Handles SDK 0.1.14 format where content can be:
 * - string (legacy and new simple format)
 * - Array<{type: string, text?: string, ...}> (new structured format)
 * - { text?: string, ... } (new object format)
 */
function extractMessageContent(message: StreamMessage): string {
  if (!('content' in message) || message.content === undefined) {
    return '';
  }

  const content = message.content;

  // Simple string content
  if (typeof content === 'string') {
    return content;
  }

  // Array of content blocks (SDK 0.1.14 format)
  if (Array.isArray(content)) {
    return content.map(block => {
      if (typeof block === 'string') return block;
      if (block && typeof block === 'object') {
        // Handle structured content blocks
        if ('text' in block) return String(block.text ?? '');
        if ('value' in block) return String((block as { value?: unknown }).value ?? '');
      }
      return '';
    }).join('');
  }

  // Object content with text field
  if (content && typeof content === 'object') {
    if ('text' in content) return String(content.text ?? '');
    // Fallback for legacy value field
    if ('value' in content) return String((content as { value?: unknown }).value ?? '');
  }

  return '';
}

/**
 * Merge accumulated text into a message while preserving SDK format.
 * Returns a new message with updated content field.
 */
function mergeMessageContent(existingMsg: StreamMessage, newMsg: StreamMessage, accumulatedText: string): StreamMessage {
  const existingContent = 'content' in existingMsg ? existingMsg.content : undefined;

  // If content is array format, rebuild array with accumulated text in text blocks
  if (Array.isArray(existingContent)) {
    return {
      ...newMsg,
      content: existingContent.map((block, idx) => {
        if (typeof block === 'string') {
          // Distribute accumulated text to first string block only
          return idx === 0 ? accumulatedText : '';
        }
        if (block && typeof block === 'object' && 'text' in block) {
          return { ...block, text: accumulatedText };
        }
        return block;
      })
    } as StreamMessage;
  }

  // If content is object with text field
  if (existingContent && typeof existingContent === 'object' && !Array.isArray(existingContent)) {
    return {
      ...newMsg,
      content: { ...existingContent, text: accumulatedText }
    } as StreamMessage;
  }

  // Default: use simple string format
  return { ...newMsg, content: accumulatedText } as StreamMessage;
}

/**
 * Normalize message content to handle SDK 0.1.14 format variations.
 * Ensures backward compatibility with legacy `value` field.
 */
function normalizeMessageContent(message: StreamMessage): StreamMessage {
  if (!('content' in message) || message.content === undefined) {
    return message;
  }

  const content = message.content;

  // Handle legacy format with `value` instead of `content`
  if (content && typeof content === 'object' && 'value' in content && !('text' in content)) {
    return {
      ...message,
      content: { text: String((content as { value?: unknown }).value ?? '') }
    } as StreamMessage;
  }

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
  setSelectedAgentId: (id) => set({ selectedAgentId: id }),
  updateAgent: (agent) => set((state) => ({
    agents: { ...state.agents, [agent.id]: agent }
  })),

  updateMemoryBlock: async (agentId, blockId, newValue) => {
    // Mock API call - update local state immediately
    set((state) => {
      const agent = state.agents[agentId];
      if (!agent) return {};

      const updatedBlocks = agent.memoryBlocks.map(block =>
        block.id === blockId ? { ...block, value: newValue } : block
      );

      return {
        agents: {
          ...state.agents,
          [agentId]: { ...agent, memoryBlocks: updatedBlocks, updatedAt: Date.now() }
        }
      };
    });

    // TODO: Replace with actual API call when available
    // await api.updateMemoryBlock(agentId, blockId, newValue);
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
