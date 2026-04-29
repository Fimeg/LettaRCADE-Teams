import { existsSync, mkdirSync, openSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { DispatchTaskInput, SpawnTeammateInput, TaskState, TaskStatus, TeammateState } from "letta-teams/types";
import { spawnTeammate, checkApiKey, forkTeammate, messageTeammate } from "letta-teams/agent";
import { processTask, recoverStaleInitTasks, startBackgroundInit } from "letta-teams/daemon";
import { runCouncilSession } from "letta-teams/council/orchestrator";
import {
  listCouncilOpinions,
  listCouncilSessions as listStoredCouncilSessions,
  loadCouncilSession,
  readCouncilFinalPlan,
  readCouncilSynthesis,
} from "letta-teams/council/store";
import {
  getTask,
  listTasks,
  createTask,
  setProjectDir,
  targetExists,
  teammateExists,
  updateTask,
  listTeammates,
  loadTeammate,
} from "letta-teams/store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDefaultBaseUrl(): string {
  return process.env.LETTA_BASE_URL?.trim() || "https://api.letta.com";
}

function normalizeApiKey(apiKey: string | undefined): string | undefined {
  const trimmed = apiKey?.trim();
  return trimmed ? trimmed : undefined;
}

// ---------------------------------------------------------------------------
// Runtime Manager
// ---------------------------------------------------------------------------

export class TeamsRuntimeManager {
  private state: TeamsDaemonStatus = "stopped";
  private lastError?: string;
  private configured = false;
  private config: TeamsRuntimeConfig = {
    baseUrl: getDefaultBaseUrl(),
    apiKey: normalizeApiKey(process.env.LETTA_API_KEY),
    projectDir: process.cwd(),
  };

  /** Map of Letta agent ID → teammate name, for cross-referencing agent lists. */
  getAgentTeammateMap(): Record<string, string> {
    const map: Record<string, string> = {};
    const teammates = listTeammates();
    for (const t of teammates) {
      if (t.agentId) map[t.agentId] = t.name;
    }
    return map;
  }

  configure(input: TeamsConfigureInput = {}): TeamsRuntimeSnapshot {
    const nextConfig: TeamsRuntimeConfig = {
      baseUrl: input.baseUrl?.trim() || this.config.baseUrl || getDefaultBaseUrl(),
      apiKey: input.apiKey === undefined ? this.config.apiKey : normalizeApiKey(input.apiKey),
      projectDir: input.projectDir?.trim() || this.config.projectDir || process.cwd(),
    };

    this.config = nextConfig;
    this.configured = true;
    this.applyRuntimeContext();

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
    return {
      status: this.state,
      port: 0,
      baseUrl: this.config.baseUrl,
      projectDir: this.config.projectDir,
      logPath: "",
      error: this.lastError,
    };
  }

  /** Ensure the runtime is ready to process operations.
   *  Replaces daemon-start with a lightweight init check. */
  async ensureDaemonRunning(): Promise<TeamsDaemonStatusPayload> {
    this.applyRuntimeContext();
    await recoverStaleInitTasks();
    this.state = "running";
    this.lastError = undefined;
    return this.getDaemonStatus();
  }

  async stop(): Promise<TeamsDaemonStatusPayload> {
    this.state = "stopped";
    return this.getDaemonStatus();
  }

  // ─── Teammate operations ────────────────────────────────────────────────

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
    const teammate = await spawnTeammate(input.name, input.role, {
      model: input.model,
      contextWindowLimit: input.contextWindowLimit,
      spawnPrompt: input.spawnPrompt,
      skipInit: input.skipInit,
      memfsEnabled: input.memfsEnabled,
      memfsStartup: input.memfsStartup,
    });

    // Kick off background init if not skipped
    if (!input.skipInit && teammate.initTaskId) {
      const startedAt = new Date().toISOString();
      updateTask(teammate.initTaskId, { status: "running", startedAt });
    }

