import type { TaskKind, TaskState } from './types.js';
export declare function inferTaskKind(task: Pick<TaskState, 'kind' | 'message'>): TaskKind;
export declare function isInternalTask(task: Pick<TaskState, 'kind' | 'message'>): boolean;
export declare function filterVisibleTasks(tasks: TaskState[], includeInternal?: boolean): TaskState[];
