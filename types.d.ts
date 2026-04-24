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
}

type EventPayloadMapping = {
    statistics: Statistics;
    getStaticData: StaticData;
    "generate-session-title": string;
    "get-recent-cwds": string[];
    "select-directory": string | null;
    "get-config": ConfigData;
    "save-config": ConfigData;
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
        // letta-code subprocess APIs
        lettaCode: {
            getStatus: () => Promise<LettaCodeStatusPayload>;
            spawn: (opts?: { cwd?: string }) => Promise<LettaCodeStatusPayload>;
            stop: () => Promise<LettaCodeStatusPayload>;
            onStatus: (callback: (payload: LettaCodeStatusPayload) => void) => UnsubscribeFunction;
            onLog: (callback: (entry: { stream: "stdout" | "stderr"; line: string }) => void) => UnsubscribeFunction;
        };
    }
}
