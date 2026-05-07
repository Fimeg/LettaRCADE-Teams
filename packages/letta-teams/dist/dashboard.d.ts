/**
 * Dashboard module - activity-centric view of what's happening now
 */
import type { TaskState } from "./types.js";
/**
 * Active item for NOW section (teammate working or with problem)
 */
interface ActiveItem {
    name: string;
    status: "working" | "error";
    message?: string;
    phase?: string;
    currentTodoTitle?: string;
    progress?: number;
    problem?: string;
}
/**
 * Dashboard data structure
 */
export interface DashboardData {
    now: ActiveItem[];
    recent: TaskState[];
    idle: string[];
}
export interface DashboardRenderOptions {
    detail?: boolean;
    verbose?: boolean;
}
export interface DashboardQueryOptions {
    limit?: number;
    sinceMinutes?: number;
    includeInternal?: boolean;
}
/**
 * Get dashboard data by combining teammates and tasks
 */
export declare function getDashboardData(options?: DashboardQueryOptions): DashboardData;
/**
 * Render the dashboard to console
 */
export declare function renderDashboard(data: DashboardData, options?: DashboardRenderOptions): void;
/**
 * Display dashboard once and exit
 */
export declare function displayDashboard(options?: {
    limit?: number;
    detail?: boolean;
    verbose?: boolean;
    json?: boolean;
    sinceMinutes?: number;
    includeInternal?: boolean;
}): void;
/**
 * Get a one-time snapshot (for programmatic use)
 */
export declare function getSnapshot(): DashboardData;
export {};
