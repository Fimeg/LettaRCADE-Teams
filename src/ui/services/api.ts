/**
 * API client using @letta-ai/letta-client
 * Native Letta REST API — direct SDK usage, no wrappers.
 *
 * Consumers should call `getLettaClient()` and use SDK methods directly:
 *
 *   const client = getLettaClient();
 *   const agent = await client.agents.retrieve(id);
 *
 * The only helpers exported here are:
 *   - getLettaClient/getApiBase/getApiKey/resetClient — client lifecycle
 *   - listLLMModels/listEmbeddingModels — UI-shape normalization for the
 *     wizard / settings / models views (3+ call sites; worth dedup'ing)
 *   - systemApi — custom server probes (external memfs, health) that are
 *     not part of the SDK
 *   - deployApi — mock deploy API (placeholder)
 */

import { Letta } from "@letta-ai/letta-client";

// =============================================================================
// Client Initialization (3-Mode Architecture)
// =============================================================================
// Server: Direct HTTP to external Letta server (configured URL)
// Local: Spawn binary, connect to localhost:8283
// Remote: Direct HTTP to user-provided remote URL

let clientInstance: Letta | null = null;

export type ConnectionMode = 'server' | 'local' | 'remote';

export function getConnectionMode(): ConnectionMode {
  if (typeof window === 'undefined') return 'server';
  const mode = localStorage.getItem('letta_connection_mode') as ConnectionMode | null;
  return mode || 'server';
}

export function setConnectionMode(mode: ConnectionMode, remoteUrl?: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('letta_connection_mode', mode);
  if (mode === 'remote' && remoteUrl) {
    localStorage.setItem('letta_remote_url', remoteUrl);
  }
  // Reset client so next call uses new mode
  resetClient();
}

export function getRemoteUrl(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('letta_remote_url') || '';
}

