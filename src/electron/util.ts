import { ipcMain, WebContents, WebFrameMain } from "electron";
import { getUIPath } from "./pathResolver.js";
import { pathToFileURL } from "url";
import path from "path";
import { existsSync } from "fs";
export const DEV_PORT = 5173;

// Checks if you are in development mode
// Falls back to true if dist-react doesn't exist (prevents ERR_FILE_NOT_FOUND on first run)
export function isDev(): boolean {
    if (process.env.NODE_ENV === "development") return true;
    if (process.env.NODE_ENV === "production") return false;
    // Auto-detect: if dist-react/index.html doesn't exist, we're in dev
    const distPath = path.join(process.cwd(), "dist-react", "index.html");
    return !existsSync(distPath);
}

// Making IPC Typesafe
export function ipcMainHandle<Key extends keyof EventPayloadMapping>(key: Key, handler: (...args: any[]) => EventPayloadMapping[Key] | Promise<EventPayloadMapping[Key]>) {
    ipcMain.handle(key, (event, ...args) => {
        if (event.senderFrame) validateEventFrame(event.senderFrame);

        return handler(event, ...args)
    });
}

export function ipcWebContentsSend<Key extends keyof EventPayloadMapping>(key: Key, webContents: WebContents, payload: EventPayloadMapping[Key]) {
    webContents.send(key, payload);
}

export function validateEventFrame(frame: WebFrameMain) {
    if (isDev() && new URL(frame.url).host === `localhost:${DEV_PORT}`) return;

    if (frame.url !== pathToFileURL(getUIPath()).toString()) throw new Error("Malicious event");
}
