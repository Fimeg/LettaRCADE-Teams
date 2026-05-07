/**
 * Daemon module - long-running process that handles agent sessions
 *
 * The daemon owns all SDK sessions, allowing CLI commands to dispatch
 * tasks and exit immediately while the daemon continues processing.
 */
import type { TeammateState } from "./types.js";
/**
 * Get the path to the daemon PID file
 */
export declare function getDaemonPidPath(): string;
/**
 * Get the path to the daemon port file
 */
export declare function getDaemonPortPath(): string;
/**
 * Get the configured port (from file or default)
 */
export declare function getDaemonPort(): number;
export declare function recoverStaleInitTasks(): Promise<void>;
export declare function startBackgroundInit(teammate: TeammateState, options?: {
    message: string;
    prompt: string;
    syncReason: string;
}): Promise<string>;
/**
 * Process a task by messaging the teammate
 */
interface ProcessTaskOptions {
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
}
export declare function processTask(taskId: string, targetName: string, message: string, options?: ProcessTaskOptions): Promise<void>;
/**
 * Start the daemon
 */
export declare function startDaemon(port?: number): Promise<void>;
/**
 * Stop a running daemon (via IPC)
 */
export declare function stopDaemon(): Promise<boolean>;
export {};
