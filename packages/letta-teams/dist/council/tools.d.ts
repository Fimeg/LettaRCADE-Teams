import type { AnyAgentTool } from '@letta-ai/letta-code-sdk';
export declare function createCouncilTools(context: {
    sessionId: string;
    turn: number;
    agentName: string;
}): AnyAgentTool[];
