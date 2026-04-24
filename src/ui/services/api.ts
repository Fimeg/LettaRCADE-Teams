/**
 * API client using @letta-ai/letta-client
 * Native Letta REST API - no wrapper needed
 */

import { Letta } from "@letta-ai/letta-client";

// =============================================================================
// Client Initialization
// =============================================================================

let clientInstance: Letta | null = null;

export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('letta_api_url');
    if (saved) return saved;
    // In browser dev mode with no saved URL, use Vite dev server (proxy)
    const isBrowserDev = !window.electron;
    if (isBrowserDev) {
      return window.location.origin; // e.g., http://localhost:5173
    }
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:8283';
}

export function getApiKey(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('letta_api_key');
    if (saved) return saved;
  }
  return import.meta.env.LETTA_API_KEY || '';
}

export function getLettaClient(): Letta {
  if (!clientInstance) {
    const baseURL = getApiBase();
    const apiKey = getApiKey();

    clientInstance = new Letta({
      baseURL,
      apiKey: apiKey || undefined,
    });
  }
  return clientInstance;
}

export function resetClient(): void {
  clientInstance = null;
}

// Re-export types from the Letta namespace
export type AgentState = Letta.AgentState;
export type BlockResponse = Letta.BlockResponse;
export type Tool = Letta.Tool;
export type Passage = Letta.Passage;

// Message types from Letta.Agents.Messages namespace
export type Message = Letta.Agents.Messages.Message;
export type AssistantMessage = Letta.Agents.Messages.AssistantMessage;
export type ReasoningMessage = Letta.Agents.Messages.ReasoningMessage;
export type ToolCallMessage = Letta.Agents.Messages.ToolCallMessage;
// ToolReturnMessage is in the Tools namespace
export type ToolReturnMessage = Letta.Tools.ToolReturnMessage;
export type LettaStreamingResponse = Letta.Agents.Messages.LettaStreamingResponse;

// Re-export Conversation type from resources
export type { Conversation } from "@letta-ai/letta-client/resources/conversations/conversations.js";

// =============================================================================
// Deployment Types
// =============================================================================

export type ChannelType = 'matrix' | 'telegram' | 'cli';

export type ChannelStatus = 'connected' | 'connecting' | 'disconnected';

export interface DeployedChannel {
  type: ChannelType;
  name: string;
  status: ChannelStatus;
  config?: {
    room?: string;
    chat?: string;
    cwd?: string;
  };
}

export interface DeployConfig {
  channels: ChannelType[];
  matrixRoom?: string;
  telegramChat?: string;
  cliCwd?: string;
}

// =============================================================================
// Agent API
// =============================================================================

