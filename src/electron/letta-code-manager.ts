import { spawn, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { EventEmitter } from "events";
import { app } from "electron";

/**
 * Spawns and supervises the @letta-ai/letta-code CLI as an Electron
 * subprocess. The CLI thinks it is talking to Letta Cloud; in reality its
 * LETTA_BASE_URL points at the local proxy, which forwards to the configured
 * upstream (self-hosted server or cloud).
 */

export type LettaCodeStatus =
  | "stopped"
  | "starting"
  | "running"
  | "stopping"
  | "crashed";

export interface LettaCodeStatusPayload {
  status: LettaCodeStatus;
  pid?: number;
  exitCode?: number | null;
  exitSignal?: string | null;
  error?: string;
}

interface SpawnOptions {
  proxyPort: number;
  sessionToken: string;
  cwd?: string;
}

const CLI_MODULE = path.join("@letta-ai", "letta-code", "letta.js");

function resolveCliPath(): string {
  const candidates = [
    path.join(app.getAppPath(), "node_modules", CLI_MODULE),
    path.join(process.cwd(), "node_modules", CLI_MODULE),
    path.join(__dirname, "..", "..", "node_modules", CLI_MODULE),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    `letta-code CLI not found. Searched:\n  - ${candidates.join("\n  - ")}`,
  );
}

export class LettaCodeManager extends EventEmitter {
  private child: ChildProcess | null = null;
  private state: LettaCodeStatus = "stopped";
  private intentionalStop = false;
  private lastError?: string;

  getStatus(): LettaCodeStatusPayload {
    return {
      status: this.state,
      pid: this.child?.pid,
      error: this.lastError,
    };
  }

  isRunning(): boolean {
    return this.state === "running" || this.state === "starting";
  }

  async spawn(opts: SpawnOptions): Promise<void> {
    if (this.child) {
      throw new Error("letta-code is already running");
    }

    let cliPath: string;
    try {
      cliPath = resolveCliPath();
    } catch (err) {
      this.setState("crashed", { error: (err as Error).message });
      throw err;
    }

    this.intentionalStop = false;
    this.lastError = undefined;
    this.setState("starting");

    const child = spawn(process.execPath, [cliPath], {
      cwd: opts.cwd ?? process.cwd(),
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        LETTA_BASE_URL: `http://127.0.0.1:${opts.proxyPort}`,
        LETTA_API_KEY: opts.sessionToken,
        // Keep the CLI from trying to open a TTY; it should run headless.
        CI: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.child = child;

    child.stdout?.on("data", (chunk: Buffer) => {
      this.emit("log", { stream: "stdout", line: chunk.toString("utf-8") });
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      this.emit("log", { stream: "stderr", line: chunk.toString("utf-8") });
    });

    child.on("spawn", () => {
      this.setState("running");
    });

    child.on("error", (err) => {
      this.lastError = err.message;
      this.child = null;
      this.setState("crashed", { error: err.message });
    });

    child.on("exit", (code, signal) => {
      const wasIntentional = this.intentionalStop;
      this.child = null;
      if (wasIntentional || code === 0) {
        this.setState("stopped", { exitCode: code, exitSignal: signal ?? null });
      } else {
        this.setState("crashed", {
          exitCode: code,
          exitSignal: signal ?? null,
          error: `letta-code exited (code=${code}, signal=${signal ?? "none"})`,
        });
      }
    });
  }

  async stop(): Promise<void> {
    if (!this.child) return;
    this.intentionalStop = true;
    this.setState("stopping");
    const child = this.child;
    return new Promise((resolve) => {
      const done = () => resolve();
      child.once("exit", done);
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 3000);
    });
  }

  private setState(
    status: LettaCodeStatus,
    extras: Partial<LettaCodeStatusPayload> = {},
  ): void {
    this.state = status;
    const payload: LettaCodeStatusPayload = {
      status,
      pid: this.child?.pid,
      ...extras,
    };
    this.emit("status", payload);
  }
}
