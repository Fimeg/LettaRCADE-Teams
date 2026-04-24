import { useState, useCallback, useRef } from "react";
import { getLettaClient } from "../services/api";
import type { Message, UserMessage, AssistantMessage, SystemMessage, ToolCallMessage } from "@letta-ai/letta-client/resources/agents/messages";
import type { ToolReturnMessage } from "@letta-ai/letta-client/resources/tools";

// UI StreamMessage type matching the format expected by the UI
export interface StreamMessage {
  uuid: string;
  type: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
}

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
 * Transform SDK Message to UI StreamMessage format
 */
function transformMessage(msg: Message): StreamMessage | null {
  const baseMessage = {
    uuid: msg.id,
    createdAt: new Date(msg.date).getTime(),
  };

  // Get message type from the message_type field
  const messageType = (msg as { message_type?: string }).message_type;

  switch (messageType) {
    case "user_message": {
      const userMsg = msg as UserMessage;
      return {
        ...baseMessage,
        type: "user",
        content: extractContent(userMsg.content),
      };
    }

    case "assistant_message": {
      const assistantMsg = msg as AssistantMessage;
      return {
        ...baseMessage,
        type: "assistant",
        content: extractContent(assistantMsg.content),
      };
    }

    case "system_message": {
      const systemMsg = msg as SystemMessage;
      return {
        ...baseMessage,
        type: "system",
        content: systemMsg.content,
      };
    }

    case "tool_call_message": {
      const toolCallMsg = msg as ToolCallMessage;
      const toolName = toolCallMsg.tool_call?.name || "unknown";
      return {
        ...baseMessage,
        type: "system",
        content: `Tool call: ${toolName}`,
      };
    }

    case "tool_return_message": {
      const toolReturnMsg = msg as ToolReturnMessage;
      const status = toolReturnMsg.status || "success";
      const toolReturn = toolReturnMsg.tool_return || "";
      return {
        ...baseMessage,
        type: "system",
        content: `Tool result [${status}]: ${typeof toolReturn === "string" ? toolReturn : JSON.stringify(toolReturn)}`,
      };
    }

    default:
      // Skip other message types (reasoning_message, hidden_reasoning_message, etc.)
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
      const client = getLettaClient();
      const page = await client.conversations.messages.list(convId, {
        limit: 200,
        order: "asc",
      });

      const sdkMessages = page.getPaginatedItems();

      // Transform SDK messages to UI format
      const transformedMessages = sdkMessages
        .map(transformMessage)
        .filter((msg): msg is StreamMessage => msg !== null);

      setMessages(transformedMessages);

      // Check if there's a next page
      const nextCursor = page.getNextCursor();
      setHasMore(!!nextCursor);
      nextCursorRef.current = nextCursor || null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load messages";
      setError(errorMessage);
      console.error("[useMessageHistory] Failed to load messages:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!conversationId || !nextCursorRef.current || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = getLettaClient();
      const page = await client.conversations.messages.list(conversationId, {
        limit: 200,
        order: "asc",
        cursor: nextCursorRef.current,
      });

      const sdkMessages = page.getPaginatedItems();

      // Transform SDK messages to UI format
      const transformedMessages = sdkMessages
        .map(transformMessage)
        .filter((msg): msg is StreamMessage => msg !== null);

      // Append new messages to existing list
      setMessages((prev) => [...prev, ...transformedMessages]);

      // Update pagination state
      const nextCursor = page.getNextCursor();
      setHasMore(!!nextCursor);
      nextCursorRef.current = nextCursor || null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load more messages";
      setError(errorMessage);
      console.error("[useMessageHistory] Failed to load more messages:", err);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, isLoading]);

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
