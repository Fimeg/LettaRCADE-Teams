import type { TeammateState } from '../../types.js';
/**
 * Hook to load and poll teammates
 */
export declare function useTeammates(pollIntervalMs?: number): {
    teammates: TeammateState[];
    refresh: () => void;
};
