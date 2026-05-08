import { app, BrowserWindow, ipcMain, dialog, globalShortcut, Menu } from "electron"
import { execSync } from "child_process";
import { config as dotenvConfig } from "dotenv";
import { join } from "path";
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { format } from "util";

/**
 * Wait for dev server to be ready before loading UI.
 * Prevents ERR_CONNECTION_REFUSED when Electron starts before Vite.
 */
async function waitForDevServer(port: number, timeoutMs = 30000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await fetch(`http://localhost:${port}`);
            if (res.ok) return true;
        } catch {
            // Server not ready yet
        }
        await new Promise(r => setTimeout(r, 100));
    }
    return false;
}

// Setup persistent file logging
const LOG_DIR = join(app.getPath('userData'), 'logs');
const LOG_FILE = join(LOG_DIR, `app-${new Date().toISOString().split('T')[0]}.log`);
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

// Create fresh log file with header
writeFileSync(LOG_FILE, `[${new Date().toISOString()}] === Letta OSS UI Log Started ===\n`);

// Override console methods to also write to file
const originalConsole = { log: console.log, error: console.error, warn: console.warn };
function logToFile(level: string, args: any[]) {
    try {
        const msg = `[${new Date().toISOString()}] [${level}] ${args.map(a => typeof a === 'string' ? a : format('%o', a)).join(' ')}\n`;
        appendFileSync(LOG_FILE, msg);
    } catch { /* ignore */ }
}
console.log = (...args: any[]) => { originalConsole.log(...args); logToFile('LOG', args); };
console.error = (...args: any[]) => { originalConsole.error(...args); logToFile('ERR', args); };
console.warn = (...args: any[]) => { originalConsole.warn(...args); logToFile('WRN', args); };
console.log(`[main] Logs written to: ${LOG_FILE}`);
import { ipcMainHandle, isDev, DEV_PORT } from "./util.js";
import { loadConfig, saveConfig, type Config } from "./config.js";
import { loadOperatorProfile, saveOperatorProfile } from "./operatorProfile.js";
import {
    setMemfsToken,
    hasMemfsToken,
    clearMemfsToken,
    getMemfsToken,
} from "./operatorSecrets.js";
import { initDatabase, closeDatabase, saveSession, getAllSessions, deleteSession, updateSessionStatus } from "./db.js";
import type { ClientEvent, ServerEvent } from "./types.js";

// Load .env file from project root
const envResult = dotenvConfig({ path: join(process.cwd(), ".env") });
console.log("[main] .env loaded:", envResult.parsed ? "yes" : "no");
if (envResult.parsed) {
  console.log("[main] .env keys:", Object.keys(envResult.parsed).join(", "));
}

// Default to Letta Cloud if no base URL set
if (!process.env.LETTA_BASE_URL) {
  process.env.LETTA_BASE_URL = "https://api.letta.com";
}

// Set dummy API key for localhost (local server doesn't check it)
if (!process.env.LETTA_API_KEY && process.env.LETTA_BASE_URL?.includes("localhost")) {
  process.env.LETTA_API_KEY = "local-dev-key";
}

// Set memfs token from environment if provided (and not already set)
if (process.env.LETTA_MEMFS_GIT_TOKEN && !hasMemfsToken()) {
  const token = process.env.LETTA_MEMFS_GIT_TOKEN.trim();
  if (token) {
    setMemfsToken(token);
    console.log("[main] Memfs token set from environment variable");
  }
}

// Find letta CLI via `which letta` as a fallback if LETTA_CODE_CLI_PATH is not set
// Note: LETTA_CODE_CLI_PATH from .env takes precedence (set in letta-code-manager.ts)
if (!process.env.LETTA_CODE_CLI_PATH) {
  try {
    const whichCmd = process.platform === 'win32' ? 'where letta' : 'which letta';
    const lettaPath = execSync(whichCmd, { encoding: "utf-8" }).trim();
    if (lettaPath) {
      // On Windows, 'where' may return multiple lines - take the first one
      const firstPath = lettaPath.split('\n')[0].trim();
      process.env.LETTA_CODE_CLI_PATH = firstPath;
      console.log("Found letta CLI via 'which letta':", firstPath);
    }
  } catch (e) {
    console.warn("Could not find letta CLI via 'which letta':", e);
  }
}

