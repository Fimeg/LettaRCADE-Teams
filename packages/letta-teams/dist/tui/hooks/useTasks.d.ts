import type { TaskState } from '../../types.js';
/**
 * Hook to load and poll tasks
 */
export declare function useTasks(pollIntervalMs?: number, includeInternal?: boolean): {
    tasks: TaskState[];
    refresh: () => void;
};
