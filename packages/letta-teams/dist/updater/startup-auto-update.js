/**
 * Start background auto-update check on startup
 * Returns a notification if an update was applied
 */
export function startStartupAutoUpdateCheck(checkForNotification, _logError = console.error) {
    return checkForNotification()
        .then((result) => {
        if (result?.updateAvailable && result.latestVersion) {
            return { currentVersion: result.currentVersion, latestVersion: result.latestVersion };
        }
        return undefined;
    })
        .catch(() => undefined);
}
