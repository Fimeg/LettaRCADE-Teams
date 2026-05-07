/**
 * useStreamingMessages - React hook for streaming agent messages via Letta SDK
 *
 * Uses conversations.messages.create with "default" conversation for agent-direct mode.
 */

import { useCallback, useRef, useState } from "react";
import { getLettaClient } from "../services/api";
import type {
  AssistantMessage,
  ReasoningMessage,
  ToolCallMessage,
  ToolReturnMessage,
  LettaStreamingResponse,
} from "../services/api";

/** Stream chunk types yielded to consumers */
export type StreamChunk =
  | { type: "assistant"; content: string }
  | { type: "reasoning"; reasoning: string }
  | { type: "tool_call"; name: string; arguments: Record<string, unknown> }
  | { type: "tool_return"; output: string }
  | { type: "error"; error_type: string; message: string }
  | { type: "ping" };

export interface UseStreamingMessagesReturn {
  /** Send a message and get an async generator of stream chunks */
  sendMessage: (content: string) => AsyncGenerator<StreamChunk, void, unknown>;
  /** Whether a streaming request is currently in progress */
  isStreaming: boolean;
  /** Error from the most recent streaming request, if any */
  error: Error | null;
  /** Abort the current streaming request (browser mode only) */
  abort: () => void;
}

/**
 * Hook for streaming messages to an agent using the Letta SDK.
 *
 * @param agentId - The agent ID to send messages to
 * @param conversationId - Optional conversation ID for context (defaults to "default")
 * @returns Object with sendMessage function, isStreaming state, and error state
 */
export function useStreamingMessages(
  agentId: string,
  conversationId: string | null
): UseStreamingMessagesReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
  }, []);

  // Actual implementation using async generator pattern
  const sendMessageImpl = useCallback(
    async function* (content: string): AsyncGenerator<StreamChunk, void, unknown> {
      setIsStreaming(true);
      setError(null);

      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        const client = getLettaClient();

        // Use "default" conversation for agent-direct messaging
        // Pass agent_id in body to identify target agent
        const convId = conversationId || "default";

        const body: Record<string, unknown> = {
          agent_id: agentId,
          messages: [{ role: "user", content, type: "message" }],
          streaming: true,
          stream_tokens: true,
          include_pings: true,
          background: true,
        };

        console.log(`[useStreamingMessages] Calling client.conversations.messages.create("${convId}", agentId=${agentId})`);
        const stream = await client.conversations.messages.create(convId, body);
        console.log(`[useStreamingMessages] Got stream, iterating chunks...`);

        let chunkCount = 0;
        for await (const chunk of stream) {
          // Check if aborted
          if (signal.aborted) {
            console.log('[useStreamingMessages] Stream aborted, stopping iteration');
            return;
          }

          chunkCount++;
          if (chunkCount === 1) console.log(`[useStreamingMessages] First chunk received`);
          const msg = chunk as LettaStreamingResponse;
          const messageType = (msg as unknown as { message_type: string }).message_type;

          console.log(`[useStreamingMessages] Chunk ${chunkCount}: message_type=${messageType}`);

          switch (messageType) {
            case "assistant_message": {
              const assistantMsg = msg as AssistantMessage;
              // Normalize content (can be string or array)
              let assistantContent: string;
              if (typeof assistantMsg.content === "string") {
                assistantContent = assistantMsg.content;
              } else if (Array.isArray(assistantMsg.content)) {
                assistantContent = assistantMsg.content
                  .map((c) => {
                    if (typeof c === "string") return c;
                    if (c && typeof c === "object" && "text" in c) {
                      return (c as { text?: string }).text || "";
                    }
                    return "";
                  })
                  .join("");
              } else {
                assistantContent = JSON.stringify(assistantMsg.content);
              }
              yield { type: "assistant" as const, content: assistantContent };
              break;
            }

            case "reasoning_message": {
              const reasoningMsg = msg as ReasoningMessage;
              yield { type: "reasoning" as const, reasoning: reasoningMsg.reasoning };
              break;
            }

            case "tool_call_message": {
              const toolCall = (msg as unknown as ToolCallMessage & {
                tool_call?: { name: string; arguments: Record<string, unknown> };
              }).tool_call;
              yield {
                type: "tool_call" as const,
                name: toolCall?.name || "unknown",
                arguments: toolCall?.arguments || {},
              };
              break;
            }

            case "tool_return_message": {
              const toolReturnMsg = msg as ToolReturnMessage;
              yield {
                type: "tool_return" as const,
                output: toolReturnMsg.tool_return || "",
              };
              break;
            }

            case "error_message": {
              const errorMsg = msg as unknown as {
                error_type?: string;
                message?: string;
              };
              yield {
                type: "error" as const,
                error_type: errorMsg.error_type || "unknown",
                message: errorMsg.message || "Unknown error",
              };
              break;
            }

            case "ping": {
              yield { type: "ping" as const };
              break;
            }

            case "usage_statistics": {
              // No-op for now - can be extended later
              break;
            }

            default: {
              // Unknown message type - skip
              console.warn(`[useStreamingMessages] Unknown message type: ${messageType}`);
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          console.log('[useStreamingMessages] Aborted');
          return;
        }
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        yield {
          type: "error" as const,
          error_type: "stream_error",
          message: error.message,
        };
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [agentId, conversationId]
  );

  // Return the async generator function directly
  return {
    sendMessage: sendMessageImpl as unknown as (
      content: string
    ) => AsyncGenerator<StreamChunk, void, unknown>,
    isStreaming,
    error,
    abort,
  };
}

export default useStreamingMessages;
