/**
 * TODO and status event storage - operations for todo items and status tracking
 */
import type { StatusEvent, StatusEventType, StatusPhase, TeammateState, TeammateStatus, TodoItem, TodoPriority } from "../types.js";
export interface UpdateStatusSummaryInput {
    phase: StatusPhase;
    message: string;
    progress?: number;
    currentTodoId?: string;
    filesTouched?: string[];
    testsRun?: string;
    blockedReason?: string;
    codeChange?: boolean;
    eventType?: StatusEventType;
}
/**
 * Update status
 */
export declare function updateStatus(name: string, status: TeammateStatus): TeammateState | null;
/**
 * Set error details
 */
export declare function setError(name: string, errorDetails: string): TeammateState | null;
/**
 * Add a TODO item
 */
export declare function addTodo(name: string, input: {
    title: string;
    priority?: TodoPriority;
    notes?: string;
}): TeammateState | null;
/**
 * List TODO items
 */
export declare function listTodoItems(name: string): TodoItem[];
/**
 * Start working on a TODO item
 */
export declare function startTodo(name: string, todoId: string, options?: {
    message?: string;
}): TeammateState | null;
export declare function blockTodo(name: string, todoId: string, reason: string, options?: {
    message?: string;
}): TeammateState | null;
export declare function unblockTodo(name: string, todoId: string, options?: {
    message?: string;
}): TeammateState | null;
export declare function completeTodo(name: string, todoId: string, options?: {
    message?: string;
}): TeammateState | null;
export declare function dropTodo(name: string, todoId: string, options?: {
    reason?: string;
}): TeammateState | null;
export declare function updateStatusSummary(name: string, input: UpdateStatusSummaryInput, options?: {
    todoItemsOverride?: TodoItem[];
}): TeammateState | null;
export declare function getRecentStatusEvents(name: string, limit?: number): StatusEvent[];
export declare function findStaleTeammates(maxSilentMinutes: number): TeammateState[];