export const agentsApi = {
  /** List all agents */
  listAgents: async () => {
    const client = getLettaClient();
    const agents: Letta.AgentState[] = [];
    for await (const agent of client.agents.list()) {
      agents.push(agent);
    }
    return agents;
  },

  /** Get agent details */
  getAgent: async (id: string) => {
    const client = getLettaClient();
    return await client.agents.retrieve(id);
  },

  /** Create a new agent */
  createAgent: async (params: {
    name: string;
    description?: string;
    model?: string;
    system?: string;
    memory_blocks?: Array<{ label: string; value: string }>;
    tools?: string[];
    tags?: string[];
  }) => {
    const client = getLettaClient();
    return await client.agents.create({
      name: params.name,
      description: params.description,
      model: params.model || "anthropic/claude-sonnet-4-5-20250929",
      embedding: "openai/text-embedding-3-small",
      memory_blocks: params.memory_blocks || [
        { label: "persona", value: params.system || "I am a helpful assistant." },
        { label: "human", value: "User information will be stored here." },
      ],
      tools: params.tools,
      tags: params.tags,
    });
  },

  /** Update agent */
  updateAgent: async (id: string, updates: Letta.AgentUpdateParams) => {
    const client = getLettaClient();
    return await client.agents.update(id, updates);
  },

  /** Delete agent */
  deleteAgent: async (id: string) => {
    const client = getLettaClient();
    return await client.agents.delete(id);
  },

  /** List agent's memory blocks */
  getMemoryBlocks: async (agentId: string) => {
    const client = getLettaClient();
    const blocks: Letta.BlockResponse[] = [];
    for await (const block of client.agents.blocks.list(agentId)) {
      blocks.push(block);
    }
    return blocks;
  },

  /** Get a specific memory block */
  getMemoryBlock: async (agentId: string, label: string) => {
    const client = getLettaClient();
    return await client.agents.blocks.retrieve(label, { agent_id: agentId });
  },

  /** Update a memory block */
  updateMemoryBlock: async (agentId: string, label: string, value: string) => {
    const client = getLettaClient();
    return await client.agents.blocks.update(label, {
      agent_id: agentId,
      value,
    });
  },

  /** List agent's tools */
  getTools: async (agentId: string) => {
    const client = getLettaClient();
    const tools: Letta.Tool[] = [];
    for await (const tool of client.agents.tools.list(agentId)) {
      tools.push(tool);
    }
    return tools;
  },

  /** Attach tool to agent */
  attachTool: async (agentId: string, toolId: string) => {
    const client = getLettaClient();
    return await client.agents.tools.attach(toolId, { agent_id: agentId });
  },

  /** Detach tool from agent */
  detachTool: async (agentId: string, toolId: string) => {
    const client = getLettaClient();
    return await client.agents.tools.detach(toolId, { agent_id: agentId });
  },

  /** List all available tools */
  listAllTools: async () => {
    const client = getLettaClient();
    const tools: Letta.Tool[] = [];
    for await (const tool of client.tools.list()) {
      tools.push(tool);
    }
    return tools;
  },

  /**
   * List all available LLM models from the Letta server.
   * Shape matches the ModelOption type expected by the wizard.
   */
  listAllModels: async (): Promise<Array<{
    id: string;
    name: string;
    provider: string;
    description?: string;
    contextWindow?: number;
  }>> => {
    const client = getLettaClient();
    const models = await client.models.list();
    return models.map((m) => {
      const raw = m as unknown as {
        handle?: string | null;
        model?: string;
        display_name?: string | null;
        context_window?: number;
        model_endpoint_type?: string;
      };
      const id = raw.handle || raw.model || 'unknown';
      const provider = id.includes('/') ? id.split('/')[0] : (raw.model_endpoint_type ?? 'unknown');
      return {
        id,
        name: raw.display_name || id.split('/').pop() || id,
        provider,
        contextWindow: raw.context_window,
      };
    });
  },

  /** Get passages (archival memory) */
  getPassages: async (agentId: string, search?: string, limit = 20) => {
    const client = getLettaClient();
    const options = search ? { search, limit } : { limit };
    // Note: passages.list returns an array directly, not a page promise
    return await client.agents.passages.list(agentId, options);
  },

  /** Create passage (archival memory) */
  createPassage: async (agentId: string, text: string) => {
    const client = getLettaClient();
    return await client.agents.passages.create(agentId, { text });
  },

  /** Delete passage */
  deletePassage: async (agentId: string, passageId: string) => {
    const client = getLettaClient();
    return await client.agents.passages.delete(passageId, { agent_id: agentId });
  },
};

// =============================================================================
// Message API (Streaming)
// =============================================================================

export const chatApi = {
  /** Send a message and get full response (non-streaming) */
  sendMessage: async (agentId: string, content: string) => {
    const client = getLettaClient();
    return await client.agents.messages.create(agentId, {
      messages: [{ role: "user", content }],
    });
  },

  /** Stream agent responses */
  streamMessage: async function* (
    agentId: string,
    content: string
  ): AsyncGenerator<
    | { type: "reasoning"; reasoning: string }
    | { type: "assistant"; content: string }
    | { type: "tool_call"; name: string; arguments: Record<string, unknown> }
    | { type: "tool_return"; output: string }
    | { type: "ping" }
    | { type: "error"; error_type: string; message: string }
    | { type: "usage"; stats: unknown },
    void,
    unknown
  > {
    const client = getLettaClient();
    const stream = await client.agents.messages.create(agentId, {
      messages: [{ role: "user", content }],
      streaming: true,
    });

    for await (const chunk of stream) {
      const msg = chunk as Letta.Agents.Messages.LettaStreamingResponse;

      // Check message_type to determine the type of message
      const messageType = (msg as unknown as { message_type: string }).message_type;

      switch (messageType) {
        case "reasoning_message":
          yield { type: "reasoning", reasoning: (msg as Letta.Agents.Messages.ReasoningMessage).reasoning };
          break;
        case "assistant_message":
          const assistantMsg = msg as Letta.Agents.Messages.AssistantMessage;
          // Content can be string or LettaAssistantMessageContentUnion[]
          let assistantContent: string;
          if (typeof assistantMsg.content === "string") {
            assistantContent = assistantMsg.content;
          } else if (Array.isArray(assistantMsg.content)) {
            assistantContent = assistantMsg.content.map(c => {
              if (typeof c === 'string') return c;
              if (c && typeof c === 'object' && 'text' in c) return (c as { text?: string }).text || '';
              return '';
            }).join('');
          } else {
            assistantContent = JSON.stringify(assistantMsg.content);
          }
          yield { type: "assistant", content: assistantContent };
          break;
        case "tool_call_message":
          yield {
            type: "tool_call",
            name: (msg as unknown as { tool_call?: { name: string } }).tool_call?.name || "unknown",
            arguments: (msg as unknown as { tool_call?: { arguments: Record<string, unknown> } }).tool_call?.arguments || {},
          };
          break;
        case "tool_return_message":
          yield { type: "tool_return", output: (msg as Letta.Tools.ToolReturnMessage).tool_return || "" };
          break;
        case "ping":
          yield { type: "ping" };
          break;
        case "error_message":
          yield {
            type: "error",
            error_type: (msg as unknown as { error_type?: string }).error_type || "unknown",
            message: (msg as unknown as { message?: string }).message || "Unknown error",
          };
          break;
        case "usage_statistics":
          yield { type: "usage", stats: msg };
          break;
      }
    }
  },

  /** Get message history */
  getMessages: async (agentId: string) => {
    const client = getLettaClient();
    const messages: Letta.Agents.Messages.Message[] = [];
    for await (const message of client.agents.messages.list(agentId)) {
      messages.push(message);
    }
    return messages;
  },
};