// Alias LETTA_CLI_PATH for the SDK's SubprocessTransport.findCli().
// The SDK v0.1.14+ checks LETTA_CLI_PATH; we use LETTA_CODE_CLI_PATH
// in our own code. Keep both in sync so the SDK finds our custom build.
if (process.env.LETTA_CODE_CLI_PATH && !process.env.LETTA_CLI_PATH) {
  process.env.LETTA_CLI_PATH = process.env.LETTA_CODE_CLI_PATH;
}
import { getPreloadPath, getUIPath, getIconPath } from "./pathResolver.js";
import { getStaticData, pollResources, stopPolling } from "./test.js";
import { IPCHandlers } from "./ipc-handlers.js";

const ipcHandlers = new IPCHandlers();
import { LettaCodeManager, type LettaCodeStatusPayload } from "./letta-code-manager.js";
import { getTeamsRuntimeManager } from "./teams-runtime.js";
import { registerTeamsIpc } from "./teams-ipc.js";

let cleanupComplete = false;
let mainWindow: BrowserWindow | null = null;
let appConfig: Config;
const lettaCode = new LettaCodeManager();
const teamsRuntime = getTeamsRuntimeManager();

// IPC validation helper
function validateClientEvent(data: unknown): data is ClientEvent {
  if (!data || typeof data !== 'object') return false;
  const event = data as Record<string, unknown>;
  if (typeof event.type !== 'string') return false;
  if (event.payload !== undefined && typeof event.payload !== 'object') return false;
  const validTypes = ['session.start', 'session.continue', 'session.stop', 'session.delete', 'session.list', 'session.history', 'permission.response'];
  return validTypes.includes(event.type);
}

function validateServerEvent(data: unknown): data is ServerEvent {
  if (!data || typeof data !== 'object') return false;
  const event = data as Record<string, unknown>;
  if (typeof event.type !== 'string') return false;
  const validTypes = ['stream.message', 'stream.user_prompt', 'session.status', 'session.list', 'session.history', 'session.deleted', 'permission.request', 'runner.error'];
  return validTypes.includes(event.type);
}

