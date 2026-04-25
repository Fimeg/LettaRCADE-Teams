import { useState, useCallback, useRef } from "react";
import { getLettaClient } from "../services/api";
import type { Message, UserMessage, AssistantMessage, SystemMessage } from "@letta-ai/letta-client/resources/agents/messages";
import type { StreamMessage } from "../types";

interface UseMessageHistoryReturn {
  messages: StreamMessage[];
  isLoading: boolean;
  error: string | null;
  loadMessages: (conversationId: string) => Promise<void>;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

/**
 * Extract text content from SDK message content (string or array of content parts)
 */
function extractContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (content && typeof content === "object") {
    // Handle array of content blocks (text, image, etc.)
    if (Array.isArray(content)) {
      return content
        .filter((c: { type?: string; text?: string }) => c.type === "text" || typeof c.text === "string")
        .map((c: { text?: string }) => c.text || "")
        .join("");
    }

    // Handle single object with text property
    const contentObj = content as { text?: string };
    if ("text" in contentObj && typeof contentObj.text === "string") {
      return contentObj.text;
    }
  }

  return "";
}

/**
 * Transform a Letta server REST API message (message_type: ...) into the UI's
 * SDKMessage shape (type: ...). The UI's MessageCard switches on `type`, so
 * passing raw REST messages through causes them to render as null — that's the
 * bug where assistant replies flash during streaming then vanish on history
 * refetch. Normalize to the SDKMessage shape the UI expects.
 */
function transformMessage(msg: Message): StreamMessage | null {
  const messageType = (msg as { message_type?: string }).message_type;
  const uuid = (msg as { id?: string }).id;

  switch (messageType) {
    case "user_message": {
      const userMsg = msg as UserMessage;
      return {
        type: "user_prompt" as const,
        prompt: extractContent(userMsg.content),
      };
    }

    case "assistant_message": {
      const assistantMsg = msg as AssistantMessage;
      return {
        type: "assistant",
        uuid,
        content: extractContent(assistantMsg.content),
      } as unknown as StreamMessage;
    }

    case "reasoning_message": {
      const reasoningMsg = msg as unknown as { reasoning?: string; content?: unknown };
      const reasoningText = reasoningMsg.reasoning ?? extractContent(reasoningMsg.content);
      return {
        type: "reasoning",
        uuid,
        content: reasoningText,
      } as unknown as StreamMessage;
    }

    case "tool_call_message": {
      const tcWrapper = msg as unknown as {
        tool_call?: { name?: string; arguments?: unknown; tool_call_id?: string };
      };
      const tc = tcWrapper.tool_call ?? {};
      let toolInput: unknown = tc.arguments ?? {};
      if (typeof toolInput === "string") {
        try { toolInput = JSON.parse(toolInput); } catch { /* leave as string */ }
      }
      return {
        type: "tool_call",
        uuid,
        toolCallId: tc.tool_call_id || uuid || "",
        toolName: tc.name || "unknown",
        toolInput,
      } as unknown as StreamMessage;
    }

    case "tool_return_message": {
      const trMsg = msg as unknown as {
        tool_return?: string;
        status?: string;
        tool_call_id?: string;
      };
      return {
        type: "tool_result",
        uuid,
        toolCallId: trMsg.tool_call_id || "",
        content: trMsg.tool_return || "",
        isError: trMsg.status === "error",
      } as unknown as StreamMessage;
    }

    case "system_message": {
      const systemMsg = msg as SystemMessage;
      return {
        type: "system" as const,
        content: extractContent(systemMsg.content),
      };
    }

    default:
      return null;
  }
}

/**
 * React hook for fetching and managing message history from Letta conversations.
 *
 * @param conversationId - The conversation ID to load messages from (null to skip)
 * @returns Object containing messages, loading state, error, and control functions
 */
export function useMessageHistory(conversationId: string | null): UseMessageHistoryReturn {
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Ref to track next cursor for pagination
  const nextCursorRef = useRef<string | null>(null);
  // Ref to track current conversation to detect changes
  const currentConversationIdRef = useRef<string | null>(null);

  const loadMessages = useCallback(async (convId: string) => {
    setIsLoading(true);
    setError(null);

    // Reset state if conversation changed
    if (currentConversationIdRef.current !== convId) {
      setMessages([]);
      nextCursorRef.current = null;
      currentConversationIdRef.current = convId;
    }

    try {
      console.log(`[useMessageHistory] Loading messages for conversation ${convId}`);
      const client = getLettaClient();
      const response = await client.conversations.messages.list(convId, {
        limit: 200,
        order: "asc",
      });
      console.log(`[useMessageHistory] Got response:`, typeof response, Array.isArray(response) ? `array[${response.length}]` : 'object');

      // Handle both array and paginated response formats
      const sdkMessages = Array.isArray(response) ? response : (response as { items?: Message[] }).items || [];
      console.log(`[useMessageHistory] Parsed ${sdkMessages.length} messages`);

      // Transform SDK messages to UI format
      const transformedMessages = sdkMessages
        .map(transformMessage)
        .filter((msg): msg is StreamMessage => msg !== null);

      setMessages(transformedMessages);

      // Check if there's a next page (simplified - assume no pagination for now)
      setHasMore(false);
      nextCursorRef.current = null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load messages";
      setError(errorMessage);
      console.error("[useMessageHistory] Failed to load messages:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    // Pagination not yet supported by this SDK version - just reload current messages
    if (!conversationId || isLoading) {
      return;
    }
    await loadMessages(conversationId);
  }, [conversationId, isLoading, loadMessages]);

  // Auto-load messages when conversationId changes
  // Note: This is handled by the consuming component calling loadMessages

  return {
    messages,
    isLoading,
    error,
    loadMessages,
    hasMore,
    loadMore,
  };
}