// =============================================================================
// Conversation API
// =============================================================================

export const conversationsApi = {
  /** List all conversations for an agent */
  listConversations: async (agentId: string): Promise<Letta.Conversation[]> => {
    const client = getLettaClient();
    return await client.conversations.list({ agent_id: agentId });
  },

  /** Create a new conversation for an agent */
  createConversation: async (agentId: string): Promise<Letta.Conversation> => {
    const client = getLettaClient();
    return await client.conversations.create({ agent_id: agentId });
  },

  /** Delete a conversation */
  deleteConversation: async (conversationId: string): Promise<void> => {
    const client = getLettaClient();
    await client.conversations.delete(conversationId);
  },
};

// =============================================================================
// Deploy API
// =============================================================================

export const deployApi = {
  /** Get deployment status for an agent */
  getDeployStatus: async (agentId: string): Promise<DeployedChannel[]> => {
    // Mock implementation - returns dummy data
    console.log(`[deployApi] Getting status for agent ${agentId}`);
    return Promise.resolve([
      {
        type: 'matrix',
        name: 'Matrix Bridge',
        status: 'disconnected',
      },
      {
        type: 'telegram',
        name: 'Telegram Bot',
        status: 'disconnected',
      },
    ]);
  },

  /** Undeploy a specific channel for an agent */
  undeployChannel: async (agentId: string, type: ChannelType): Promise<{ success: boolean }> => {
    // Mock implementation
    console.log(`[deployApi] Undeploying ${type} channel for agent ${agentId}`);
    return Promise.resolve({ success: true });
  },

  /** Deploy an agent to configured channels */
  deployAgent: async (agentId: string, config: DeployConfig): Promise<{ success: boolean; channels: DeployedChannel[]; message?: string }> => {
    // Mock implementation
    console.log(`[deployApi] Deploying agent ${agentId} to channels:`, config.channels);
    const deployedChannels: DeployedChannel[] = config.channels.map((channel) => {
      const base: DeployedChannel = {
        type: channel,
        name: channel === 'matrix' ? 'Matrix Bridge' : channel === 'telegram' ? 'Telegram Bot' : 'CLI Interface',
        status: 'connecting',
      };

      if (channel === 'matrix' && config.matrixRoom) {
        base.config = { room: config.matrixRoom };
      } else if (channel === 'telegram' && config.telegramChat) {
        base.config = { chat: config.telegramChat };
      } else if (channel === 'cli' && config.cliCwd) {
        base.config = { cwd: config.cliCwd };
      }

      return base;
    });

    return Promise.resolve({
      success: true,
      channels: deployedChannels,
    });
  },

  /** Get available Matrix rooms */
  getMatrixRooms: async (): Promise<Array<{ id: string; name: string; topic?: string }>> => {
    // Mock implementation
    return Promise.resolve([
      { id: '!example:matrix.org', name: 'General', topic: 'General discussion' },
      { id: '!dev:matrix.org', name: 'Development', topic: 'Dev chat' },
    ]);
  },

  /** Get available Telegram chats */
  getTelegramChats: async (): Promise<Array<{ id: string; name: string; type: 'user' | 'group' }>> => {
    // Mock implementation
    return Promise.resolve([
      { id: '123456789', name: 'Personal', type: 'user' },
      { id: '-987654321', name: 'Team Group', type: 'group' },
    ]);
  },
};

// =============================================================================
// Legacy combined export for compatibility
// =============================================================================

export const api = {
  ...agentsApi,
  ...chatApi,
  ...conversationsApi,
};

export default api;
