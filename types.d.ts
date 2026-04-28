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
    LETTA_API_KEY?: string;
    /** True iff LETTA_API_KEY is set (value not exposed). */
    apiKeySet: boolean;
    /** True iff LETTA_MEMFS_GIT_TOKEN is set (value not exposed). */
    memfsGitTokenSet: boolean;
    /** Resolved cwd of the main process (helps locate .env). */
    cwd: string;
}

/** Operator profile — single-human-per-install, see CLAUDE.md "single-user
 *  ceiling". Secrets live in OS keychain, NOT in this object. */
type OperatorProfileData = {
    displayName: string;
    /** `LETTA_MEMFS_GIT_URL` template; CLI replaces `{agentId}`. */
    memfsGitUrlTemplate?: string;
    createdAt: number;
    updatedAt: number;
}

type TeamsTaskState = import("letta-teams-sdk").TaskState;
type TeamsTeammateState = import("letta-teams-sdk").TeammateState;
type TeamsSpawnInput = import("letta-teams-sdk").SpawnTeammateInput;
type TeamsDispatchInput = import("letta-teams-sdk").DispatchTaskInput;
type TeamsTaskStatus = import("letta-teams-sdk").TaskStatus;

type TeamsRuntimeConfig = {
    baseUrl: string;
    apiKey?: string;
    projectDir: string;
}

type TeamsDaemonStatus = "stopped" | "starting" | "running" | "stopping" | "crashed";

type TeamsDaemonStatusPayload = {
    status: TeamsDaemonStatus;
    pid?: number;
    port: number;
    baseUrl: string;
    projectDir: string;
    logPath: string;
    error?: string;
}

type TeamsRuntimeSnapshot = {
    configured: boolean;
    config: TeamsRuntimeConfig;
    daemon: TeamsDaemonStatusPayload;
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
    "operator-profile:get": OperatorProfileData | null;
    "operator-profile:save": OperatorProfileData;
    "operator-secrets:set-memfs-token": boolean;
    "operator-secrets:has-memfs-token": boolean;
    "operator-secrets:clear-memfs-token": boolean;
    "letta-code:get-status": LettaCodeStatusPayload;
    "letta-code:spawn": LettaCodeStatusPayload;
    "letta-code:stop": LettaCodeStatusPayload;
    "letta:health-check": HealthCheckResult;
    "teams:configure": TeamsRuntimeSnapshot;
    "teams:daemon:get-status": TeamsDaemonStatusPayload;
    "teams:daemon:ensure-running": TeamsDaemonStatusPayload;
    "teams:teammates:list": TeamsTeammateState[];
    "teams:teammates:get": TeamsTeammateState | null;
    "teams:teammates:spawn": TeamsTeammateState;
    "teams:teammates:fork": TeamsTeammateState;
    "teams:teammates:reinit": string;
    "teams:tasks:list": TeamsTaskState[];
    "teams:tasks:get": TeamsTaskState | null;
    "teams:tasks:dispatch": { taskId: string };
    "teams:tasks:wait": TeamsTaskState;
    "teams:tasks:cancel": TeamsTaskState;
}

type LettaCodeStatus = "stopped" | "starting" | "running" | "stopping" | "crashed";

type LettaCodeStatusPayload = {
    status: LettaCodeStatus;
    pid?: number;
    exitCode?: number | null;
    exitSignal?: string | null;
    error?: string;
}

type HealthCheckResult = {
    healthy: boolean;
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
        // Operator profile (single-user-per-install setup gate)
        getOperatorProfile: () => Promise<OperatorProfileData | null>;
        saveOperatorProfile: (profile: { displayName?: string; memfsGitUrlTemplate?: string }) => Promise<OperatorProfileData>;
        // Operator secrets — token write-only from renderer. The token never
        // round-trips back to the renderer in plaintext; only the boolean
        // "is set" is exposed.
        operatorSecrets: {
            setMemfsToken: (token: string) => Promise<boolean>;
            hasMemfsToken: () => Promise<boolean>;
            clearMemfsToken: () => Promise<boolean>;
        };
        // letta-code subprocess APIs
        lettaCode: {
            getStatus: () => Promise<LettaCodeStatusPayload>;
            spawn: (opts?: { cwd?: string; serverUrl?: string; apiKey?: string; agentId?: string; agentMetadataEnv?: { letta_memfs_git_url?: string; letta_memfs_local?: string } }) => Promise<LettaCodeStatusPayload>;
            stop: () => Promise<LettaCodeStatusPayload>;
            onStatus: (callback: (payload: LettaCodeStatusPayload) => void) => UnsubscribeFunction;
            onLog: (callback: (entry: { stream: "stdout" | "stderr"; line: string }) => void) => UnsubscribeFunction;
        };
        teams: {
            configure: (input?: Partial<TeamsRuntimeConfig>) => Promise<TeamsRuntimeSnapshot>;
            getDaemonStatus: () => Promise<TeamsDaemonStatusPayload>;
            ensureDaemonRunning: () => Promise<TeamsDaemonStatusPayload>;
            listTeammates: () => Promise<TeamsTeammateState[]>;
            getTeammate: (name: string) => Promise<TeamsTeammateState | null>;
            spawnTeammate: (input: TeamsSpawnInput) => Promise<TeamsTeammateState>;
            forkTeammate: (name: string, forkName: string) => Promise<TeamsTeammateState>;
            reinitTeammate: (name: string, prompt?: string) => Promise<string>;
            listTasks: (status?: TeamsTaskStatus) => Promise<TeamsTaskState[]>;
            getTask: (id: string) => Promise<TeamsTaskState | null>;
            dispatchTask: (input: TeamsDispatchInput) => Promise<{ taskId: string }>;
            waitForTask: (id: string) => Promise<TeamsTaskState>;
            cancelTask: (id: string) => Promise<TeamsTaskState>;
        };
    }
}
