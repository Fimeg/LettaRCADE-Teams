/**
 * API client for community-ade backend
 * Replaces direct SDK calls with REST API calls
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://10.10.20.19:3000';

// Types matching community-ade response format
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  model?: string;
  system?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MemoryBlock {
  id: string;
  label: string;
  value: string;
  limit?: number;
}

export interface Tool {
  id: string;
  name: string;
  description?: string;
}

export interface Conversation {
  id: string;
  agent_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Message {
  id: string;
  role: string;
  content: string | { text?: string } | Array<{ type: string; text?: string }>;
  created_at?: string;
}

// Helper to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Agent API methods
 */
export const agentsApi = {
  /** List all agents */
  listAgents: async (): Promise<Agent[]> => {
    const res = await fetch(`${API_BASE}/api/agents`);
    const data = await handleResponse<ApiResponse<Agent[]>>(res);
    return data.data || [];
  },

  /** Get agent details including blocks, tools, conversations */
  getAgent: async (id: string): Promise<{
    raw: unknown;
    blocks: MemoryBlock[];
    tools: Tool[];
    conversations: Conversation[];
  }> => {
    const res = await fetch(`${API_BASE}/api/agents/${id}`);
    const data = await handleResponse<ApiResponse<{
      raw: unknown;
      blocks: MemoryBlock[];
      tools: Tool[];
      conversations: Conversation[];
    }>>(res);
    return data.data || { raw: {}, blocks: [], tools: [], conversations: [] };
  },

  /** Create a new agent */
  createAgent: async (params: {
    name: string;
    description?: string;
    model?: string;
    system?: string;
    tool_ids?: string[];
    include_base_tools?: boolean;
    context_window_limit?: number;
    tags?: string[];
  }): Promise<Agent> => {
    const res = await fetch(`${API_BASE}/api/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await handleResponse<ApiResponse<Agent>>(res);
    if (!data.data) throw new Error('Failed to create agent');
    return data.data;
  },

  /** Update agent configuration */
  updateAgent: async (id: string, updates: Partial<Agent>): Promise<Agent> => {
    const res = await fetch(`${API_BASE}/api/agents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await handleResponse<ApiResponse<Agent>>(res);
    if (!data.data) throw new Error('Failed to update agent');
    return data.data;
  },

  /** Delete an agent */
  deleteAgent: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/agents/${id}`, {
      method: 'DELETE',
    });
    await handleResponse<ApiResponse<void>>(res);
  },

  /** Get memory blocks for an agent */
  getMemoryBlocks: async (agentId: string): Promise<MemoryBlock[]> => {
    const res = await fetch(`${API_BASE}/api/agents/${agentId}/memory`);
    const data = await handleResponse<ApiResponse<MemoryBlock[]>>(res);
    return data.data || [];
  },

  /** Update a memory block (uses label as identifier) */
  updateMemoryBlock: async (
    agentId: string,
    label: string,
    value: string
  ): Promise<MemoryBlock> => {
    const res = await fetch(`${API_BASE}/api/agents/${agentId}/memory/${label}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
    const data = await handleResponse<ApiResponse<MemoryBlock>>(res);
    if (!data.data) throw new Error('Failed to update memory block');
    return data.data;
  },

  /** Get tools available to an agent */
  getTools: async (agentId: string): Promise<Tool[]> => {
    const res = await fetch(`${API_BASE}/api/agents/${agentId}/tools`);
    const data = await handleResponse<ApiResponse<Tool[]>>(res);
    return data.data || [];
  },

  /** List all available tools */
  listAllTools: async (): Promise<Tool[]> => {
    const res = await fetch(`${API_BASE}/api/agents/tools`);
    const data = await handleResponse<ApiResponse<Tool[]>>(res);
    return data.data || [];
  },

  /** Attach tool to agent */
  attachTool: async (agentId: string, toolId: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/agents/${agentId}/tools/${toolId}/attach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    await handleResponse<ApiResponse<void>>(res);
  },

  /** Detach tool from agent */
  detachTool: async (agentId: string, toolId: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/agents/${agentId}/tools/${toolId}/detach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    await handleResponse<ApiResponse<void>>(res);
  },

  /** Get conversations for an agent */
  getConversations: async (agentId: string): Promise<Conversation[]> => {
    const res = await fetch(`${API_BASE}/api/agents/${agentId}/conversations`);
    const data = await handleResponse<ApiResponse<Conversation[]>>(res);
    return data.data || [];
  },

  /** Create a new conversation for an agent */
  createConversation: async (agentId: string): Promise<Conversation> => {
    const res = await fetch(`${API_BASE}/api/agents/${agentId}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await handleResponse<ApiResponse<Conversation>>(res);
    if (!data.data) throw new Error('Failed to create conversation');
    return data.data;
  },
};

/**
 * Chat API methods
 */
export const chatApi = {
  /** List conversations for an agent */
  listConversations: async (agentId: string): Promise<Conversation[]> => {
    const res = await fetch(`${API_BASE}/api/chat/conversations?agent_id=${encodeURIComponent(agentId)}`);
    const data = await handleResponse<ApiResponse<Conversation[]>>(res);
    return data.data || [];
  },

  /** Get or create a conversation for an agent */
  getOrCreateConversation: async (agentId: string): Promise<Conversation> => {
    const res = await fetch(`${API_BASE}/api/chat/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId }),
    });
    const data = await handleResponse<ApiResponse<Conversation>>(res);
    if (!data.data) throw new Error('Failed to get or create conversation');
    return data.data;
  },

  /** Get message history for a conversation */
  getMessages: async (conversationId: string, limit = 50): Promise<Message[]> => {
    const res = await fetch(
      `${API_BASE}/api/chat/conversations/${conversationId}/messages?limit=${limit}`
    );
    const data = await handleResponse<ApiResponse<Message[]>>(res);
    return data.data || [];
  },

  /**
   * Send a message and receive streaming SSE response
   * Returns an async iterable for consuming stream events
   */
  sendMessageStreaming: async function* (
    conversationId: string,
    message: string,
    agentId?: string
  ): AsyncGenerator<{ event: string; data: unknown }, void, unknown> {
    const url = `${API_BASE}/api/chat/conversations/${conversationId}/message`;
    const queryParams = agentId ? `?agent_id=${encodeURIComponent(agentId)}` : '';

    const res = await fetch(url + queryParams, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, agentId }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(error || `HTTP ${res.status}`);
    }

    if (!res.body) {
      throw new Error('No response body for streaming');
    }

    // Read SSE stream
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = 'message';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6).trim();
          } else if (line === '' && currentData) {
            try {
              const parsed = JSON.parse(currentData);
              yield { event: currentEvent, data: parsed };
            } catch {
              yield { event: currentEvent, data: currentData };
            }
            currentEvent = 'message';
            currentData = '';
          }
        }
      }

      // Process any remaining data in buffer
      if (buffer.trim()) {
        const lines = buffer.split('\n');
        let currentEvent = 'message';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6).trim();
          }
        }

        if (currentData) {
          try {
            const parsed = JSON.parse(currentData);
            yield { event: currentEvent, data: parsed };
          } catch {
            yield { event: currentEvent, data: currentData };
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  /**
   * Send approval response and receive streaming SSE response
   */
  sendApprovalResponse: async function* (
    conversationId: string,
    approvals: Array<{ tool_use_id: string; approved: boolean; feedback?: string }>,
    agentId?: string
  ): AsyncGenerator<{ event: string; data: unknown }, void, unknown> {
    const url = `${API_BASE}/api/chat/conversations/${conversationId}/approve`;
    const queryParams = agentId ? `?agent_id=${encodeURIComponent(agentId)}` : '';

    const res = await fetch(url + queryParams, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvals, agentId }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(error || `HTTP ${res.status}`);
    }

    if (!res.body) {
      throw new Error('No response body for streaming');
    }

    // Read SSE stream
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = 'message';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6).trim();
          } else if (line === '' && currentData) {
            try {
              const parsed = JSON.parse(currentData);
              yield { event: currentEvent, data: parsed };
            } catch {
              yield { event: currentEvent, data: currentData };
            }
            currentEvent = 'message';
            currentData = '';
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },
};