function killViteDevServer(): void {
    if (!isDev()) return;
    try {
        if (process.platform === 'win32') {
            execSync(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :${DEV_PORT}') do taskkill /PID %a /F`, { stdio: 'ignore', shell: 'cmd.exe' });
        } else {
            execSync(`lsof -ti:${DEV_PORT} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' });
        }
    } catch {
        // Process may already be dead
    }
}

async function cleanup(): Promise<void> {
    if (cleanupComplete) return;
    cleanupComplete = true;

    console.log("[cleanup] Starting graceful shutdown sequence...");

    // 1. Notify renderer so it can show a shutdown indicator
    try {
        mainWindow?.webContents.send("app:shutting-down");
    } catch {
        // Window may already be destroyed
    }

    // 2. Save window size to config
    if (mainWindow && appConfig) {
        try {
            const bounds = mainWindow.getBounds();
            appConfig.windowWidth = bounds.width;
            appConfig.windowHeight = bounds.height;
            saveConfig(appConfig);
        } catch (err) {
            console.error("[cleanup] Failed to save window config:", err);
        }
    }

    // 3. Synchronous teardown: shortcuts, polling (no IO)
    globalShortcut.unregisterAll();
    stopPolling();

    // 4. Close active SDK sessions (before killing subprocesses)
    try {
        ipcHandlers.cleanupAllSessions();
        console.log("[cleanup] Sessions closed");
    } catch (err) {
        console.error("[cleanup] Failed to close sessions:", err);
    }

    // 5. Stop letta-code subprocess with 3s timeout
    try {
        await Promise.race([
            lettaCode.stop(),
            new Promise<void>((_, reject) =>
                setTimeout(() => reject(new Error("[cleanup] lettaCode.stop() timed out")), 3000)
            ),
        ]);
        console.log("[cleanup] LettaCode stopped");
    } catch (err) {
        console.error("[cleanup] LettaCode stop failed:", err);
    }

    // 6. Stop teams runtime
    try {
        teamsRuntime.stop();
        console.log("[cleanup] Teams runtime stopped");
    } catch (err) {
        console.error("[cleanup] Teams runtime stop failed:", err);
    }

    // 7. Close database (no more IO after this point)
    try {
        closeDatabase();
        console.log("[cleanup] Database closed");
    } catch (err) {
        console.error("[cleanup] Database close failed:", err);
    }

    // 8. Kill Vite dev server (only in dev mode)
    killViteDevServer();

    console.log("[cleanup] Graceful shutdown sequence complete");
}

function handleSignal(): void {
    if (!cleanupComplete) {
        console.log("[main] Received termination signal, initiating cleanup...");
    }
    app.quit();
}

// Allow self-signed certificates for local development
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    // Allow connections to local/private IPs with self-signed certs
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    if (hostname.match(/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|.*\.local)$/)) {
        event.preventDefault();
        callback(true);
        return;
    }
    callback(false);
});

// Initialize everything when app is ready
app.on("ready", async () => {
    // Initialize config and database
    appConfig = loadConfig();
    initDatabase();

    Menu.setApplicationMenu(null);
    // Setup event handlers
    app.on("will-quit", async (event) => {
        if (cleanupComplete) return;
        event.preventDefault();
        console.log("[main] will-quit: running async cleanup...");
        await cleanup();
        app.quit();
    });
    app.on("window-all-closed", () => {
        if (process.platform !== "darwin") app.quit();
    });

    process.on("SIGTERM", handleSignal);
    process.on("SIGINT", handleSignal);
    process.on("SIGHUP", handleSignal);

    // Create main window using config values
    mainWindow = new BrowserWindow({
        width: appConfig.windowWidth,
        height: appConfig.windowHeight,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            preload: getPreloadPath(),
            contextIsolation: true,
            nodeIntegration: false,
        },
        icon: getIconPath(),
        titleBarStyle: "hiddenInset",
        backgroundColor: appConfig.theme === 'dark' ? '#1a1a1a' : '#FAF9F6',
        trafficLightPosition: { x: 15, y: 18 }
    });

    // Add Content-Security-Policy
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self'; " +
                    "connect-src 'self' http://* http://*:* https://* https://*:* ws://* wss://* http://10.10.20.19:* https://10.10.20.19:*; " +
                    "script-src 'self' 'unsafe-inline' blob:; " +
                    "worker-src 'self' blob:; " +
                    "style-src 'self' 'unsafe-inline'"
                ]
            }
        });
    });

    // Load UI: wait for dev server in dev mode, or load built files in production
    if (isDev()) {
        console.log("[main] Dev mode detected, waiting for Vite server...");
        const serverReady = await waitForDevServer(DEV_PORT, 30000);
        if (serverReady) {
            console.log("[main] Vite server ready, loading...");
            await mainWindow.loadURL(`http://localhost:${DEV_PORT}`);
        } else {
            console.error("[main] Vite server not ready after 30s, showing error...");
            mainWindow.loadURL(`data:text/html,<h1>Error: Dev server not ready</h1><p>Could not connect to Vite dev server on port ${DEV_PORT}. Did you run <code>npm run dev:react</code>?</p>`);
        }
    } else {
        await mainWindow.loadFile(getUIPath());
    }

    globalShortcut.register('CommandOrControl+Q', () => {
        cleanup();
        app.quit();
    });

    pollResources(mainWindow);

    ipcMainHandle("getStaticData", () => {
        return getStaticData();
    });

    registerTeamsIpc(teamsRuntime);

    // Handle client events with validation
    ipcMain.on("client-event", (event: Electron.IpcMainEvent, data: unknown) => {
        if (!validateClientEvent(data)) {
            console.error('Invalid client event received:', data);
            event.sender.send('server-event', JSON.stringify({
                type: 'runner.error',
                payload: { message: 'Invalid client event' }
            }));
            return;
        }
        ipcHandlers.handleClientEvent(data);
    });

    // Forward renderer logs to main process console
    ipcMain.on("renderer-log", (_event: Electron.IpcMainEvent, data: { level: string; args: any[] }) => {
        const prefix = '[renderer]';
        if (data.level === 'error') {
            console.error(prefix, ...data.args);
        } else if (data.level === 'warn') {
            console.warn(prefix, ...data.args);
        } else {
            console.log(prefix, ...data.args);
        }
    });

    // Handle recent cwds request
    ipcMainHandle("get-recent-cwds", () => {
        // TODO: Load from config or database
        return [process.cwd()];
    });

    // Handle config operations
    ipcMainHandle("get-config", () => {
        return appConfig;
    });

    ipcMainHandle("save-config", (_: Electron.IpcMainInvokeEvent, config: Config) => {
        appConfig = { ...appConfig, ...config };
        saveConfig(appConfig);
        return appConfig;
    });

    // Operator profile: setup-first gate. `null` from get → renderer shows the
    // welcome wizard; save returns the persisted profile.
    ipcMainHandle("operator-profile:get", () => loadOperatorProfile());

    ipcMainHandle(
        "operator-profile:save",
        (_: Electron.IpcMainInvokeEvent, profile: { displayName?: string; memfsGitUrlTemplate?: string }) =>
            saveOperatorProfile(profile),
    );

    // Operator secrets — token write-only from renderer; never returned in
    // plaintext. `getMemfsToken()` is main-process-only and used at spawn time.
    ipcMainHandle(
        "operator-secrets:set-memfs-token",
        (_: Electron.IpcMainInvokeEvent, token: string) => setMemfsToken(token),
    );
    ipcMainHandle("operator-secrets:has-memfs-token", () => hasMemfsToken());
    ipcMainHandle("operator-secrets:clear-memfs-token", () => clearMemfsToken());

    // Whitelisted env snapshot for the renderer's Settings panel. Secrets are
    // never sent — booleans reflect presence only.
    ipcMainHandle("get-runtime-env", (): RuntimeEnv => ({
        LETTA_BASE_URL: process.env.LETTA_BASE_URL,
        LETTA_CODE_CLI_PATH: process.env.LETTA_CODE_CLI_PATH,
        LETTA_MEMFS_LOCAL: process.env.LETTA_MEMFS_LOCAL,
        LETTA_MEMFS_GIT_URL: process.env.LETTA_MEMFS_GIT_URL,
        LETTA_API_KEY: process.env.LETTA_API_KEY,  // Add API key for renderer
        apiKeySet: !!process.env.LETTA_API_KEY,
        memfsGitTokenSet: !!process.env.LETTA_MEMFS_GIT_TOKEN,
        cwd: process.cwd(),
    }));

    // Handle directory selection
    ipcMainHandle("select-directory", async () => {
        const result = await dialog.showOpenDialog(mainWindow!, {
            properties: ['openDirectory']
        });

        if (result.canceled) {
            return null;
        }

        return result.filePaths[0];
    });

    // Broadcast letta-code status changes to renderer
    lettaCode.on("status", (payload: LettaCodeStatusPayload) => {
        mainWindow?.webContents.send("letta-code:status", payload);
    });
    lettaCode.on("log", (entry: { stream: "stdout" | "stderr"; line: string }) => {
        mainWindow?.webContents.send("letta-code:log", entry);
    });

    // Helper to detect localhost/private URLs (used for smart config save logic)
    function isLocalhostUrl(url: string): boolean {
        try {
            const parsed = new URL(url);
            const hostname = parsed.hostname;
            return hostname === 'localhost' ||
                   hostname === '127.0.0.1' ||
                   hostname === '::1' ||
                   hostname.startsWith('192.168.') ||
                   hostname.startsWith('10.') ||
                   /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
                   hostname.endsWith('.local');
        } catch {
            return false;
        }
    }

    ipcMainHandle("letta-code:get-status", () => {
        console.log("[ipc:letta-code:get-status] current status:", lettaCode.getStatus());
        return lettaCode.getStatus();
    });

    ipcMainHandle("letta-code:spawn", async (_event, opts: { cwd?: string; serverUrl?: string; apiKey?: string; agentId?: string; agentMetadataEnv?: { letta_memfs_git_url?: string; letta_memfs_local?: string } } = {}) => {
        console.log("[ipc:letta-code:spawn] Spawn requested with opts:", { ...opts, apiKey: opts.apiKey ? "(set)" : "(unset)" });

        // Renderer-supplied creds win — they reflect what the user actually
        // configured in the Settings panel (localStorage). Fall back to the
        // main-process appConfig file only when the renderer didn't pass any.
        const upstreamUrl = opts.serverUrl || appConfig.serverUrl || "http://localhost:8283";
        const upstreamKey = opts.apiKey ?? appConfig.apiKey ?? "";

        // For Local mode: check if letta-code CLI is already running before spawning
        // Note: We check the CLI process status, not the upstream server health
        const isLocalhost = isLocalhostUrl(upstreamUrl);
        if (isLocalhost) {
            const currentStatus = lettaCode.getStatus();
            if (currentStatus.status === "running" || currentStatus.status === "starting") {
                console.log("[ipc:letta-code:spawn] CLI already running - returning current status");
                return currentStatus;
            }
        }

        // Only save config when the user explicitly changed settings (not for Local mode defaults)
        // This preserves external server config when temporarily switching to Local mode
        const explicitServerChange = opts.serverUrl && opts.serverUrl !== appConfig.serverUrl;
        const explicitKeyChange = opts.apiKey !== undefined && opts.apiKey !== appConfig.apiKey;

        if (explicitServerChange || explicitKeyChange) {
            // Save config when:
            // 1. Switching TO an external URL (preserve the new external config)
            // 2. Switching FROM localhost TO localhost (user managing local servers)
            // Don't save when switching FROM external TO localhost (temporary Local mode)
            const targetIsExternal = !isLocalhostUrl(upstreamUrl);
            const sourceWasExternal = !isLocalhostUrl(appConfig.serverUrl || "");

            if (targetIsExternal || !sourceWasExternal) {
                appConfig = { ...appConfig, serverUrl: upstreamUrl, apiKey: upstreamKey };
                saveConfig(appConfig);
                console.log("[ipc:letta-code:spawn] Saved config:", upstreamUrl);
            } else {
                console.log("[ipc:letta-code:spawn] Skipped config save - preserving external server settings for Local mode");
            }
        }

        // Resolve memfs env: per-agent metadata override > operator profile
        // template (with `{agentId}` substituted, token prefixed from keychain).
        // Token never crosses IPC; only read here, in main, at spawn time.
        const extraEnv: Record<string, string | undefined> = {};
        const profile = loadOperatorProfile();
        const overrideUrl = opts.agentMetadataEnv?.letta_memfs_git_url;
        const overrideLocal = opts.agentMetadataEnv?.letta_memfs_local;
        let resolvedUrl: string | undefined;
        if (overrideUrl && overrideUrl.trim()) {
            resolvedUrl = overrideUrl.trim();
        } else if (profile?.memfsGitUrlTemplate && opts.agentId) {
            const template = profile.memfsGitUrlTemplate.trim();
            if (template) resolvedUrl = template.replace("{agentId}", opts.agentId);
        }
        if (resolvedUrl) {
            // Prefix token onto the URL only if missing (operator templates
            // typically don't embed credentials; per-agent overrides may).
            const token = getMemfsToken();
            if (token && !/:\/\/[^/]*@/.test(resolvedUrl)) {
                resolvedUrl = resolvedUrl.replace(/^(https?:\/\/)/, `$1${token}@`);
            }
            extraEnv.LETTA_MEMFS_GIT_URL = resolvedUrl;
        }
        if (overrideLocal !== undefined) {
            extraEnv.LETTA_MEMFS_LOCAL = overrideLocal;
        } else if (resolvedUrl) {
            // letta-code expects LETTA_MEMFS_LOCAL=1 alongside a git URL for
            // the persistent-cache-with-sync pattern. See start-sam.sh etc.
            extraEnv.LETTA_MEMFS_LOCAL = "1";
        }
        // PR #1918: letta-code keys memfs settings by the server URL. In
        // 3-mode architecture, Local mode may use localhost:8283 while Server
        // mode uses the external server. LETTA_MEMFS_BASE_URL ensures memfs
        // routing uses the correct origin for the active mode.
        extraEnv.LETTA_MEMFS_BASE_URL = upstreamUrl;

        console.log("[ipc:letta-code:spawn] resolved env:", {
            LETTA_MEMFS_GIT_URL: extraEnv.LETTA_MEMFS_GIT_URL ? "(set)" : "(unset)",
            LETTA_MEMFS_LOCAL: extraEnv.LETTA_MEMFS_LOCAL ?? "(unset)",
            LETTA_MEMFS_BASE_URL: extraEnv.LETTA_MEMFS_BASE_URL ?? "(unset)",
            source: overrideUrl ? "agent-metadata" : profile?.memfsGitUrlTemplate ? "operator-template" : "none",
            tokenSet: hasMemfsToken(),
        });

        try {
            await lettaCode.spawn({
                serverUrl: upstreamUrl,
                apiKey: upstreamKey,
                cwd: opts.cwd,
                extraEnv,
            });
            const status = lettaCode.getStatus();
            console.log("[ipc:letta-code:spawn] Spawn successful, status:", status);
            return status;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error("[ipc:letta-code:spawn] Spawn failed:", errorMsg);
            throw err;
        }
    });

    ipcMainHandle("letta-code:stop", async () => {
        console.log("[ipc:letta-code:stop] Stop requested");
        await lettaCode.stop();
        const status = lettaCode.getStatus();
        console.log("[ipc:letta-code:stop] Status after stop:", status);
        return status;
    });

    // Health check for 3-mode architecture — verifies server connectivity
    // before attempting Local mode spawn or when switching modes
    ipcMainHandle("letta:health-check", async (_event, url: string, apiKey?: string) => {
        const fullUrl = `${url.replace(/\/$/, "")}/v1/agents/?limit=1`;
        console.log("[ipc:letta:health-check] Checking health for:", fullUrl);
        console.log("[ipc:letta:health-check] Headers:", apiKey ? { Authorization: "Bearer ***" } : "(none)");

        try {
            const headers: Record<string, string> = {};
            if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

            const response = await fetch(fullUrl, {
                method: "GET",
                headers,
            });

            if (response.ok) {
                console.log("[ipc:letta:health-check] Healthy:", url, "Status:", response.status);
                return { healthy: true, status: response.status };
            }

            // Try to get response body for more details
            let body = "";
            try {
                body = await response.text();
            } catch { /* ignore */ }

            console.log("[ipc:letta:health-check] Unhealthy:", response.status, "Body:", body.slice(0, 200));
            return { healthy: false, error: `Server returned ${response.status}`, status: response.status, body: body.slice(0, 500) };
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            const errorType =
                errorMsg.includes("ECONNREFUSED") ? "connection-refused" :
                errorMsg.includes("ENOTFOUND") || errorMsg.includes("getaddrinfo") ? "dns-failed" :
                errorMsg.includes("ETIMEDOUT") ? "timeout" :
                errorMsg.includes("self-signed") || errorMsg.includes("certificate") ? "ssl-error" :
                "unknown";

            console.log("[ipc:letta:health-check] Error:", errorType, errorMsg);
            return { healthy: false, error: errorMsg, errorType, url: fullUrl };
        }
    });
})
