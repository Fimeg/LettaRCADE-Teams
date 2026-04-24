import { app, BrowserWindow, ipcMain, dialog, globalShortcut, Menu } from "electron"
import { execSync } from "child_process";
import { config as dotenvConfig } from "dotenv";
import { join } from "path";
import { ipcMainHandle, isDev, DEV_PORT } from "./util.js";
import { loadConfig, saveConfig, type Config } from "./config.js";
import { initDatabase, closeDatabase, saveSession, getAllSessions, deleteSession, updateSessionStatus } from "./db.js";
import type { ClientEvent, ServerEvent } from "./types.js";

// Load .env file from project root
dotenvConfig({ path: join(process.cwd(), ".env") });

// Default to Letta Cloud if no base URL set
if (!process.env.LETTA_BASE_URL) {
  process.env.LETTA_BASE_URL = "https://api.letta.com";
}

// Set dummy API key for localhost (local server doesn't check it)
if (!process.env.LETTA_API_KEY && process.env.LETTA_BASE_URL?.includes("localhost")) {
  process.env.LETTA_API_KEY = "local-dev-key";
}

// Find letta CLI
try {
  const whichCmd = process.platform === 'win32' ? 'where letta' : 'which letta';
  const lettaPath = execSync(whichCmd, { encoding: "utf-8" }).trim();
  if (lettaPath) {
    // On Windows, 'where' may return multiple lines - take the first one
    const firstPath = lettaPath.split('\n')[0].trim();
    process.env.LETTA_CLI_PATH = firstPath;
    console.log("Found letta CLI at:", firstPath);
  }
} catch (e) {
  console.warn("Could not find letta CLI:", e);
}
import { getPreloadPath, getUIPath, getIconPath } from "./pathResolver.js";
import { getStaticData, pollResources, stopPolling } from "./test.js";
import { handleClientEvent, cleanupAllSessions } from "./ipc-handlers.js";
import { startProxyServer, type ProxyHandle } from "./proxy-server.js";
import { LettaCodeManager, type LettaCodeStatusPayload } from "./letta-code-manager.js";

let cleanupComplete = false;
let mainWindow: BrowserWindow | null = null;
let appConfig: Config;
let proxyHandle: ProxyHandle | null = null;
const lettaCode = new LettaCodeManager();

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

function cleanup(): void {
    if (cleanupComplete) return;
    cleanupComplete = true;

    // Save window size to config
    if (mainWindow && appConfig) {
        const bounds = mainWindow.getBounds();
        appConfig.windowWidth = bounds.width;
        appConfig.windowHeight = bounds.height;
        saveConfig(appConfig);
    }

    globalShortcut.unregisterAll();
    stopPolling();
    cleanupAllSessions();
    // Fire-and-forget; Electron is tearing down anyway
    lettaCode.stop().catch(() => {});
    proxyHandle?.stop().catch(() => {});
    closeDatabase();
    killViteDevServer();
}

function handleSignal(): void {
    cleanup();
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
app.on("ready", () => {
    // Initialize config and database
    appConfig = loadConfig();
    initDatabase();

    Menu.setApplicationMenu(null);
    // Setup event handlers
    app.on("before-quit", cleanup);
    app.on("will-quit", cleanup);
    app.on("window-all-closed", () => {
        cleanup();
        app.quit();
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
                    "script-src 'self' 'unsafe-inline'; " +
                    "style-src 'self' 'unsafe-inline'"
                ]
            }
        });
    });

    if (isDev()) mainWindow.loadURL(`http://localhost:${DEV_PORT}`)
    else mainWindow.loadFile(getUIPath());

    globalShortcut.register('CommandOrControl+Q', () => {
        cleanup();
        app.quit();
    });

    pollResources(mainWindow);

    ipcMainHandle("getStaticData", () => {
        return getStaticData();
    });

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
        handleClientEvent(data);
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

    // Start local proxy server for letta-code subprocess
    startProxyServer(
        appConfig.serverUrl || process.env.LETTA_BASE_URL || "http://localhost:8283",
        appConfig.apiKey || process.env.LETTA_API_KEY || "",
    )
        .then((handle) => {
            proxyHandle = handle;
            console.log(`[proxy] listening on 127.0.0.1:${handle.port}`);
        })
        .catch((err) => {
            console.error("[proxy] failed to start:", err);
        });

    // Broadcast letta-code status changes to renderer
    lettaCode.on("status", (payload: LettaCodeStatusPayload) => {
        mainWindow?.webContents.send("letta-code:status", payload);
    });
    lettaCode.on("log", (entry: { stream: "stdout" | "stderr"; line: string }) => {
        mainWindow?.webContents.send("letta-code:log", entry);
    });

    ipcMain.handle("letta-code:get-status", () => lettaCode.getStatus());

    ipcMain.handle("letta-code:spawn", async (_event, opts: { cwd?: string } = {}) => {
        if (!proxyHandle) {
            throw new Error("proxy server not ready yet");
        }
        // Keep proxy upstream in sync with latest saved config
        proxyHandle.setUpstream(
            appConfig.serverUrl || "http://localhost:8283",
            appConfig.apiKey || "",
        );
        await lettaCode.spawn({
            proxyPort: proxyHandle.port,
            sessionToken: proxyHandle.sessionToken,
            cwd: opts.cwd,
        });
        return lettaCode.getStatus();
    });

    ipcMain.handle("letta-code:stop", async () => {
        await lettaCode.stop();
        return lettaCode.getStatus();
    });
})
