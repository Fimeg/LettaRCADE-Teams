/**
 * Agent module - SDK wrappers for spawning and messaging teammates
 */
import type { AnyAgentTool } from "@letta-ai/letta-code-sdk";
import type { TeammateState, MemfsStartup } from "./types.js";
export declare function forkTeammate(rootName: string, forkName: string): Promise<TeammateState>;
/**
 * Check if API key is available (stored token or env var)
 * and set it in process.env for the SDK to use.
 *
 * This mutation is intentional and necessary because:
 * - The Letta SDK reads from process.env.LETTA_API_KEY
 * - Users may have stored their key via `letta-teams auth` without setting the env var
 * - This bridges the gap between stored tokens and SDK expectations
 *
 * @throws Error if API key is not set
 */
export declare function checkApiKey(): void;
/**
 * Spawn options
 */
export interface SpawnOptions {
    model?: string;
    contextWindowLimit?: number;
    spawnPrompt?: string;
    skipInit?: boolean;
    memfsEnabled?: boolean;
    memfsStartup?: MemfsStartup;
}
/**
 * Validate teammate name
 * @throws Error if name is invalid
 */
export declare function validateName(name: string): void;
/**
 * Spawn a new teammate agent using the SDK
 * Creates an agent with default Letta Code configuration
 */
export declare function spawnTeammate(name: string, role: string, options?: SpawnOptions): Promise<TeammateState>;
/**
 * Callback for streaming message events
 */
export interface MessageEventCallback {
    (event: {
        type: "tool_call";
        name: string;
        input: Record<string, unknown>;
    } | {
        type: "tool_result";
        isError: boolean;
        snippet: string;
    }): void;
}
/**
 * Options for messaging a teammate
 */
export interface MessageOptions {
    /** Callback for streaming events (tool calls, results) */
    onEvent?: MessageEventCallback;
    /** Optional custom tools for this message session (used by council flow) */
    tools?: AnyAgentTool[];
}
export interface InitStreamEvent {
    type: "assistant" | "tool_call" | "tool_result" | "result" | "error";
    content?: string;
    toolName?: string;
    isError?: boolean;
}
export interface InitMessageOptions extends MessageOptions {
    /** Hard wall-clock timeout for init execution */
    maxDurationMs?: number;
    /** Max idle time (no stream events) before failing */
    maxIdleMs?: number;
    /** Callback for low-level init stream events (for logging/telemetry) */
    onStreamEvent?: (event: InitStreamEvent) => void;
}
/**
 * Run a dedicated initialization conversation for a teammate.
 * This keeps memory bootstrap separate from the main working conversation.
 */
export declare function initializeTeammateMemory(name: string, message: string, options?: InitMessageOptions): Promise<{
    result: string;
    conversationId?: string;
}>;
/**
 * Message a teammate and get the response
 * Uses resumeSession with stored conversation ID for persistent memory
 *
 * Note: Uses an in-memory mutex to serialize messages to the same teammate.
 * If multiple callers message the same teammate concurrently, they will
 * be queued and processed sequentially.
 */
export declare function messageTeammate(name: string, message: string, options?: MessageOptions): Promise<string>;
/**
 * Broadcast a message to teammates in parallel with concurrency limit
 */
export declare function broadcastMessage(message: string, options?: {
    targetNames?: string[];
    exclude?: string[];
    concurrency?: number;
}): Promise<Map<string, string>>;
/**
 * Dispatch different messages to different teammates in parallel
 */
export declare function dispatchMessages(messages: Map<string, string>, options?: {
    concurrency?: number;
}): Promise<Map<string, string>>;
