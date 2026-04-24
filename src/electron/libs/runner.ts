import {
  createSession,
  resumeSession,
  type Session as LettaSession,
  type SDKMessage,
  type CanUseToolResponse,
  type SendMessage,
  type MessageContentItem,
} from "@letta-ai/letta-code-sdk";
import type { ServerEvent } from "../types.js";
import type { PendingPermission } from "./runtime-state.js";

/**
 * Extract text content from SDK 0.1.14 message content.
 * Handles new format where content can be:
 * - string (direct text)
 * - { text: string } (text object)
 * - MessageContentItem[] (multimodal)
 */
function extractContentText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (content && typeof content === 'object' && 'text' in content) {
    return String((content as { text?: string }).text ?? '');
  }
  if (Array.isArray(content)) {
    // Handle MessageContentItem[] - extract all text parts
    return content
      .map((item: MessageContentItem) => {
        if (typeof item === 'string') return item;
        if (item.type === 'text') return item.text ?? '';
        return '';
      })
      .join('');
  }
  return '';
}

// Simplified session type for runner
export type RunnerSession = {
  id: string;
  title: string;
  status: string;
  cwd?: string;
  pendingPermissions: Map<string, PendingPermission>;
};

export type RunnerOptions = {
  prompt: string;
  session: RunnerSession;
  resumeConversationId?: string;
  onEvent: (event: ServerEvent) => void;
  onSessionUpdate?: (updates: { lettaConversationId?: string }) => void;
};

export type RunnerHandle = {
  abort: () => void;
};

const DEFAULT_CWD = process.cwd();
const DEBUG = process.env.DEBUG_RUNNER === "true";

// Load polling interval from config (use default if not available)
const POLLING_INTERVAL = (() => {
  try {
    // Dynamic import to avoid circular dependency issues
    const config = require('../config.js');
    return config.loadConfig().pollingInterval || 5000;
  } catch {
    return 5000;
  }
})();

// Simple logger for runner
const log = (msg: string, data?: Record<string, unknown>) => {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] [runner] ${msg}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`[${timestamp}] [runner] ${msg}`);
  }
};

// Debug-only logging (verbose)
const debug = (msg: string, data?: Record<string, unknown>) => {
  if (!DEBUG) return;
  log(msg, data);
};

// Store active Letta sessions for abort handling
let activeLettaSession: LettaSession | null = null;

// Store agentId for reuse across conversations
let cachedAgentId: string | null = null;

/**
 * Convert a simple prompt string to SDK 0.1.14 SendMessage format.
 * SDK 0.1.14 SendMessage type: string | MessageContentItem[]
 * MessageContentItem: { type: "text", text: string } | { type: "image", ... }
 */
function toSendMessage(prompt: string): SendMessage {
  // SDK 0.1.14 accepts both string and MessageContentItem[]
  // Using the array format for consistency with multimodal support
  return [{ type: "text", text: prompt }];
}

