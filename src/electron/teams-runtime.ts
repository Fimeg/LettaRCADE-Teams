import { spawn, type ChildProcess } from "child_process";
import { existsSync, mkdirSync, openSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type {
  DispatchTaskInput,
  SpawnTeammateInput,
  TaskState,
  TaskStatus,
  TeammateState,
} from "letta-teams-sdk";
import { getDaemonPort, stopDaemon as stopSdkDaemon } from "letta-teams-sdk/daemon";
import {
  dispatchTask,
  forkTeammateViaDaemon,
  getDaemonLogPath,
  isDaemonRunning,
  reinitTeammateViaDaemon,
  spawnTeammateViaDaemon,
  startCouncilViaDaemon,
  waitForDaemon,
  waitForTask,
} from "letta-teams-sdk/ipc";
import {
  listCouncilOpinions,
  listCouncilSessions as listStoredCouncilSessions,
  loadCouncilSession,
  readCouncilFinalPlan,
  readCouncilSynthesis,
} from "letta-teams-sdk/council/store";
import {
  getTask,
  listTasks,
  listTeammates,
  loadTeammate,
  setProjectDir,
  targetExists,
  teammateExists,
  updateTask,
} from "letta-teams-sdk/store";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type TeamsDaemonStatus = "stopped" | "starting" | "running" | "stopping" | "crashed";

export interface TeamsRuntimeConfig {
  baseUrl: string;
  apiKey?: string;
  projectDir: string;
}

export interface TeamsConfigureInput {
  baseUrl?: string;
  apiKey?: string;
  projectDir?: string;
}

export interface TeamsDaemonStatusPayload {
  status: TeamsDaemonStatus;
  pid?: number;
  port: number;
  baseUrl: string;
  projectDir: string;
  logPath: string;
  error?: string;
}

export interface TeamsRuntimeSnapshot {
  configured: boolean;
  config: TeamsRuntimeConfig;
  daemon: TeamsDaemonStatusPayload;
}

export type TeamsCouncilSessionStatus = "running" | "decided" | "max_turns" | "error";
export type TeamsCouncilVote = "agree" | "disagree";
export type TeamsCouncilSide = "thesis" | "antithesis";

export interface TeamsCouncilStartInput {
  prompt: string;
  message?: string;
  participantNames?: string[];
  maxTurns?: number;
}

export interface TeamsCouncilOpinionRecord {
  sessionId: string;
  turn: number;
  agentName: string;
  side: TeamsCouncilSide;
  position: string;
  evidence?: string[];
  proposal?: string;
  risks?: string[];
  openQuestions?: string[];
  createdAt: string;
}

export interface TeamsCouncilTurnState {
  turn: number;
  startedAt: string;
  completedAt?: string;
  opinionSubmittedBy: string[];
  votesBy: Record<string, TeamsCouncilVote>;
  notesBy: Record<string, string>;
  synthesisPath?: string;
}

export interface TeamsCouncilSessionMeta {
  sessionId: string;
  prompt: string;
  message?: string;
  createdAt: string;
  updatedAt: string;
  status: TeamsCouncilSessionStatus;
  participants: string[];
  leadName?: string;
  currentTurn: number;
  maxTurns: number;
  turns: Record<string, TeamsCouncilTurnState>;
  finalPlanPath?: string;
  finalDecision?: string;
  error?: string;
}

export interface TeamsCouncilSessionDetail {
  meta: TeamsCouncilSessionMeta;
  opinionsByTurn: Record<string, TeamsCouncilOpinionRecord[]>;
  synthesisByTurn: Record<string, string>;
  finalPlan: string | null;
}

function getDefaultBaseUrl(): string {
  return process.env.LETTA_BASE_URL?.trim() || "https://api.letta.com";
}

function normalizeApiKey(apiKey: string | undefined): string | undefined {
  const trimmed = apiKey?.trim();
  return trimmed ? trimmed : undefined;
}

export class TeamsRuntimeManager {
  private child: ChildProcess | null = null;
  private state: TeamsDaemonStatus = "stopped";
  private lastError?: string;
  private configured = false;
  private config: TeamsRuntimeConfig = {
    baseUrl: getDefaultBaseUrl(),
    apiKey: normalizeApiKey(process.env.LETTA_API_KEY),
    projectDir: process.cwd(),
  };
  private ensurePromise: Promise<TeamsDaemonStatusPayload> | null = null;

  configure(input: TeamsConfigureInput = {}): TeamsRuntimeSnapshot | Promise<TeamsRuntimeSnapshot> {
    const nextConfig: TeamsRuntimeConfig = {
      baseUrl: input.baseUrl?.trim() || this.config.baseUrl || getDefaultBaseUrl(),
      apiKey: input.apiKey === undefined ? this.config.apiKey : normalizeApiKey(input.apiKey),
      projectDir: input.projectDir?.trim() || this.config.projectDir || process.cwd(),
    };

    const connectionChanged =
      nextConfig.baseUrl !== this.config.baseUrl || nextConfig.apiKey !== this.config.apiKey;

    this.config = nextConfig;
    this.configured = true;
    this.applyRuntimeContext();

    if (connectionChanged && isDaemonRunning()) {
      return this.stop({ stopExternal: true }).then(() => this.getSnapshot());
    }

    return this.getSnapshot();
  }

  getSnapshot(): TeamsRuntimeSnapshot {
    return {
      configured: this.configured,
      config: { ...this.config },
      daemon: this.getDaemonStatus(),
    };
  }

  getDaemonStatus(): TeamsDaemonStatusPayload {
    const running = isDaemonRunning();
    if (!running && this.state === "running" && !this.child) {
      this.state = "stopped";
    }

    return {
      status:
        running && (this.state === "starting" || this.state === "stopping")
          ? this.state
          : running
            ? "running"
            : this.state,
      pid: this.child?.pid,
      port: getDaemonPort(),
      baseUrl: this.config.baseUrl,
      projectDir: this.config.projectDir,
      logPath: getDaemonLogPath(),
      error: this.lastError,
    };
  }

  async ensureDaemonRunning(): Promise<TeamsDaemonStatusPayload> {
    this.applyRuntimeContext();

    if (isDaemonRunning()) {
      this.state = "running";
      this.lastError = undefined;
      return this.getDaemonStatus();
    }

    if (this.ensurePromise) {
      return this.ensurePromise;
    }

    this.ensurePromise = this.startManagedDaemon();
    try {
      return await this.ensurePromise;
    } finally {
      this.ensurePromise = null;
    }
  }

  async stop(options: { stopExternal?: boolean } = {}): Promise<TeamsDaemonStatusPayload> {
    const { stopExternal = false } = options;
    this.state = "stopping";

    if (this.child) {
      const child = this.child;
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };

        child.once("exit", finish);
        child.kill("SIGTERM");

        setTimeout(() => {
          if (!settled) {
            child.kill("SIGKILL");
          }
        }, 3000);

        setTimeout(finish, 5000);
      });
    } else if (stopExternal && isDaemonRunning()) {
      try {
        await stopSdkDaemon();
      } catch {
        // Leave cleanup to the next startup attempt.
      }
    }

    this.child = null;
    this.state = isDaemonRunning() ? "crashed" : "stopped";
    return this.getDaemonStatus();
  }

  async listTeammates(): Promise<TeammateState[]> {
    return this.withProjectContext(() => listTeammates());
  }

  async getTeammate(name: string): Promise<TeammateState | null> {
    return this.withProjectContext(() => loadTeammate(name));
  }

  async teammateExists(name: string): Promise<boolean> {
    return this.withProjectContext(() => teammateExists(name));
  }

  async targetExists(name: string): Promise<boolean> {
    return this.withProjectContext(() => targetExists(name));
  }

  async spawnTeammate(input: SpawnTeammateInput): Promise<TeammateState> {
    await this.ensureDaemonRunning();
    return spawnTeammateViaDaemon(input.name, input.role, {
      model: input.model,
      contextWindowLimit: input.contextWindowLimit,
      spawnPrompt: input.spawnPrompt,
      skipInit: input.skipInit,
      memfsEnabled: input.memfsEnabled,
      memfsStartup: input.memfsStartup,
      projectDir: this.config.projectDir,
    });
  }

  async forkTeammate(name: string, forkName: string): Promise<TeammateState> {
    await this.ensureDaemonRunning();
    return forkTeammateViaDaemon(name, forkName, { projectDir: this.config.projectDir });
  }

  async reinitTeammate(name: string, prompt?: string): Promise<string> {
    await this.ensureDaemonRunning();
    return reinitTeammateViaDaemon(name, { prompt, projectDir: this.config.projectDir });
  }

  async getTask(id: string): Promise<TaskState | null> {
    return this.withProjectContext(() => getTask(id));
  }

  async listTasks(status?: TaskStatus): Promise<TaskState[]> {
    return this.withProjectContext(() => listTasks(status));
  }

  async dispatchTask(input: DispatchTaskInput): Promise<{ taskId: string }> {
    await this.ensureDaemonRunning();
    return dispatchTask(input.target, input.message, {
      projectDir: this.config.projectDir,
      pipelineId: input.options?.pipelineId,
      review: input.options?.review,
    });
  }

  async waitForTask(id: string): Promise<TaskState> {
    return waitForTask(id, { projectDir: this.config.projectDir });
  }

  async cancelTask(id: string): Promise<TaskState> {
    return this.withProjectContext(() => {
      const task = getTask(id);
      if (!task) {
        throw new Error(`Task '${id}' not found`);
      }

      if (task.status !== "pending" && task.status !== "running") {
        return task;
      }

      const cancelled = updateTask(id, {
        status: "error",
        error: "Cancelled by user",
        completedAt: new Date().toISOString(),
      });

      if (!cancelled) {
        throw new Error(`Task '${id}' not found`);
      }

      return cancelled;
    });
  }

  async startCouncil(input: TeamsCouncilStartInput): Promise<{ sessionId: string }> {
    await this.ensureDaemonRunning();
    return startCouncilViaDaemon(input.prompt, {
      message: input.message,
      participantNames: input.participantNames,
      maxTurns: input.maxTurns,
      projectDir: this.config.projectDir,
    });
  }

  async listCouncilSessions(): Promise<TeamsCouncilSessionMeta[]> {
    return this.withProjectContext(() => {
      const sessionIds = listStoredCouncilSessions();
      const sessions = sessionIds
        .map((sessionId) => loadCouncilSession(sessionId) as TeamsCouncilSessionMeta | null)
        .filter((session): session is TeamsCouncilSessionMeta => !!session)
        .sort((a, b) => {
          const aTime = Date.parse(a.updatedAt) || Date.parse(a.createdAt) || 0;
          const bTime = Date.parse(b.updatedAt) || Date.parse(b.createdAt) || 0;
          return bTime - aTime;
        });

      return sessions;
    });
  }

  async getCouncilSession(sessionId: string): Promise<TeamsCouncilSessionDetail | null> {
    return this.withProjectContext(() => {
      const meta = loadCouncilSession(sessionId) as TeamsCouncilSessionMeta | null;
      if (!meta) {
        return null;
      }

      const turnEntries = Object.keys(meta.turns).sort((a, b) => Number(a) - Number(b));
      const opinionsByTurn: Record<string, TeamsCouncilOpinionRecord[]> = {};
      const synthesisByTurn: Record<string, string> = {};

      for (const turnKey of turnEntries) {
        const turnNumber = Number(turnKey);
        opinionsByTurn[turnKey] = listCouncilOpinions(sessionId, turnNumber) as TeamsCouncilOpinionRecord[];

        const synthesis = readCouncilSynthesis(sessionId, turnNumber);
        if (synthesis) {
          synthesisByTurn[turnKey] = synthesis;
        }
      }

      return {
        meta,
        opinionsByTurn,
        synthesisByTurn,
        finalPlan: readCouncilFinalPlan(sessionId),
      };
    });
  }

  private async startManagedDaemon(): Promise<TeamsDaemonStatusPayload> {
    const daemonEntry = this.resolveDaemonEntry();
    const logPath = getDaemonLogPath();

    mkdirSync(path.dirname(logPath), { recursive: true });

    this.state = "starting";
    this.lastError = undefined;

    const spawnEnv: Record<string, string | undefined> = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      LETTA_BASE_URL: this.config.baseUrl,
      CI: "1",
    };
    if (this.config.apiKey) {
      spawnEnv.LETTA_API_KEY = this.config.apiKey;
    } else {
      delete spawnEnv.LETTA_API_KEY;
    }

    const logFile = openSync(logPath, "a");
    const CREATE_NO_WINDOW = 0x08000000;
    const child = spawn(process.execPath, [daemonEntry], {
      cwd: this.config.projectDir,
      env: spawnEnv,
      stdio: ["ignore", logFile, logFile],
      windowsHide: true,
      ...(process.platform === "win32" && { CREATE_NO_WINDOW }),
    });

    this.child = child;

    child.on("error", (error) => {
      this.lastError = error.message;
      this.child = null;
      this.state = "crashed";
    });

    child.on("exit", (code, signal) => {
      this.child = null;
      if (this.state === "stopping") {
        this.state = "stopped";
        return;
      }

      if (code === 0 || signal === "SIGTERM") {
        this.state = "stopped";
        return;
      }

      this.lastError = `Teams daemon exited (code=${code}, signal=${signal ?? "none"})`;
      this.state = "crashed";
    });

    const ready = await waitForDaemon(10000);
    if (!ready) {
      this.lastError = `Teams daemon failed to start. Check log file: ${logPath}`;
      this.state = "crashed";
      if (this.child && !this.child.killed) {
        this.child.kill("SIGKILL");
      }
      this.child = null;
      throw new Error(this.lastError);
    }

    this.state = "running";
    return this.getDaemonStatus();
  }

  private applyRuntimeContext(): void {
    process.env.LETTA_BASE_URL = this.config.baseUrl;
    if (this.config.apiKey) {
      process.env.LETTA_API_KEY = this.config.apiKey;
    } else {
      delete process.env.LETTA_API_KEY;
    }
    setProjectDir(this.config.projectDir);
  }

  private withProjectContext<T>(fn: () => T): Promise<T> {
    this.applyRuntimeContext();
    return Promise.resolve(fn());
  }

  private resolveDaemonEntry(): string {
    const daemonEntry = path.join(__dirname, "teams-daemon.js");
    if (!existsSync(daemonEntry)) {
      throw new Error(`Teams daemon entry not found at ${daemonEntry}`);
    }
    return daemonEntry;
  }
}

let runtimeSingleton: TeamsRuntimeManager | null = null;

export function getTeamsRuntimeManager(): TeamsRuntimeManager {
  if (!runtimeSingleton) {
    runtimeSingleton = new TeamsRuntimeManager();
  }
  return runtimeSingleton;
}
