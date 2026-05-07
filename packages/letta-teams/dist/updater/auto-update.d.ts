export interface UpdateCheckResult {
    updateAvailable: boolean;
    latestVersion?: string;
    currentVersion: string;
    checkFailed?: boolean;
}
export interface AutoUpdateResult {
    updateApplied: boolean;
    latestVersion: string;
    enotemptyFailed?: boolean;
}
export interface ManualUpdateResult {
    updated: boolean;
    currentVersion: string;
    latestVersion?: string;
    packageManager: PackageManager;
    reason?: 'up-to-date' | 'check-failed' | 'install-failed';
    enotemptyFailed?: boolean;
    error?: string;
}
export type PackageManager = 'npm' | 'bun' | 'pnpm';
/**
 * Get current version from package.json
 */
export declare function getVersion(): string;
/**
 * Check npm registry for latest version
 */
export declare function checkForUpdate(): Promise<UpdateCheckResult>;
/**
 * Detect which package manager was used to install
 */
export declare function detectPackageManager(): PackageManager;
/**
 * Lightweight startup check: only report available updates, do not install.
 */
export declare function checkForStartupNotification(): Promise<UpdateCheckResult | undefined>;
/**
 * Manually install the latest release.
 */
export declare function performManualUpdate(): Promise<ManualUpdateResult>;
/**
 * Legacy: check and auto-update if needed.
 */
export declare function checkAndAutoUpdate(): Promise<AutoUpdateResult | undefined>;
