import type { TeammateStatus, TaskStatus } from '../../types.js';
/**
 * Format a progress bar
 */
export declare function formatProgressBar(progress: number, width?: number): string;
/**
 * Get status icon for agent
 */
export declare function getStatusIcon(status: TeammateStatus): string;
/**
 * Get color for status
 */
export declare function getStatusColor(status: TeammateStatus): string;
/**
 * Get task status icon
 */
export declare function getTaskStatusIcon(status: TaskStatus): string;
/**
 * Get task status color
 */
export declare function getTaskStatusColor(status: TaskStatus): string;
/**
 * Format relative time
 */
export declare function formatRelativeTime(isoString: string): string;
/**
 * Format duration
 */
export declare function formatDuration(startIso: string, endIso?: string): string;
/**
 * Truncate text
 */
export declare function truncate(text: string, maxLen: number): string;
