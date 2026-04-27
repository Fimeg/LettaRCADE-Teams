/// <reference types="vite/client" />

// Type imports for electron API
import type { LettaCodeStatusPayload } from '../electron/letta-code-manager.js';

declare global {
  interface Window {
    electronAPI?: {
      send: (channel: string, data: unknown) => void;
      on: (channel: string, callback: (data: unknown) => void) => () => void;
      invoke: (channel: string, data?: unknown) => Promise<unknown>;
    };

    /** Electron IPC API exposed by preload script */
    electron: {
      subscribeStatistics: (callback: (stats: { cpuUsage: number; ramUsage: number; storageData: number }) => void) => () => void;
      getStaticData: () => Promise<{ platform: string; arch: string; cpuModel: string }>;
      sendClientEvent: (event: any) => void;
      onServerEvent: (callback: (event: any) => void) => () => void;
      getRecentCwds: (limit?: number) => Promise<string[]>;
      selectDirectory: () => Promise<string | null>;
      getConfig: () => Promise<any>;
      saveConfig: (config: { serverUrl?: string; apiKey?: string; permissionMode?: 'strict' | 'bypass'; windowWidth?: number; windowHeight?: number; theme?: 'light' | 'dark'; pollingInterval?: number; externalMemfsEnabled?: boolean }) => Promise<any>;
      getRuntimeEnv: () => Promise<any>;
      getOperatorProfile: () => Promise<{ displayName?: string; memfsGitUrlTemplate?: string } | null>;
      saveOperatorProfile: (profile: { displayName?: string; memfsGitUrlTemplate?: string }) => Promise<void>;
      operatorSecrets: {
        setMemfsToken: (token: string) => Promise<void>;
        hasMemfsToken: () => Promise<boolean>;
        clearMemfsToken: () => Promise<void>;
      };
      lettaCode: {
        getStatus: () => Promise<LettaCodeStatusPayload>;
        spawn: (opts?: { cwd?: string; serverUrl?: string; apiKey?: string; agentId?: string; agentMetadataEnv?: { letta_memfs_git_url?: string; letta_memfs_local?: string } }) => Promise<{ ok: boolean; error?: string }>;
        stop: () => Promise<{ ok: boolean; error?: string }>;
        onStatus: (callback: (payload: LettaCodeStatusPayload) => void) => () => void;
        onLog: (callback: (entry: { stream: "stdout" | "stderr"; line: string }) => void) => () => void;
      };
      /** 3-mode connection health check */
      letta: {
        healthCheck: (url: string, apiKey?: string) => Promise<{ healthy: boolean; error?: string }>;
      };
    };
  }
}

export {};
