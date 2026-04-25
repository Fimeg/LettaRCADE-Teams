import electron from "electron";

electron.contextBridge.exposeInMainWorld("electron", {
    subscribeStatistics: (callback) =>
        ipcOn("statistics", stats => {
            callback(stats);
        }),
    getStaticData: () => ipcInvoke("getStaticData"),
    
    // Letta Agent IPC APIs
    sendClientEvent: (event: any) => {
        electron.ipcRenderer.send("client-event", event);
    },
    onServerEvent: (callback: (event: any) => void) => {
        const cb = (_: Electron.IpcRendererEvent, payload: string) => {
            try {
                const event = JSON.parse(payload);
                callback(event);
            } catch (error) {
                console.error("Failed to parse server event:", error);
            }
        };
        electron.ipcRenderer.on("server-event", cb);
        return () => electron.ipcRenderer.off("server-event", cb);
    },

    getRecentCwds: (limit?: number) =>
        ipcInvoke("get-recent-cwds", limit),
    selectDirectory: () =>
        ipcInvoke("select-directory"),

    // Config APIs
    getConfig: () =>
        ipcInvoke("get-config"),
    saveConfig: (config: { serverUrl?: string; apiKey?: string; permissionMode?: 'strict' | 'bypass'; windowWidth?: number; windowHeight?: number; theme?: 'light' | 'dark'; pollingInterval?: number; externalMemfsEnabled?: boolean }) =>
        ipcInvoke("save-config", config),
    getRuntimeEnv: () =>
        ipcInvoke("get-runtime-env"),

    // letta-code subprocess APIs
    lettaCode: {
        getStatus: () => electron.ipcRenderer.invoke("letta-code:get-status"),
        spawn: (opts?: { cwd?: string; serverUrl?: string; apiKey?: string }) => electron.ipcRenderer.invoke("letta-code:spawn", opts ?? {}),
        stop: () => electron.ipcRenderer.invoke("letta-code:stop"),
        onStatus: (callback: (payload: LettaCodeStatusPayload) => void) => {
            const cb = (_: Electron.IpcRendererEvent, payload: LettaCodeStatusPayload) => callback(payload);
            electron.ipcRenderer.on("letta-code:status", cb);
            return () => electron.ipcRenderer.off("letta-code:status", cb);
        },
        onLog: (callback: (entry: { stream: "stdout" | "stderr"; line: string }) => void) => {
            const cb = (_: Electron.IpcRendererEvent, entry: { stream: "stdout" | "stderr"; line: string }) => callback(entry);
            electron.ipcRenderer.on("letta-code:log", cb);
            return () => electron.ipcRenderer.off("letta-code:log", cb);
        },
    },
} satisfies Window['electron'])

function ipcInvoke<Key extends keyof EventPayloadMapping>(key: Key, ...args: any[]): Promise<EventPayloadMapping[Key]> {
    return electron.ipcRenderer.invoke(key, ...args);
}

function ipcOn<Key extends keyof EventPayloadMapping>(key: Key, callback: (payload: EventPayloadMapping[Key]) => void) {
    const cb = (_: Electron.IpcRendererEvent, payload: any) => callback(payload)
    electron.ipcRenderer.on(key, cb);
    return () => electron.ipcRenderer.off(key, cb)
}