export async function runLetta(options: RunnerOptions): Promise<RunnerHandle> {
  const { prompt, session, resumeConversationId, onEvent, onSessionUpdate } = options;

  debug("runLetta called", {
    prompt: prompt.slice(0, 100) + (prompt.length > 100 ? "..." : ""),
    sessionId: session.id,
    resumeConversationId,
    cachedAgentId,
    cwd: session.cwd,
  });

  // Mutable sessionId - starts as session.id, updated when conversationId is available
  let currentSessionId = session.id;

  const sendMessage = (message: SDKMessage) => {
    onEvent({
      type: "stream.message",
      payload: { sessionId: currentSessionId, message }
    });
  };

  const sendPermissionRequest = (toolUseId: string, toolName: string, input: unknown) => {
    onEvent({
      type: "permission.request",
      payload: { sessionId: currentSessionId, toolUseId, toolName, input }
    });
  };

  // Start the query in the background
  (async () => {
    try {
      // Common options for canUseTool
      const canUseTool = async (toolName: string, input: unknown) => {
        // For AskUserQuestion, we need to wait for user response
        if (toolName === "AskUserQuestion") {
          const toolUseId = crypto.randomUUID();
          sendPermissionRequest(toolUseId, toolName, input);
          return new Promise<CanUseToolResponse>((resolve) => {
            session.pendingPermissions.set(toolUseId, {
              toolUseId,
              toolName,
              input,
              resolve: (result) => {
                session.pendingPermissions.delete(toolUseId);
                resolve(result);
              }
            });
          });
        }
        return { behavior: "allow" as const };
      };

      // Session options - SDK 0.1.14 format
      const sessionOptions = {
        cwd: session.cwd ?? DEFAULT_CWD,
        permissionMode: "bypassPermissions" as const,
        canUseTool,
      };

      // Create or resume session
      let lettaSession: LettaSession;

      // Validate that resumeConversationId looks like a valid Letta ID
      // Valid IDs are: agent-xxx, conv-xxx, conversation-xxx, or UUIDs
      const isValidLettaId = (id: string | undefined): boolean => {
        if (!id) return false;
        // Check for known prefixes or UUID format
        return /^(agent-|conv-|conversation-|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/.test(id);
      };

      if (resumeConversationId && isValidLettaId(resumeConversationId)) {
        // Resume specific conversation
        debug("creating session: resumeSession with conversationId", { resumeConversationId });
        lettaSession = resumeSession(resumeConversationId, sessionOptions);
      } else if (resumeConversationId && !isValidLettaId(resumeConversationId)) {
        // Invalid ID provided - log warning and fall back to cachedAgentId
        log("WARNING: invalid resumeConversationId, falling back", {
          invalidId: resumeConversationId,
          fallbackTo: cachedAgentId ? "cachedAgentId" : "createSession"
        });
        if (cachedAgentId) {
          debug("creating session: resumeSession with cachedAgentId (fallback)", { cachedAgentId });
          lettaSession = resumeSession(cachedAgentId, sessionOptions);
        } else {
          debug("creating session: createSession (new agent, fallback)");
          lettaSession = createSession(undefined, sessionOptions);
        }
      } else if (cachedAgentId) {
        // Create new conversation on existing agent
        debug("creating session: resumeSession with cachedAgentId", { cachedAgentId });
        lettaSession = resumeSession(cachedAgentId, sessionOptions);
      } else {
        // First time - create new agent and session
        debug("creating session: createSession (new agent)");
        lettaSession = createSession(undefined, sessionOptions);
      }
      debug("session created successfully");

      // Store for abort handling
      activeLettaSession = lettaSession;

      // Send the prompt using new SDK 0.1.14 SendMessage format
      const sendMessagePayload = toSendMessage(prompt);
      debug("calling send() with SendMessage format", {
        type: typeof sendMessagePayload === "string" ? "string" : "array"
      });
      await lettaSession.send(sendMessagePayload);
      debug("send() completed", {
        conversationId: lettaSession.conversationId,
        agentId: lettaSession.agentId,
      });

      // Now initialized - update sessionId and cache agentId
      if (lettaSession.conversationId) {
        currentSessionId = lettaSession.conversationId;
        debug("session initialized", { conversationId: lettaSession.conversationId, agentId: lettaSession.agentId });
        onSessionUpdate?.({ lettaConversationId: lettaSession.conversationId });

        // Emit session.status with agentId for SDK 0.1.14+ compatibility
        onEvent({
          type: "session.status",
          payload: {
            sessionId: currentSessionId,
            status: "running",
            title: currentSessionId,
            agentId: lettaSession.agentId ?? undefined,
          }
        });
      } else {
        log("WARNING: no conversationId available after send()");
      }

      // Cache agentId for future conversations
      if (lettaSession.agentId && !cachedAgentId) {
        cachedAgentId = lettaSession.agentId;
        debug("cached agentId for future conversations", { agentId: cachedAgentId });
      }

      // Stream messages - SDK 0.1.14 pattern
      // The stream yields SDKMessage objects with content in the new format
      debug("starting stream");
      let messageCount = 0;
      for await (const message of lettaSession.stream()) {
        messageCount++;

        // Debug log with content preview (if available)
        const contentPreview = 'content' in message
          ? extractContentText((message as { content?: unknown }).content).slice(0, 50)
          : '';
        debug("received message", {
          type: message.type,
          count: messageCount,
          contentPreview: contentPreview || undefined,
          hasAgentId: 'agentId' in message ? !!(message as { agentId?: string }).agentId : undefined,
        });

        // Send message directly to frontend
        // SDK 0.1.14 messages use `content` field (not `value`)
        sendMessage(message);

        // Check for result to update session status
        if (message.type === "result") {
          const status = message.success ? "completed" : "error";
          debug("result received", { success: message.success, status });
          onEvent({
            type: "session.status",
            payload: {
              sessionId: currentSessionId,
              status,
              title: currentSessionId,
              agentId: lettaSession.agentId ?? undefined,
            }
          });
        }
      }
      debug("stream ended", { totalMessages: messageCount });

      // Query completed normally
      if (session.status === "running") {
        debug("query completed normally");
        onEvent({
          type: "session.status",
          payload: { sessionId: currentSessionId, status: "completed", title: currentSessionId }
        });
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        // Session was aborted, don't treat as error
        debug("session aborted");
        return;
      }
      log("ERROR in runLetta", {
        error: String(error),
        name: (error as Error).name,
        stack: (error as Error).stack
      });
      onEvent({
        type: "session.status",
        payload: {
          sessionId: currentSessionId,
          status: "error",
          title: currentSessionId,
          error: String(error),
          agentId: lettaSession?.agentId ?? undefined,
        }
      });
    } finally {
      debug("runLetta finally block, clearing activeLettaSession");
      activeLettaSession = null;
    }
  })();

  return {
    abort: async () => {
      if (activeLettaSession) {
        await activeLettaSession.abort();
      }
    }
  };
}