export function getApiBase(): string {
  const mode = getConnectionMode();

  // Local mode: always localhost
  if (mode === 'local') {
    return 'http://localhost:8283';
  }

  // Remote mode: user-provided URL
  if (mode === 'remote') {
    const remoteUrl = getRemoteUrl();
    if (remoteUrl) return remoteUrl;
    // Fallback if no remote URL set
    return 'http://localhost:8283';
  }

  // Server mode: configured server URL
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
// Model normalization helpers
// =============================================================================
// The SDK returns raw model shapes that need to be normalized into the
// `{id, name, provider, contextWindow}` form the wizard / settings / models
// views all expect. Three consumers, identical normalization — keep this
// helper here rather than copy/pasting it three times.

export interface LLMModelOption {
  id: string;
  name: string;
  provider: string;
  description?: string;
  contextWindow?: number;
}

export interface EmbeddingModelOption {
  id: string;
  name: string;
  provider: string;
  dimensions?: number;
}

/** List all LLM models from the connected server, normalized for UI consumption. */
export async function listLLMModels(): Promise<LLMModelOption[]> {
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
}

/** List all embedding models from the connected server, normalized for UI. */
export async function listEmbeddingModels(): Promise<EmbeddingModelOption[]> {
  const client = getLettaClient();
  const models = await client.models.embeddings.list();
  return models.map((m) => {
    const raw = m as unknown as {
      handle?: string | null;
      embedding_model?: string;
      embedding_endpoint_type?: string;
      embedding_dim?: number;
      display_name?: string | null;
    };
    const id = raw.handle || raw.embedding_model || 'unknown';
    const provider = id.includes('/') ? id.split('/')[0] : (raw.embedding_endpoint_type ?? 'unknown');
    return {
      id,
      name: raw.display_name || id.split('/').pop() || id,
      provider,
      dimensions: raw.embedding_dim,
    };
  });
}

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
// Deploy API (mock)
// =============================================================================

export const deployApi = {
  /** Get deployment status for an agent */
  getDeployStatus: async (agentId: string): Promise<DeployedChannel[]> => {
    console.log(`[deployApi] Getting status for agent ${agentId}`);
    return Promise.resolve([
      { type: 'matrix', name: 'Matrix Bridge', status: 'disconnected' },
      { type: 'telegram', name: 'Telegram Bot', status: 'disconnected' },
    ]);
  },

  /** Undeploy a specific channel for an agent */
  undeployChannel: async (agentId: string, type: ChannelType): Promise<{ success: boolean }> => {
    console.log(`[deployApi] Undeploying ${type} channel for agent ${agentId}`);
    return Promise.resolve({ success: true });
  },

  /** Deploy an agent to configured channels */
  deployAgent: async (agentId: string, config: DeployConfig): Promise<{ success: boolean; channels: DeployedChannel[]; message?: string }> => {
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

    return Promise.resolve({ success: true, channels: deployedChannels });
  },

  /** Get available Matrix rooms */
  getMatrixRooms: async (): Promise<Array<{ id: string; name: string; topic?: string }>> => {
    return Promise.resolve([
      { id: '!example:matrix.org', name: 'General', topic: 'General discussion' },
      { id: '!dev:matrix.org', name: 'Development', topic: 'Dev chat' },
    ]);
  },

  /** Get available Telegram chats */
  getTelegramChats: async (): Promise<Array<{ id: string; name: string; type: 'user' | 'group' }>> => {
    return Promise.resolve([
      { id: '123456789', name: 'Personal', type: 'user' },
      { id: '-987654321', name: 'Team Group', type: 'group' },
    ]);
  },
};

// =============================================================================
// System API (server capabilities, health, external features)
// =============================================================================

export type ExternalMemfsPatch = 'core' | 'optional1' | 'optional2';

export interface ExternalMemfsStatus {
  /** Whether external memfs core patch is detected on the server */
  available: boolean;
  /** Per-patch detection. Optional patches are not externally observable
   *  without a dedicated health route; `optionalsKnown=false` means we
   *  cannot tell, not that they are absent. */
  patches: {
    core: boolean;
    optional1: boolean;
    optional2: boolean;
  };
  /** True iff we have a real signal for the optional patches (i.e. a
   *  dedicated /v1/external-memfs/health endpoint exists). */
  optionalsKnown: boolean;
  /** Human-readable summary */
  summary: 'none' | 'core' | 'core_optional1' | 'core_optional2' | 'core_all';
  /** Server version if available */
  serverVersion?: string;
  /** Error message if detection failed */
  error?: string;
}

/** OpenAPI path that the server_memory_sync_endpoint.patch adds. Presence of
 *  this path in /openapi.json is our deterministic signal that the core
 *  external-memfs patch is applied to the connected server. */
const SYNC_FROM_GIT_PATH = '/v1/agents/{agent_id}/memory/sync-from-git';

function summarizePatches(p: { core: boolean; optional1: boolean; optional2: boolean }): ExternalMemfsStatus['summary'] {
  if (!p.core) return 'none';
  if (p.optional1 && p.optional2) return 'core_all';
  if (p.optional1) return 'core_optional1';
  if (p.optional2) return 'core_optional2';
  return 'core';
}

export const systemApi = {
  /**
   * Detect external memfs capabilities on the connected server.
   *
   * Detection strategy:
   *   1. Try a dedicated /v1/external-memfs/health endpoint. None of the
   *      shipped patches add this today, but a future patch (or a server
   *      you're running) might — if it does, prefer that signal because
   *      it's the only way to know about the optional patches.
   *   2. Fall back to fetching /openapi.json and looking for the
   *      sync-from-git route. That route is added by the core patch and
   *      is the cleanest external probe we have. Optional patches do not
   *      add routes, so this fallback can detect core but not optionals.
   */
  detectExternalMemfs: async (): Promise<ExternalMemfsStatus> => {
    const baseURL = getApiBase();
    const apiKey = getApiKey();
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const root = baseURL.replace(/\/$/, '');

    // 1. Optional dedicated health endpoint (future patch).
    try {
      const res = await fetch(`${root}/v1/external-memfs/health`, { headers });
      if (res.ok) {
        const data = await res.json() as {
          core?: boolean;
          delete_propagation?: boolean;
          system_only_blocks?: boolean;
          optional1?: boolean;
          optional2?: boolean;
          version?: string;
        };
        const patches = {
          core: data.core ?? false,
          optional1: data.delete_propagation ?? data.optional1 ?? false,
          optional2: data.system_only_blocks ?? data.optional2 ?? false,
        };
        return {
          available: patches.core,
          patches,
          optionalsKnown: true,
          summary: summarizePatches(patches),
          serverVersion: data.version,
        };
      }
    } catch {
      // Health endpoint absent — fall through to openapi probe.
    }

    // 2. Probe /openapi.json for the sync-from-git route.
    try {
      const res = await fetch(`${root}/openapi.json`, { headers });
      if (!res.ok) {
        return {
          available: false,
          patches: { core: false, optional1: false, optional2: false },
          optionalsKnown: false,
          summary: 'none',
          error: `openapi.json returned ${res.status}`,
        };
      }
      const spec = await res.json() as { paths?: Record<string, unknown> };
      const corePresent = !!spec.paths && SYNC_FROM_GIT_PATH in spec.paths;
      const patches = {
        core: corePresent,
        optional1: false,
        optional2: false,
      };
      return {
        available: corePresent,
        patches,
        optionalsKnown: false,
        summary: corePresent ? 'core' : 'none',
      };
    } catch (err) {
      return {
        available: false,
        patches: { core: false, optional1: false, optional2: false },
        optionalsKnown: false,
        summary: 'none',
        error: err instanceof Error ? err.message : 'Detection failed',
      };
    }
  },

  /**
   * Check if server is reachable and get basic info
   */
  checkServerHealth: async (): Promise<{
    connected: boolean;
    version?: string;
    error?: string;
  }> => {
    const baseURL = getApiBase();
    const apiKey = getApiKey();
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    try {
      const response = await fetch(`${baseURL.replace(/\/$/, '')}/v1/agents/`, {
        method: 'GET',
        headers,
      });

      if (response.ok || response.status === 200) {
        return { connected: true };
      }
      return { connected: false, error: `Server returned ${response.status}` };
    } catch (err) {
      return {
        connected: false,
        error: err instanceof Error ? err.message : 'Connection failed',
      };
    }
  },
};

// =============================================================================
// Provider API (BYOK provider management)
// =============================================================================

export type ProviderCategory = 'base' | 'byok';

export type ProviderType =
  | 'anthropic' | 'azure' | 'baseten' | 'bedrock' | 'cerebras'
  | 'chatgpt_oauth' | 'deepseek' | 'fireworks' | 'google_ai'
  | 'google_vertex' | 'groq' | 'hugging-face' | 'letta'
  | 'lmstudio_openai' | 'minimax' | 'mistral' | 'ollama'
  | 'openai' | 'together' | 'vllm' | 'sglang' | 'openrouter' | 'xai'
  | 'zai' | 'zai_coding';

export interface Provider {
  id: string;
  name: string;
  provider_type: ProviderType;
  provider_category: ProviderCategory;
  api_key: string | null;
  base_url: string | null;
  access_key: string | null;
  region: string | null;
  api_version: string | null;
  organization_id: string;
  updated_at: string;
  last_synced: string | null;
  // Encrypted fields (prefixed with _enc in some responses)
  api_key_enc?: string;
  access_key_enc?: string;
}

/**
 * Provider API client using raw fetch (not wrapped in SDK yet).
 * The /v1/providers/ endpoints exist on OSS 16.7+ but aren't in the official SDK.
 */
export const providersApi = {
  /**
   * List all configured providers from the server.
   * Returns both base (Letta-hosted) and BYOK (user-configured) providers.
   */
  listProviders: async (): Promise<Provider[]> => {
    const baseURL = getApiBase();
    const apiKey = getApiKey();
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    try {
      const response = await fetch(`${baseURL.replace(/\/$/, '')}/v1/providers/`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      return await response.json() as Provider[];
    } catch (err) {
      console.error('[providersApi] Failed to list providers:', err);
      throw err;
    }
  },

  /**
   * Refresh a BYOK provider to fetch the latest models from its API.
   * Calls PATCH /v1/providers/{provider_id}/refresh
   */
  refreshProvider: async (providerId: string): Promise<Provider> => {
    const baseURL = getApiBase();
    const apiKey = getApiKey();
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    try {
      const response = await fetch(`${baseURL.replace(/\/$/, '')}/v1/providers/${providerId}/refresh`, {
        method: 'PATCH',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      return await response.json() as Provider;
    } catch (err) {
      console.error(`[providersApi] Failed to refresh provider ${providerId}:`, err);
      throw err;
    }
  },

  /**
   * Delete/remove a provider configuration.
   * Calls DELETE /v1/providers/{provider_id}
   */
  deleteProvider: async (providerId: string): Promise<void> => {
    const baseURL = getApiBase();
    const apiKey = getApiKey();
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    try {
      const response = await fetch(`${baseURL.replace(/\/$/, '')}/v1/providers/${providerId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok && response.status !== 204) {
        throw new Error(`Server returned ${response.status}`);
      }
    } catch (err) {
      console.error(`[providersApi] Failed to delete provider ${providerId}:`, err);
      throw err;
    }
  },

  /**
   * Check if the providers endpoint is available on this server.
   * Some self-hosted servers may not have the provider management feature.
   */
  isAvailable: async (): Promise<boolean> => {
    try {
      await providersApi.listProviders();
      return true;
    } catch {
      return false;
    }
  },
};
