import type { UpdateCheckResult } from './auto-update.js';
export interface UpdateNotification {
    currentVersion: string;
    latestVersion: string;
}
/**
 * Start background auto-update check on startup
 * Returns a notification if an update was applied
 */
export declare function startStartupAutoUpdateCheck(checkForNotification: () => Promise<UpdateCheckResult | undefined>, _logError?: (...args: unknown[]) => void): Promise<UpdateNotification | undefined>;
