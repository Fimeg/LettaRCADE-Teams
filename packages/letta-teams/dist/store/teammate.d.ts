/**
 * Teammate storage - CRUD operations for teammate state files
 */
import type { ConversationTargetState, TeammateState } from "../types.js";
/**
 * Set the project directory override (used by daemon)
 */
export declare function setProjectDir(dir: string): void;
/**
 * Get the current project directory
 */
export declare function getProjectDir(): string;
/**
 * Get the .lteams directory path
 * Uses projectDirOverride if set, otherwise falls back to cwd
 */
export declare function getLteamsDir(): string;
/**
 * Ensure .lteams directory exists
 */
export declare function ensureLteamsDir(): void;
/**
 * Get the path to a teammate's JSON file
 */
export declare function getTeammatePath(name: string): string;
/**
 * Check if a teammate exists
 */
export declare function teammateExists(name: string): boolean;
/**
 * Load a teammate's state
 * Returns null if the file doesn't exist or is corrupted
 * Ensures the name field matches the filename (defensive against corrupted JSON)
 */
export declare function loadTeammate(name: string): TeammateState | null;
/**
 * Save a teammate's state
 */
export declare function saveTeammate(state: TeammateState): void;
export declare function getRootConversationId(state: TeammateState): string | undefined;
export declare function getConversationTarget(rootName: string, targetName: string): ConversationTargetState | null;
export declare function listConversationTargets(rootName: string): ConversationTargetState[];
/**
 * Get the memory target for a teammate (if any)
 */
export declare function getMemoryTarget(rootName: string): ConversationTargetState | undefined;
/**
 * Get the memory conversation ID for a teammate
 */
export declare function getMemoryConversationId(rootName: string): string | undefined;
export declare function targetExists(targetName: string): boolean;
export declare function createConversationTarget(rootName: string, target: Omit<ConversationTargetState, 'rootName' | 'kind' | 'name'> & {
    forkName: string;
    kind?: ConversationTargetState['kind'];
}): ConversationTargetState | null;
export declare function updateConversationTarget(rootName: string, targetName: string, updates: Partial<Pick<ConversationTargetState, 'conversationId' | 'lastActiveAt' | 'status' | 'parentTargetName' | 'parentConversationId'>>): ConversationTargetState | null;
/**
 * Update specific fields of a teammate
 */
export declare function updateTeammate(name: string, updates: Partial<Pick<TeammateState, "status" | "role" | "model" | "contextWindowLimit" | "lastUpdated" | "todoItems" | "statusSummary" | "statusEvents" | "errorDetails" | "spawnPrompt" | "targets" | "memfsEnabled" | "memfsStartup" | "memfsMemoryDir" | "memfsSyncStatus" | "memfsLastSyncedAt" | "memfsSyncError" | "initStatus" | "initTaskId" | "initConversationId" | "initError" | "selectedSpecId" | "selectedSpecTitle" | "initStartedAt" | "initCompletedAt">>): TeammateState | null;
/**
 * Remove a teammate's JSON file
 */
export declare function removeTeammate(name: string): boolean;
/**
 * List all teammates
 * Logs warnings for corrupted JSON files
 */
export declare function listTeammates(): TeammateState[];
