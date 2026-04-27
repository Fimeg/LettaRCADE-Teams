/**
 * Letta SDK message types for UI communication.
 * Re-exports SDK 0.1.14 types with UI-specific extensions.
 */

// Re-export all SDK message types (only types that exist in SDK 0.1.14)
export type {
  SDKMessage,
  SDKInitMessage,
  SDKAssistantMessage,
  SDKToolCallMessage,
  SDKToolResultMessage,
  SDKReasoningMessage,
  SDKResultMessage,
  SDKStreamEventMessage,
  SDKErrorMessage,
  SDKRetryMessage,
  SDKStreamEventPayload,
  SDKStreamEventDeltaPayload,
  SDKStreamEventMessagePayload,
  SDKUnknownStreamEventPayload,
  SDKErrorCode,
  CanUseToolResponse,
  CanUseToolResponseAllow,
  CanUseToolResponseDeny,
  CanUseToolCallback,
  TextContent,
  ImageContent,
  MessageContentItem,
  SendMessage,
  AgentTool,
  AnyAgentTool,
  AgentToolResult,
  AgentToolResultContent,
  AgentToolUpdateCallback,
  CreateSessionOptions,
  CreateAgentOptions,
  ListMessagesOptions,
  ListMessagesResult,
  BootstrapStateOptions,
  BootstrapStateResult,
  RunTurnOptions,
  RecoverPendingApprovalsOptions,
  RecoverPendingApprovalsResult,
  SkillSource,
  SleeptimeTrigger,
  SleeptimeBehavior,
  SleeptimeOptions,
  EffectiveSleeptimeSettings,
  PermissionMode,
} from "@letta-ai/letta-code-sdk";

// UI-specific types not in SDK
export type InternalSessionOptions = {
  agentId?: string;
  conversationId?: string;
  model?: string;
  tools?: string[];
  memfsEnabled?: boolean;
  skillSources?: import("@letta-ai/letta-code-sdk").SkillSource[];
  systemInfoReminderEnabled?: boolean;
  sleeptime?: import("@letta-ai/letta-code-sdk").SleeptimeOptions;
};

export type SystemPromptPreset = "default" | "letta-claude" | "letta-codex" | "letta-gemini" | "claude" | "codex" | "gemini";

export interface SystemPromptPresetConfigSDK {
  preset?: SystemPromptPreset;
  custom?: string;
}

export type SystemPromptConfig = string | SystemPromptPresetConfigSDK;

export interface BlockReference {
  type: "block";
  name?: string;
  label: string;
}

export type MemoryItem = string | { label: string; value: string; limit?: number } | BlockReference;

export type MemoryPreset = "persona" | "human" | "skills" | "loaded_skills";

export interface ExecuteExternalToolRequest {
  toolName: string;
  toolInput: Record<string, unknown>;
}

// UI-specific message type (not in SDK)
export type UserPromptMessage = {
  type: "user_prompt";
  prompt: string;
};

// System message for command output (not in SDK)
export type SystemMessage = {
  type: "system";
  content: string;
};

// Import for union type and local use
import type { SDKMessage, CanUseToolResponse } from "@letta-ai/letta-code-sdk";

export type StreamMessage = SDKMessage | UserPromptMessage | SystemMessage;

export type SessionStatus = "idle" | "running" | "completed" | "error";

export type SessionInfo = {
  id: string;
  title: string;
  status: SessionStatus;
  lettaConversationId?: string;
  agentId?: string;
  cwd?: string;
  createdAt: number;
  updatedAt: number;
};

// Server -> Client events
export type ServerEvent =
  | { type: "stream.message"; payload: { sessionId: string; message: StreamMessage } }
  | { type: "stream.user_prompt"; payload: { sessionId: string; prompt: string } }
  | { type: "session.status"; payload: { sessionId: string; status: SessionStatus; title?: string; cwd?: string; agentId?: string; error?: string } }
  | { type: "session.list"; payload: { sessions: SessionInfo[] } }
  | { type: "session.history"; payload: { sessionId: string; status: SessionStatus; messages: StreamMessage[] } }
  | { type: "session.deleted"; payload: { sessionId: string } }
  | { type: "permission.request"; payload: { sessionId: string; toolUseId: string; toolName: string; input: unknown } }
  | { type: "runner.error"; payload: { sessionId?: string; message: string } };

// Client -> Server events
export type ClientEvent =
  | { type: "session.start"; payload: { title: string; prompt: string; agentId?: string; cwd?: string; allowedTools?: string } }
  | { type: "session.continue"; payload: { sessionId: string; prompt: string; cwd?: string } }
  | { type: "session.stop"; payload: { sessionId: string } }
  | { type: "session.delete"; payload: { sessionId: string } }
  | { type: "session.list" }
  | { type: "session.history"; payload: { sessionId: string } }
  | { type: "permission.response"; payload: { sessionId: string; toolUseId: string; result: CanUseToolResponse } };
