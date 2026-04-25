import { isDev } from "./util.js"
import path from "path"
import { app } from "electron"
import { existsSync } from "fs"

function findPreloadPath(): string {
    const appPath = app.getAppPath();
    // Try multiple locations - don't rely solely on NODE_ENV
    const candidates = [
        // Development: electron runs from project root
        path.join(appPath, 'dist-electron', 'preload.cjs'),
        // Packaged: electron runs from app.asar or similar
        path.join(appPath, '..', 'dist-electron', 'preload.cjs'),
        // Fallback: current working directory
        path.join(process.cwd(), 'dist-electron', 'preload.cjs'),
    ];
    for (const p of candidates) {
        if (existsSync(p)) return p;
    }
    // Return default if not found (will error, but with clear path in log)
    return candidates[0];
}

export function getPreloadPath() {
    return findPreloadPath();
}

export function getUIPath() {
    return path.join(app.getAppPath(), '/dist-react/index.html');
}

export function getIconPath() {
    return path.join(
        app.getAppPath(),
        isDev() ? './' : '../',
        '/templateIcon.png'
    )
}