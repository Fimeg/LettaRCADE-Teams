import type { TeammateState } from "./types.js";
/**
 * Build the background initialization prompt for a teammate.
 * This uses the teammate's role and optional spawn prompt to ask the agent
 * to initialize durable memory for future work.
 */
export declare function buildInitPrompt(state: TeammateState): string;
export declare function buildReinitPrompt(state: TeammateState, prompt?: string): string;
export interface ParsedInitResult {
    initStatus: "done" | "error";
    selectedSpecId?: string;
    selectedSpecTitle?: string;
    summary?: string;
}
export declare function parseInitResult(result: string): ParsedInitResult;