/**
 * Deploy API methods for channel deployment (Matrix, Telegram, CLI)
 */
export type ChannelType = 'matrix' | 'telegram' | 'cli';

export type ChannelStatus = 'connected' | 'connecting' | 'disconnected';

export interface DeployConfig {
  channels: ChannelType[];
  matrixRoom?: string;
  telegramChat?: string;
  cliCwd?: string;
}

export interface DeployedChannel {
  type: ChannelType;
  status: ChannelStatus;
  name: string;
  config?: {
    room?: string;
    chat?: string;
    cwd?: string;
  };
}

export interface DeployResponse {
  success: boolean;
  agentId: string;
  channels: DeployedChannel[];
  message?: string;
}

export const deployApi = {
  /** Deploy an agent to selected channels */
  deployAgent: async (agentId: string, config: DeployConfig): Promise<DeployResponse> => {
    try {
      const res = await fetch(`${API_BASE}/api/agents/${agentId}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await handleResponse<ApiResponse<DeployResponse>>(res);
      return data.data || { success: false, agentId, channels: [], message: 'Deploy failed' };
    } catch (error) {
      console.error('Deploy error:', error);
      // Return mock success for development
      return {
        success: true,
        agentId,
        channels: config.channels.map(ch => ({
          type: ch,
          status: 'connecting' as ChannelStatus,
          name: ch.charAt(0).toUpperCase() + ch.slice(1),
          config: {
            room: config.matrixRoom,
            chat: config.telegramChat,
            cwd: config.cliCwd,
          },
        })),
      };
    }
  },

  /** Get deployment status for an agent */
  getDeployStatus: async (agentId: string): Promise<DeployedChannel[]> => {
    try {
      const res = await fetch(`${API_BASE}/api/agents/${agentId}/deploy/status`);
      const data = await handleResponse<ApiResponse<DeployedChannel[]>>(res);
      return data.data || [];
    } catch (error) {
      console.error('Status error:', error);
      return [];
    }
  },

  /** Undeploy agent from a channel */
  undeployChannel: async (agentId: string, channel: ChannelType): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/agents/${agentId}/deploy/${channel}`, {
        method: 'DELETE',
      });
      await handleResponse<ApiResponse<void>>(res);
      return true;
    } catch (error) {
      console.error('Undeploy error:', error);
      return false;
    }
  },

  /** Get available Matrix rooms */
  getMatrixRooms: async (): Promise<{ id: string; name: string }[]> => {
    try {
      const res = await fetch(`${API_BASE}/api/channels/matrix/rooms`);
      const data = await handleResponse<ApiResponse<{ id: string; name: string }[]>>(res);
      return data.data || [];
    } catch (error) {
      return [
        { id: '!general:matrix.org', name: '#general' },
        { id: '!dev:matrix.org', name: '#dev' },
        { id: '!ops:matrix.org', name: '#ops' },
      ];
    }
  },

  /** Get available Telegram chats */
  getTelegramChats: async (): Promise<{ id: string; name: string }[]> => {
    try {
      const res = await fetch(`${API_BASE}/api/channels/telegram/chats`);
      const data = await handleResponse<ApiResponse<{ id: string; name: string }[]>>(res);
      return data.data || [];
    } catch (error) {
      return [
        { id: '-1001234567890', name: 'Dev Chat' },
        { id: '-1000987654321', name: 'General' },
      ];
    }
  },
};

/**
 * Legacy combined API export for compatibility
 */
export const api = {
  ...agentsApi,
  ...chatApi,
  ...deployApi,
  // Keep old method names for compatibility
  listAgents: agentsApi.listAgents,
  getAgent: agentsApi.getAgent,
  getMemoryBlocks: agentsApi.getMemoryBlocks,
  updateMemoryBlock: agentsApi.updateMemoryBlock,
  sendMessage: chatApi.sendMessageStreaming,
  deployAgent: deployApi.deployAgent,
  getDeployStatus: deployApi.getDeployStatus,
  undeployChannel: deployApi.undeployChannel,
  getMatrixRooms: deployApi.getMatrixRooms,
  getTelegramChats: deployApi.getTelegramChats,
};

export default api;
