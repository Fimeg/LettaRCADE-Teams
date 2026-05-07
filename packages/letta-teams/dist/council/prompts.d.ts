import type { CouncilOpinionRecord } from './types.js';
export declare function buildCouncilKickoffPrompt(input: {
    sessionId: string;
    turn: number;
    councilPrompt: string;
    customMessage?: string;
}): string;
export declare function buildCouncilReviewerPrompt(input: {
    sessionId: string;
    turn: number;
    prompt: string;
    opinions: CouncilOpinionRecord[];
    previousSynthesis?: string;
    customMessage?: string;
}): string;
export declare function buildCouncilSynthesisPrompt(input: {
    sessionId: string;
    turn: number;
    opinions: CouncilOpinionRecord[];
}): string;
export declare function buildCouncilVotePrompt(input: {
    turn: number;
    synthesis: string;
}): string;
export declare function buildCouncilFinalPlan(input: {
    sessionId: string;
    prompt: string;
    synthesis: string;
    unanimous: boolean;
    turn: number;
}): string;
