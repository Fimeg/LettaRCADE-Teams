/// <reference types="vite/client" />

// Type imports for electron API
import type { LettaCodeStatusPayload } from '../electron/letta-code-manager.js';
import type { DispatchTaskInput, SpawnTeammateInput, TaskStatus } from 'letta-teams/types';

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
      teams: {
        getAgentTeammateMap: () => Promise<Record<string, string>>;
        configure: (input?: Partial<TeamsRuntimeConfig>) => Promise<TeamsRuntimeSnapshot>;
        getDaemonStatus: () => Promise<TeamsDaemonStatusPayload>;
        ensureDaemonRunning: () => Promise<TeamsDaemonStatusPayload>;
        listTeammates: () => Promise<TeamsTeammateState[]>;
        getTeammate: (name: string) => Promise<TeamsTeammateState | null>;
        spawnTeammate: (input: SpawnTeammateInput) => Promise<TeamsTeammateState>;
        forkTeammate: (name: string, forkName: string) => Promise<TeamsTeammateState>;
        reinitTeammate: (name: string, prompt?: string) => Promise<string>;
        listTasks: (status?: TaskStatus) => Promise<TeamsTaskState[]>;
        getTask: (id: string) => Promise<TeamsTaskState | null>;
        dispatchTask: (input: DispatchTaskInput) => Promise<{ taskId: string }>;
        waitForTask: (id: string) => Promise<TeamsTaskState>;
        cancelTask: (id: string) => Promise<TeamsTaskState>;
      };
      /** 3-mode connection health check */
      letta: {
        healthCheck: (url: string, apiKey?: string) => Promise<{
          healthy: boolean;
          status?: number;
          error?: string;
          errorType?: 'connection-refused' | 'dns-failed' | 'timeout' | 'ssl-error' | 'cors-error' | 'network-error' | 'unknown';
          url?: string;
          body?: string;
        }>;
      };
    };
  }

  /** IPC event payload type mapping for type-safe invoke/handle */
  interface EventPayloadMapping {
    'getStaticData': { platform: string; arch: string; cpuModel: string };
    'get-config': any;
    'save-config': any;
    'get-runtime-env': any;
    'get-recent-cwds': string[];
    'select-directory': string | null;
    'operator-profile:get': { displayName?: string; memfsGitUrlTemplate?: string } | null;
    'operator-profile:save': void;
    'letta-code:get-status': any;
    'letta-code:spawn': { ok: boolean; error?: string };
    'letta-code:stop': { ok: boolean; error?: string };
    'letta:health-check': {
      healthy: boolean;
      status?: number;
      error?: string;
      errorType?: 'connection-refused' | 'dns-failed' | 'timeout' | 'ssl-error' | 'cors-error' | 'network-error' | 'unknown';
      url?: string;
      body?: string;
    };
    'teams:agent-teammate-map': Record<string, string>;
    'teams:daemon:get-status': any;
    'teams:daemon:ensure-running': any;
    'teams:teammates:list': any[];
    'teams:teammates:get': any;
    'teams:teammates:spawn': any;
    'teams:teammates:fork': any;
    'teams:teammates:reinit': string;
    'teams:tasks:list': any[];
    'teams:tasks:get': any;
    'teams:tasks:dispatch': { taskId: string };
    'teams:tasks:wait': any;
    'teams:tasks:cancel': any;
    'teams:councils:start': any;
    'teams:councils:list': any[];
    'teams:councils:get': any;
    'teams:configure': any;
    'statistics': { cpuUsage: number; ramUsage: number; storageData: number };
  }
}

export {};
