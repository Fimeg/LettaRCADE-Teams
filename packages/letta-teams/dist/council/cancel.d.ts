import type { TeammateState } from '../types.js';
export interface CancelCouncilRunsResult {
    cancelledTasks: number;
    cancelledConversations: number;
    warnings: string[];
}
export declare function cancelRunsForCouncil(teammates: TeammateState[]): Promise<CancelCouncilRunsResult>;