    return teammate;
  }

  async forkTeammate(name: string, forkName: string): Promise<TeammateState> {
    return forkTeammate(name, forkName);
  }

  async reinitTeammate(name: string, prompt?: string): Promise<string> {
    const teammate = loadTeammate(name);
    if (!teammate) throw new Error(`Teammate '${name}' not found`);

    const taskId = await startBackgroundInit(teammate, {
      message: "[internal reinit]",
      prompt: prompt || `Reinitialize ${name} with current context.`,
      syncReason: "reinitialize teammate",
    });

    return taskId;
  }

  // ─── Task operations ────────────────────────────────────────────────────

  async getTask(id: string): Promise<TaskState | null> {
    return this.withProjectContext(() => getTask(id));
  }

  async listTasks(status?: TaskStatus): Promise<TaskState[]> {
    return this.withProjectContext(() => listTasks(status));
  }

  async dispatchTask(input: DispatchTaskInput): Promise<{ taskId: string }> {
    await this.ensureDaemonRunning();

    const task = createTask(input.target, input.message, {
      pipelineId: input.options?.pipelineId,
      requiresReview: !!input.options?.review,
      reviewTarget: input.options?.review?.reviewer,
      reviewGatePolicy: input.options?.review?.gate,
    });

    processTask(task.id, input.target, input.message, {
      pipelineId: input.options?.pipelineId,
      review: input.options?.review,
    }).catch((err: Error) => {
      console.error(`[teams-runtime] Task ${task.id} failed:`, err);
    });

    return { taskId: task.id };
  }

  async waitForTask(id: string): Promise<TaskState> {
    return new Promise((resolve, reject) => {
      const poll = () => {
        const task = getTask(id);
        if (!task) {
          reject(new Error(`Task '${id}' not found`));
          return;
        }
        if (task.status === "done" || task.status === "error" || task.status === "approved" || task.status === "rejected") {
          resolve(task);
          return;
        }
        setTimeout(poll, 1000);
      };
      poll();
    });
  }

  async cancelTask(id: string): Promise<TaskState> {
    return this.withProjectContext(() => {
      const task = getTask(id);
      if (!task) throw new Error(`Task '${id}' not found`);
      if (task.status !== "pending" && task.status !== "running") return task;

      const cancelled = updateTask(id, {
        status: "error",
        error: "Cancelled by user",
        completedAt: new Date().toISOString(),
      });
      if (!cancelled) throw new Error(`Task '${id}' not found`);
      return cancelled;
    });
  }

  // ─── Council operations ─────────────────────────────────────────────────

  async startCouncil(input: TeamsCouncilStartInput): Promise<{ sessionId: string }> {
    return runCouncilSession({
      prompt: input.prompt,
      message: input.message,
      participantNames: input.participantNames,
      maxTurns: input.maxTurns,
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
      if (!meta) return null;

      const turnEntries = Object.keys(meta.turns).sort((a, b) => Number(a) - Number(b));
      const opinionsByTurn: Record<string, TeamsCouncilOpinionRecord[]> = {};
      const synthesisByTurn: Record<string, string> = {};

      for (const turnKey of turnEntries) {
        const turnNumber = Number(turnKey);
        opinionsByTurn[turnKey] = listCouncilOpinions(sessionId, turnNumber) as TeamsCouncilOpinionRecord[];
        const synthesis = readCouncilSynthesis(sessionId, turnNumber);
        if (synthesis) synthesisByTurn[turnKey] = synthesis;
      }

      return {
        meta,
        opinionsByTurn,
        synthesisByTurn,
        finalPlan: readCouncilFinalPlan(sessionId),
      };
    });
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private applyRuntimeContext(): void {
    process.env.LETTA_BASE_URL = this.config.baseUrl;
    if (this.config.apiKey) {
      process.env.LETTA_API_KEY = this.config.apiKey;
    } else {
      delete process.env.LETTA_API_KEY;
    }
    setProjectDir(this.config.projectDir);
  }

  private async withProjectContext<T>(fn: () => T): Promise<T> {
    this.applyRuntimeContext();
    return Promise.resolve(fn());
  }
}

let runtimeSingleton: TeamsRuntimeManager | null = null;

export function getTeamsRuntimeManager(): TeamsRuntimeManager {
  if (!runtimeSingleton) {
    runtimeSingleton = new TeamsRuntimeManager();
  }
  return runtimeSingleton;
}
