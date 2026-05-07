import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const DEBUG = process.env.LETTA_TEAMS_DEBUG === '1';
function debugLog(...args) {
    if (DEBUG) {
        console.error('[letta-teams auto-update]', ...args);
    }
}
const PACKAGE_NAME = 'letta-teams';
const REGISTRY_BASE_URL = 'https://registry.npmjs.org';
const INSTALL_ARG_PREFIX = {
    npm: ['install', '-g'],
    bun: ['add', '-g'],
    pnpm: ['add', '-g'],
};
/**
 * Get current version from package.json
 */
export function getVersion() {
    try {
        const pkg = require('../../package.json');
        return pkg.version || '0.0.0';
    }
    catch {
        return '0.0.0';
    }
}
/**
 * Check if auto-update is enabled
 */
function isAutoUpdateEnabled() {
    return process.env.DISABLE_LETTA_TEAMS_AUTOUPDATE !== '1';
}
/**
 * Check if running locally (not from node_modules)
 */
function isRunningLocally() {
    const argv = process.argv[1] || '';
    let resolvedPath = argv;
    try {
        resolvedPath = realpathSync(argv);
    }
    catch { }
    return !resolvedPath.includes('node_modules');
}
/**
 * Check npm registry for latest version
 */
export async function checkForUpdate() {
    const currentVersion = getVersion();
    debugLog('Current version:', currentVersion);
    // Skip pre-release versions
    if (currentVersion.includes('-')) {
        return { updateAvailable: false, currentVersion };
    }
    const latestUrl = `${REGISTRY_BASE_URL}/${PACKAGE_NAME}/latest`;
    try {
        const res = await fetch(latestUrl, { signal: AbortSignal.timeout(5000) });
        if (!res.ok)
            throw new Error(`Registry returned ${res.status}`);
        const data = (await res.json());
        const latestVersion = data.version;
        debugLog('Latest version:', latestVersion);
        if (latestVersion && latestVersion !== currentVersion) {
            return { updateAvailable: true, latestVersion, currentVersion };
        }
    }
    catch (error) {
        debugLog('Update check failed:', error);
        return { updateAvailable: false, currentVersion, checkFailed: true };
    }
    return { updateAvailable: false, currentVersion };
}
/**
 * Detect which package manager was used to install
 */
export function detectPackageManager() {
    const envOverride = process.env.LETTA_TEAMS_PACKAGE_MANAGER;
    if (envOverride && ['npm', 'bun', 'pnpm'].includes(envOverride)) {
        return envOverride;
    }
    const argv = process.argv[1] || '';
    if (/\.bun\//.test(argv))
        return 'bun';
    if (/pnpm/.test(argv))
        return 'pnpm';
    return 'npm';
}
/**
 * Perform the update
 */
async function performUpdate() {
    const pm = detectPackageManager();
    const installArgs = [...INSTALL_ARG_PREFIX[pm], `${PACKAGE_NAME}@latest`];
    debugLog('Updating with:', pm, installArgs);
    try {
        await execFileAsync(pm, installArgs, { timeout: 60000 });
        return { success: true };
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        // Handle npm ENOTEMPTY error
        if (pm === 'npm' && errorMsg.includes('ENOTEMPTY')) {
            return { success: false, error: errorMsg, enotemptyFailed: true };
        }
        return { success: false, error: errorMsg };
    }
}
/**
 * Check if this is a significant update (major or minor)
 */
function isSignificantUpdate(current, latest) {
    const [cMajor = 0, cMinor = 0] = current.split('.').map(Number);
    const [lMajor = 0, lMinor = 0] = latest.split('.').map(Number);
    return lMajor > cMajor || (lMajor === cMajor && lMinor > cMinor);
}
/**
 * Lightweight startup check: only report available updates, do not install.
 */
export async function checkForStartupNotification() {
    if (!isAutoUpdateEnabled()) {
        debugLog('Auto-update disabled');
        return;
    }
    if (isRunningLocally()) {
        debugLog('Running locally, skipping update notification check');
        return;
    }
    const result = await checkForUpdate();
    if (result.updateAvailable && result.latestVersion) {
        return result;
    }
    return;
}
/**
 * Manually install the latest release.
 */
export async function performManualUpdate() {
    const packageManager = detectPackageManager();
    const check = await checkForUpdate();
    if (check.checkFailed) {
        return {
            updated: false,
            currentVersion: check.currentVersion,
            latestVersion: check.latestVersion,
            packageManager,
            reason: 'check-failed',
            error: 'Failed to check npm registry for updates',
        };
    }
    if (!check.updateAvailable || !check.latestVersion) {
        return {
            updated: false,
            currentVersion: check.currentVersion,
            latestVersion: check.currentVersion,
            packageManager,
            reason: 'up-to-date',
        };
    }
    const updateResult = await performUpdate();
    if (updateResult.success) {
        return {
            updated: true,
            currentVersion: check.currentVersion,
            latestVersion: check.latestVersion,
            packageManager,
            enotemptyFailed: updateResult.enotemptyFailed,
        };
    }
    return {
        updated: false,
        currentVersion: check.currentVersion,
        latestVersion: check.latestVersion,
        packageManager,
        reason: 'install-failed',
        enotemptyFailed: updateResult.enotemptyFailed,
        error: updateResult.error,
    };
}
/**
 * Legacy: check and auto-update if needed.
 */
export async function checkAndAutoUpdate() {
    if (!isAutoUpdateEnabled()) {
        debugLog('Auto-update disabled');
        return;
    }
    if (isRunningLocally()) {
        debugLog('Running locally, skipping auto-update');
        return;
    }
    const result = await checkForUpdate();
    if (result.updateAvailable && result.latestVersion) {
        debugLog('Update available:', result.latestVersion);
        const updateResult = await performUpdate();
        if (updateResult.success && isSignificantUpdate(result.currentVersion, result.latestVersion)) {
            return {
                updateApplied: true,
                latestVersion: result.latestVersion,
                enotemptyFailed: updateResult.enotemptyFailed,
            };
        }
        if (updateResult.enotemptyFailed) {
            return {
                updateApplied: false,
                latestVersion: result.latestVersion,
                enotemptyFailed: true,
            };
        }
    }
    return;
}
