import electron from "electron";
import type { DispatchTaskInput, SpawnTeammateInput, TaskStatus } from "letta-teams-sdk";
import type { TeamsConfigureInput, TeamsCouncilStartInput } from "./teams-runtime.js";

electron.contextBridge.exposeInMainWorld("electron", {
    subscribeStatistics: (callback: (stats: { cpuUsage: number; ramUsage: number; storageData: number }) => void) =>
        ipcOn("statistics", (stats: { cpuUsage: number; ramUsage: number; storageData: number }) => {
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

    // Operator profile (setup-first gate)
    getOperatorProfile: () =>
        ipcInvoke("operator-profile:get"),
    saveOperatorProfile: (profile: { displayName?: string; memfsGitUrlTemplate?: string }) =>
        ipcInvoke("operator-profile:save", profile),

    operatorSecrets: {
        setMemfsToken: (token: string) =>
            electron.ipcRenderer.invoke("operator-secrets:set-memfs-token", token),
        hasMemfsToken: () =>
            electron.ipcRenderer.invoke("operator-secrets:has-memfs-token"),
        clearMemfsToken: () =>
            electron.ipcRenderer.invoke("operator-secrets:clear-memfs-token"),
    },

    // letta-code subprocess APIs
    lettaCode: {
        getStatus: () => electron.ipcRenderer.invoke("letta-code:get-status"),
        spawn: (opts?: { cwd?: string; serverUrl?: string; apiKey?: string; agentId?: string; agentMetadataEnv?: { letta_memfs_git_url?: string; letta_memfs_local?: string } }) => electron.ipcRenderer.invoke("letta-code:spawn", opts ?? {}),
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

    teams: {
        configure: (input: TeamsConfigureInput = {}) =>
            ipcInvoke("teams:configure", input),
        getDaemonStatus: () =>
            ipcInvoke("teams:daemon:get-status"),
        ensureDaemonRunning: () =>
            ipcInvoke("teams:daemon:ensure-running"),
        listTeammates: () =>
            ipcInvoke("teams:teammates:list"),
        getTeammate: (name: string) =>
            ipcInvoke("teams:teammates:get", name),
        spawnTeammate: (input: SpawnTeammateInput) =>
            ipcInvoke("teams:teammates:spawn", input),
        forkTeammate: (name: string, forkName: string) =>
            ipcInvoke("teams:teammates:fork", name, forkName),
        reinitTeammate: (name: string, prompt?: string) =>
            ipcInvoke("teams:teammates:reinit", name, prompt),
        listTasks: (status?: TaskStatus) =>
            ipcInvoke("teams:tasks:list", status),
        getTask: (id: string) =>
            ipcInvoke("teams:tasks:get", id),
        dispatchTask: (input: DispatchTaskInput) =>
            ipcInvoke("teams:tasks:dispatch", input),
        waitForTask: (id: string) =>
            ipcInvoke("teams:tasks:wait", id),
        cancelTask: (id: string) =>
            ipcInvoke("teams:tasks:cancel", id),
        startCouncil: (input: TeamsCouncilStartInput) =>
            ipcInvoke("teams:councils:start", input),
        listCouncilSessions: () =>
            ipcInvoke("teams:councils:list"),
        getCouncilSession: (sessionId: string) =>
            ipcInvoke("teams:councils:get", sessionId),
    },

    // 3-mode connection health check
    letta: {
        healthCheck: (url: string, apiKey?: string) => electron.ipcRenderer.invoke("letta:health-check", url, apiKey),
    },
} as const)

function ipcInvoke<Key extends keyof EventPayloadMapping>(key: Key, ...args: any[]): Promise<EventPayloadMapping[Key]> {
    return electron.ipcRenderer.invoke(key, ...args);
}

function ipcOn<Key extends keyof EventPayloadMapping>(key: Key, callback: (payload: EventPayloadMapping[Key]) => void) {
    const cb = (_: Electron.IpcRendererEvent, payload: any) => callback(payload)
    electron.ipcRenderer.on(key, cb);
    return () => electron.ipcRenderer.off(key, cb)
}
