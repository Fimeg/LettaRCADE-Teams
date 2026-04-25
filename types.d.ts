type Statistics = {
    cpuUsage: number;
    ramUsage: number;
    storageData: number;
}

type StaticData = {
    totalStorage: number;
    cpuModel: string;
    totalMemoryGB: number;
}

type UnsubscribeFunction = () => void;

type ConfigData = {
    serverUrl: string;
    apiKey?: string;
    permissionMode: 'strict' | 'bypass';
    windowWidth: number;
    windowHeight: number;
    theme: 'light' | 'dark';
    pollingInterval: number;
    externalMemfsEnabled?: boolean;
}

/** A whitelisted snapshot of process.env (main process) for read-only display
 *  in Settings. Secrets like api keys are never sent — `apiKeySet` is just a
 *  boolean indicating presence. */
type RuntimeEnv = {
    LETTA_BASE_URL?: string;
    LETTA_CODE_CLI_PATH?: string;
    LETTA_MEMFS_LOCAL?: string;
    LETTA_MEMFS_GIT_URL?: string;
    /** True iff LETTA_API_KEY is set (value not exposed). */
    apiKeySet: boolean;
    /** True iff LETTA_MEMFS_GIT_TOKEN is set (value not exposed). */
    memfsGitTokenSet: boolean;
    /** Resolved cwd of the main process (helps locate .env). */
    cwd: string;
}

type EventPayloadMapping = {
    statistics: Statistics;
    getStaticData: StaticData;
    "generate-session-title": string;
    "get-recent-cwds": string[];
    "select-directory": string | null;
    "get-config": ConfigData;
    "save-config": ConfigData;
    "get-runtime-env": RuntimeEnv;
}

type LettaCodeStatus = "stopped" | "starting" | "running" | "stopping" | "crashed";

type LettaCodeStatusPayload = {
    status: LettaCodeStatus;
    pid?: number;
    exitCode?: number | null;
    exitSignal?: string | null;
    error?: string;
}

interface Window {
    electron: {
        subscribeStatistics: (callback: (statistics: Statistics) => void) => UnsubscribeFunction;
        getStaticData: () => Promise<StaticData>;
        // Letta Agent IPC APIs
        sendClientEvent: (event: any) => void;
        onServerEvent: (callback: (event: any) => void) => UnsubscribeFunction;
        getRecentCwds: (limit?: number) => Promise<string[]>;
        selectDirectory: () => Promise<string | null>;
        // Config APIs
        getConfig: () => Promise<ConfigData>;
        saveConfig: (config: Partial<ConfigData>) => Promise<ConfigData>;
        getRuntimeEnv: () => Promise<RuntimeEnv>;
        // letta-code subprocess APIs
        lettaCode: {
            getStatus: () => Promise<LettaCodeStatusPayload>;
            spawn: (opts?: { cwd?: string; serverUrl?: string; apiKey?: string }) => Promise<LettaCodeStatusPayload>;
            stop: () => Promise<LettaCodeStatusPayload>;
            onStatus: (callback: (payload: LettaCodeStatusPayload) => void) => UnsubscribeFunction;
            onLog: (callback: (entry: { stream: "stdout" | "stderr"; line: string }) => void) => UnsubscribeFunction;
        };
    }
}
