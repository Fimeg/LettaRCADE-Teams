/**
 * IPC client module - CLI communication with the daemon
 *
 * Provides functions to:
 * - Check if daemon is running
 * - Start daemon if not running
 * - Send dispatch/status commands to daemon
 * - Wait for task completion
 */
import type { DaemonMessage, DaemonResponse, TaskState, TeammateState } from "./types.js";
/**
 * Check if the daemon is running by checking PID file and process
 */
export declare function isDaemonRunning(): boolean;
/**
 * Wait for daemon to be ready (socket accepting connections)
 */
export declare function waitForDaemon(timeoutMs?: number): Promise<boolean>;
/**
 * Get the path to the daemon log file
 */
export declare function getDaemonLogPath(): string;
/**
 * Start the daemon in the background
 * Uses spawn() with detached: true and redirects output to log file
 */
export declare function startDaemonInBackground(): number | null;
/**
 * Start the daemon and wait for it to be ready
 */
export declare function startDaemon(): Promise<boolean>;
/**
 * Ensure daemon is running, starting it if necessary
 */
export declare function ensureDaemonRunning(): Promise<void>;
/**
 * Send a message to the daemon and get the response
 */
export declare function sendToDaemon(msg: DaemonMessage, options?: {
    timeoutMs?: number;
}): Promise<DaemonResponse>;
/**
 * Dispatch a task to a teammate via the daemon
 */
export declare function dispatchTask(targetName: string, message: string, options?: {
    projectDir?: string;
    pipelineId?: string;
    review?: {
        reviewer: string;
        gate: "on_success" | "always";
        template?: string;
        assignments: {
            name: string;
            message: string;
        }[];
    };
}): Promise<{
    taskId: string;
}>;
/**
 * Get task status from daemon
 */
export declare function getTaskStatus(taskId: string, projectDir?: string): Promise<TaskState | null>;
/**
 * List recent tasks from daemon
 */
export declare function listTasks(projectDir?: string): Promise<TaskState[]>;
/**
 * Wait for a task to complete, polling for status
 */
export declare function waitForTask(taskId: string, options?: {
    pollIntervalMs?: number;
    timeoutMs?: number;
    projectDir?: string;
}): Promise<TaskState>;
/**
 * Dispatch a task and wait for completion
 */
export declare function dispatchAndWait(targetName: string, message: string, options?: {
    pollIntervalMs?: number;
    timeoutMs?: number;
}): Promise<TaskState>;
/**
 * Spawn a teammate via the daemon (blocking operation)
 * Uses createSession internally, so needs daemon to avoid CLI timeout
 */
export declare function spawnTeammateViaDaemon(name: string, role: string, options?: {
    model?: string;
    contextWindowLimit?: number;
    spawnPrompt?: string;
    skipInit?: boolean;
    memfsEnabled?: boolean;
    memfsStartup?: import("./types.js").MemfsStartup;
    timeoutMs?: number;
    projectDir?: string;
}): Promise<TeammateState>;
export declare function startCouncilViaDaemon(prompt: string, options?: {
    message?: string;
    participantNames?: string[];
    maxTurns?: number;
    timeoutMs?: number;
    projectDir?: string;
}): Promise<{
    sessionId: string;
}>;
export declare function killTeammateViaDaemon(name: string, options?: {
    timeoutMs?: number;
    projectDir?: string;
}): Promise<{
    name: string;
    cancelled: number;
}>;
export declare function forkTeammateViaDaemon(rootName: string, forkName: string, options?: {
    timeoutMs?: number;
    projectDir?: string;
}): Promise<TeammateState>;
export declare function reinitTeammateViaDaemon(rootName: string, options?: {
    prompt?: string;
    timeoutMs?: number;
    projectDir?: string;
}): Promise<string>;
