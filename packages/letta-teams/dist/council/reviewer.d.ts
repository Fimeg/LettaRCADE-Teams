import type { CouncilOpinionRecord } from './types.js';
export interface CouncilReviewerResult {
    decision: 'continue' | 'finalize';
    summary: string;
    finalPlanMarkdown?: string;
    confidence?: number;
    nextFocus?: string[];
}
export declare function runDisposableCouncilReviewer(input: {
    sessionId: string;
    turn: number;
    councilPrompt: string;
    opinions: CouncilOpinionRecord[];
    previousSynthesis?: string;
    customMessage?: string;
}): Promise<CouncilReviewerResult>;
