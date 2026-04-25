import { spawn, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { EventEmitter } from "events";
import { app } from "electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  /** Extra env vars layered onto the spawn child. Caller is responsible for
   *  resolving operator-profile templates, decrypting tokens from the
   *  keychain, and applying per-agent overrides before passing them in. */
  extraEnv?: Record<string, string | undefined>;
}

const CLI_MODULE = path.join("@letta-ai", "letta-code", "letta.js");

function resolveCliPath(): string {
  const override = process.env.LETTA_CODE_CLI_PATH?.trim();
  const candidates: string[] = [];
  if (override) candidates.push(override);
  candidates.push(
    path.join(app.getAppPath(), "node_modules", CLI_MODULE),
    path.join(process.cwd(), "node_modules", CLI_MODULE),
    path.join(__dirname, "..", "..", "node_modules", CLI_MODULE),
  );

  console.log("[letta-code] Resolving CLI path...");
  if (override) console.log(`[letta-code] LETTA_CODE_CLI_PATH override: ${override}`);
  console.log(`[letta-code] App path: ${app.getAppPath()}`);
  console.log(`[letta-code] CWD: ${process.cwd()}`);
  console.log(`[letta-code] __dirname: ${__dirname}`);
  console.log(`[letta-code] execPath: ${process.execPath}`);

  const checked: { path: string; exists: boolean }[] = [];
  for (const p of candidates) {
    const exists = existsSync(p);
    checked.push({ path: p, exists });
    console.log(`[letta-code] Checking: ${p} - ${exists ? "FOUND" : "NOT FOUND"}`);
    if (exists) return p;
  }

  const notFoundPaths = checked.filter(c => !c.exists).map(c => c.path);
  const errorMsg = `letta-code CLI not found at:\n  - ${notFoundPaths.join("\n  - ")}\n\n` +
    `Environment:\n  appPath: ${app.getAppPath()}\n  cwd: ${process.cwd()}\n  __dirname: ${__dirname}\n\n` +
    `Set LETTA_CODE_CLI_PATH to point at a custom letta.js, or run \`npm install\` to use the bundled @letta-ai/letta-code.`;
  console.error(`[letta-code] ${errorMsg}`);
  throw new Error(errorMsg);
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

    // Log spawn configuration for debugging
    const spawnEnv: Record<string, string | undefined> = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      LETTA_BASE_URL: `http://127.0.0.1:${opts.proxyPort}`,
      LETTA_API_KEY: opts.sessionToken,
      // Keep the CLI from trying to open a TTY; it should run headless.
      CI: "1",
    };
    // Layer caller-provided env on top of process.env. `undefined` values are
    // skipped so we don't shadow inherited vars with missing overrides.
    if (opts.extraEnv) {
      for (const [key, value] of Object.entries(opts.extraEnv)) {
        if (value !== undefined) spawnEnv[key] = value;
      }
    }

    console.log("[letta-code] Spawning process:");
    console.log(`[letta-code]   execPath: ${process.execPath}`);
    console.log(`[letta-code]   cliPath: ${cliPath}`);
    console.log(`[letta-code]   cwd: ${opts.cwd ?? process.cwd()}`);
    console.log(`[letta-code]   LETTA_BASE_URL: ${spawnEnv.LETTA_BASE_URL}`);
    console.log(`[letta-code]   ELECTRON_RUN_AS_NODE: ${spawnEnv.ELECTRON_RUN_AS_NODE}`);
    console.log(`[letta-code]   CI: ${spawnEnv.CI}`);
    console.log(`[letta-code]   LETTA_MEMFS_GIT_URL: ${process.env.LETTA_MEMFS_GIT_URL ?? "(unset)"}`);
    console.log(`[letta-code]   LETTA_MEMFS_GIT_TOKEN: ${process.env.LETTA_MEMFS_GIT_TOKEN ? "(set)" : "(unset)"}`);

    const child = spawn(process.execPath, [cliPath], {
      cwd: opts.cwd ?? process.cwd(),
      env: spawnEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.child = child;

    child.stdout?.on("data", (chunk: Buffer) => {
      const line = chunk.toString("utf-8").trim();
      console.log(`[letta-code:stdout] ${line}`);
      this.emit("log", { stream: "stdout", line });
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      const line = chunk.toString("utf-8").trim();
      console.error(`[letta-code:stderr] ${line}`);
      this.emit("log", { stream: "stderr", line });
    });

    child.on("spawn", () => {
      console.log(`[letta-code] Process spawned with PID ${child.pid}`);
      this.setState("running");
    });

    child.on("error", (err) => {
      console.error(`[letta-code] Spawn error: ${err.message}`, err);
      this.lastError = err.message;
      this.child = null;
      this.setState("crashed", { error: err.message });
    });

    child.on("exit", (code, signal) => {
      console.log(`[letta-code] Process exited (code=${code}, signal=${signal ?? "none"})`);
      const wasIntentional = this.intentionalStop;
      this.child = null;
      if (wasIntentional || code === 0) {
        this.setState("stopped", { exitCode: code, exitSignal: signal ?? null });
      } else {
        const errorMsg = `letta-code exited (code=${code}, signal=${signal ?? "none"})`;
        this.setState("crashed", {
          exitCode: code,
          exitSignal: signal ?? null,
          error: errorMsg,
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
