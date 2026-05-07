import { execFileSync } from "node:child_process";
import type { TeammateState } from "./types.js";
export declare const MEMORY_FS_ROOT = ".letta";
export declare const MEMORY_FS_AGENTS_DIR = "agents";
export declare const MEMORY_FS_MEMORY_DIR = "memory";
export declare const MEMORY_SYSTEM_DIR = "system";
export declare function setMemfsGitExecutor(executor: typeof execFileSync): void;
export declare function resetMemfsGitExecutor(): void;
export declare function getMemoryFilesystemRoot(agentId: string, homeDir?: string): string;
export declare function getOwnedMemfsFiles(): string[];
export declare function getMemorySystemDir(agentId: string, homeDir?: string): string;
export declare function ensureMemoryFilesystemDirs(agentId: string, homeDir?: string): void;
export declare function scaffoldTeammateMemfs(state: TeammateState, options?: {
    identityOnly?: boolean;
}): void;
export declare function isMemfsGitRepo(agentId: string, homeDir?: string): boolean;
export declare function syncOwnedMemfsFiles(state: TeammateState, reason: string): {
    synced: boolean;
    committed: boolean;
    timestamp?: string;
};
export declare function updateTeammateInitScaffold(state: TeammateState): void;
