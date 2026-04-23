import { LettaClient } from "@letta-ai/letta-code-sdk";
import type { Letta } from "@letta-ai/letta-code-sdk";
import type { ServerEvent } from "../types.js";
import type { PendingPermission } from "./runtime-state.js";

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

// Initialize Letta client
const client = new LettaClient({
  baseUrl: process.env.LETTA_BASE_URL,
  apiKey: process.env.LETTA_API_KEY,
});

// Store active abort controller for abort handling
let activeAbortController: AbortController | null = null;

// Store agentId for reuse across conversations
let cachedAgentId: string | null = null;

// Type for streaming chunks from the new SDK
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StreamChunk = any;

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
  let conversationId: string | undefined;

  const sendMessage = (message: StreamChunk) => {
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
      // Validate that resumeConversationId looks like a valid Letta ID
      // Valid IDs are: agent-xxx, conv-xxx, conversation-xxx, or UUIDs
      const isValidLettaId = (id: string | undefined): boolean => {
        if (!id) return false;
        // Check for known prefixes or UUID format
        return /^(agent-|conv-|conversation-|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/.test(id);
      };

      let agentId: string;

      // Determine agentId to use
      if (resumeConversationId && isValidLettaId(resumeConversationId)) {
        // If resumeConversationId looks like an agent ID, use it directly
        if (resumeConversationId.startsWith("agent-")) {
          agentId = resumeConversationId;
          debug("using agentId from resumeConversationId (agent- prefix)", { agentId });
        } else if (cachedAgentId) {
          // Otherwise fall back to cached agent
          agentId = cachedAgentId;
          debug("using cachedAgentId", { agentId });
        } else {
          // Create a new agent if we don't have one cached
          debug("creating new agent (no cached agent available)");
          const agent = await client.agents.create({
            name: session.title || "Letta Session",
            // Use default memory blocks
            memoryBlocks: [],
          });
          agentId = agent.id;
          cachedAgentId = agentId;
          debug("created new agent", { agentId });
        }
      } else if (cachedAgentId) {
        // Use cached agent for new conversation
        agentId = cachedAgentId;
        debug("using cachedAgentId for new conversation", { agentId });
      } else {
        // First time - create new agent
        debug("creating new agent");
        const agent = await client.agents.create({
          name: session.title || "Letta Session",
          // Use default memory blocks
          memoryBlocks: [],
        });
        agentId = agent.id;
        cachedAgentId = agentId;
        debug("created new agent", { agentId });
      }

      // Create abort controller for this stream
      activeAbortController = new AbortController();

      // Send init message to indicate session started
      sendMessage({
        type: "init",
        conversationId: conversationId || currentSessionId,
        agentId: agentId,
        model: "letta",
      });

      // Update session with agent info
      onSessionUpdate?.({ lettaConversationId: conversationId || currentSessionId });

      // Send status update
      onEvent({
        type: "session.status",
        payload: { sessionId: currentSessionId, status: "running", title: currentSessionId }
      });

      // Stream messages using the new 0.1.14 SDK pattern
      debug("starting stream with createStream", { agentId });

      const stream = await client.agents.messages.createStream(agentId, {
        messages: [{
          role: "user",
          content: [{ type: "text", text: prompt }]
        }],
      });

      let messageCount = 0;

      for await (const chunk of stream) {
        messageCount++;
        debug("received chunk", { type: chunk.type, count: messageCount });

        // Handle different chunk types from new SDK
        // Transform to SDKMessage format for IPC compatibility
        if (chunk.type === "message_chunk") {
          sendMessage({
            type: "assistant",
            content: chunk.delta || "",
          });
        } else if (chunk.type === "reasoning_message") {
          sendMessage({
            type: "reasoning",
            content: chunk.reasoning || "",
          });
        } else if (chunk.type === "tool_call_message") {
          // Handle tool calls - check for AskUserQuestion
          const toolName = chunk.tool_call?.name || "";
          const toolInput = chunk.tool_call?.arguments || {};
          const toolCallId = chunk.tool_call?.id || crypto.randomUUID();

          if (toolName === "AskUserQuestion") {
            sendPermissionRequest(toolCallId, toolName, toolInput);
          }

          sendMessage({
            type: "tool_call",
            toolName: toolName,
            toolInput: toolInput,
            toolCallId: toolCallId,
          });
        } else if (chunk.type === "tool_return_message") {
          sendMessage({
            type: "tool_result",
            toolCallId: chunk.tool_call_id || "",
            content: chunk.return_value || "",
            isError: false,
          });
        } else {
          // Pass through other chunks as-is for compatibility
          sendMessage(chunk);
        }
      }

      debug("stream ended", { totalMessages: messageCount });

      // Send completion status
      if (session.status === "running") {
        debug("query completed normally");
        onEvent({
          type: "session.status",
          payload: { sessionId: currentSessionId, status: "completed", title: currentSessionId }
        });
      }

      // Send result message for compatibility
      sendMessage({
        type: "result",
        success: true,
      });

    } catch (error) {
      if ((error as Error).name === "AbortError" || (error as { code?: string }).code === "ABORT_ERR") {
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
        payload: { sessionId: currentSessionId, status: "error", title: currentSessionId, error: String(error) }
      });

      // Send error result
      sendMessage({
        type: "result",
        success: false,
        error: String(error),
      });
    } finally {
      debug("runLetta finally block, clearing activeAbortController");
      activeAbortController = null;
    }
  })();

  return {
    abort: () => {
      if (activeAbortController) {
        activeAbortController.abort();
      }
    }
  };
}
