/**
 * Task storage - CRUD operations for daemon task state
 */
import type { TaskKind, TaskState, TaskStatus, TeammateState } from "../types.js";
export interface StaleRunningInitTask {
    teammate: TeammateState;
    task: TaskState;
}
/**
 * Get the path to tasks.json (project-local)
 */
export declare function getTasksPath(): string;
/**
 * Load all tasks from tasks.json
 */
export declare function loadTasks(): Record<string, TaskState>;
/**
 * Save all tasks to tasks.json
 */
export declare function saveTasks(tasks: Record<string, TaskState>): void;
/**
 * Get a single task by ID
 */
export declare function getTask(taskId: string): TaskState | null;
export declare function createTask(teammateName: string, message: string, metadata?: Pick<TaskState, 'rootTeammateName' | 'targetName' | 'conversationId' | 'pipelineId' | 'requiresReview' | 'reviewTarget' | 'reviewGatePolicy' | 'reviewTaskId' | 'reviewStatus'> & {
    kind?: TaskKind;
}): TaskState;
/**
 * Update a task's status and result/error
 */
export declare function updateTask(taskId: string, updates: Partial<Pick<TaskState, "status" | "result" | "error" | "startedAt" | "completedAt" | "toolCalls" | "conversationId" | "targetName" | "rootTeammateName" | "initEvents" | "kind" | "pipelineId" | "requiresReview" | "reviewTarget" | "reviewGatePolicy" | "reviewTaskId" | "reviewStatus">>): TaskState | null;
/**
 * List all tasks, optionally filtered by status
 */
export declare function listTasks(status?: TaskStatus): TaskState[];
/**
 * List recent tasks (last N tasks, sorted by creation time)
 */
export declare function listRecentTasks(limit?: number): TaskState[];
/**
 * Clean up old completed/errored tasks (older than N days)
 */
export declare function cleanupOldTasks(daysOld?: number): number;
/**
 * Find tasks that would be pruned (completed/errored and older than N days)
 */
export declare function findTasksToPrune(daysOld?: number): TaskState[];
/**
 * Delete specific tasks by ID
 */
export declare function deleteTasks(taskIds: string[]): number;
/**
 * Find idle teammates (no activity in N days)
 */
export declare function findIdleTeammates(daysOld?: number): TeammateState[];
/**
 * Find broken teammates (no conversation ID)
 */
export declare function findBrokenTeammates(): TeammateState[];
/**
 * Delete teammates by name
 */
export declare function deleteTeammates(names: string[]): number;
/**
 * Find stale init tasks where teammate init is still marked running but
 * the init task has exceeded max age and remains pending/running.
 */
export declare function findStaleRunningInitTasks(maxAgeMinutes: number): StaleRunningInitTask[];
