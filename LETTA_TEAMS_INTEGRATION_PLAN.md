# Letta-Teams Integration Plan for Letta-OSS-UI

**Date:** 2026-04-24  
**Analyst:** Claude Code (Code Architect Subagent)  
**Purpose:** Complete implementation roadmap for integrating letta-teams into letta-oss-ui

---

## Executive Summary

This document provides a complete implementation roadmap for integrating `letta-teams` (CLI daemon-based agent team orchestration) into `letta-oss-ui` (React + Electron desktop app) as a dedicated "Teams" panel. The integration follows **Scenario C: Teams as a panel within letta-oss-ui**, allowing users to spawn specialized teammates, dispatch tasks, monitor execution, and run council sessions directly from the desktop interface.

**Key Architectural Decisions:**
1. **Daemon Management**: Electron main process spawns and supervises the letta-teams daemon as a child process
2. **IPC Bridge**: Custom IPC layer bridges Electron renderer <-> main process <-> TCP socket to daemon
3. **State Synchronization**: React state via Zustand syncs with daemon state through polling + push events
4. **UI Integration**: Teams as a top-level tab alongside Agents, Models, and Settings

---

## 1. Architecture Overview

### 1.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ELECTRON RENDERER PROCESS                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ Agents Tab  │  │ Models Tab  │  │ Settings    │  │  TEAMS TAB      │  │
│  │  (existing) │  │  (existing) │  │  (existing) │  │  (NEW)          │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│                    ┌─────────────────┐                                  │
│                    │   useTeamsStore │  Zustand store for teams state   │
│                    │   (NEW)         │                                  │
│                    └─────────────────┘                                  │
│                              │                                          │
│                              ▼                                          │
│                    ┌─────────────────┐                                  │
│                    │   useTeamsIPC   │  Teams-specific IPC hook        │
│                    │   (NEW)         │                                  │
│                    └─────────────────┘                                  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               │ IPC (renderer <-> main)
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         ELECTRON MAIN PROCESS                            │
│                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│  │  TeamsDaemon     │    │  IPC Handlers    │    │  LettaCode       │   │
│  │  Manager         │◄──►│  (teams-ipc)     │    │  Manager         │   │
│  │  (NEW)           │    │  (NEW)           │    │  (existing)      │   │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘   │
│           │                      │                                       │
│           │ spawn/manage         │ handle IPC                          │
│           ▼                      ▼                                       │
│    ┌──────────────┐     ┌──────────────┐                               │
│    │  TCP Socket  │◄────┤  ipcMain     │                               │
│    │  (port 9774) │     │  handlers    │                               │
│    └──────────────┘     └──────────────┘                               │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               │ TCP (127.0.0.1:9774)
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         LETTA-TEAMS DAEMON                               │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  Task Queue  │  │  Teammate     │  │  Council     │  │  Store      │ │
│  │  Manager     │  │  Manager      │  │  Orchestrator│  │  (.lteams)  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Hierarchy

```
App.tsx (modified)
├── Header
│   └── Tab Navigation (modified: add Teams tab)
├── Main Content
│   ├── AgentsBrowser (existing)
│   ├── AgentWorkspace (existing)
│   ├── ModelsView (existing)
│   ├── SettingsPanel (existing)
│   └── TeamsPanel (NEW)
│       ├── TeamsSidebar
│       │   ├── TeammateList
│       │   ├── TaskList
│       │   └── CouncilSessions
│       └── TeamsMain
│           ├── TeammateDetail
│           ├── TaskMonitor
│           ├── CouncilView
│           └── SpawnTeammateModal
├── StartSessionModal (existing)
├── AgentWizard (existing)
└── TeamsModals (NEW)
    ├── SpawnTeammateModal
    ├── DispatchTaskModal
    └── StartCouncilModal
```

---

## 2. Project Structure Changes

### 2.1 New Files to Create

| File | Path | Purpose |
|------|------|---------|
| `teams-daemon-manager.ts` | `src/electron/` | Manages daemon lifecycle (spawn, monitor, restart) |
| `teams-ipc.ts` | `src/electron/` | IPC handlers for teams operations |
| `teams-types.ts` | `src/electron/` | TypeScript types for IPC payloads |
| `useTeamsStore.ts` | `src/ui/store/` | Zustand store for teams state |
| `useTeamsIPC.ts` | `src/ui/hooks/` | IPC communication hook for teams |
| `TeamsPanel.tsx` | `src/ui/components/teams/` | Main teams panel container |
| `TeamsSidebar.tsx` | `src/ui/components/teams/` | Left sidebar with teammates/tasks |
| `TeammateCard.tsx` | `src/ui/components/teams/` | Individual teammate display |
| `TaskCard.tsx` | `src/ui/components/teams/` | Individual task display |
| `SpawnTeammateModal.tsx` | `src/ui/components/teams/` | Modal for spawning teammates |
| `DispatchTaskModal.tsx` | `src/ui/components/teams/` | Modal for dispatching tasks |
| `CouncilView.tsx` | `src/ui/components/teams/` | Council session display |
| `StartCouncilModal.tsx` | `src/ui/components/teams/` | Modal for starting council |
| `teams-api.ts` | `src/ui/services/` | API wrapper for teams operations |

### 2.2 Files to Modify

| File | Path | Changes |
|------|------|---------|
| `main.ts` | `src/electron/` | Initialize TeamsDaemonManager, register teams IPC |
| `preload.cts` | `src/electron/` | Expose teams IPC methods to renderer |
| `App.tsx` | `src/ui/` | Add Teams tab to navigation, include TeamsPanel |
| `useAppStore.ts` | `src/ui/store/` | Add `TopTab` type extension for 'teams' |
| `package.json` | Root | Add `letta-teams` as dependency |

---

## 3. Phase-by-Phase Implementation

### Phase 1: Daemon Management in Electron Main Process (Week 1)

**Goal**: Enable Electron to spawn, monitor, and communicate with the letta-teams daemon.

#### 3.1.1 Install Dependency

```bash
cd /home/casey/Projects/letta-oss-ui
npm install letta-teams
```

#### 3.1.2 Create Teams Daemon Manager (`src/electron/teams-daemon-manager.ts`)

```typescript
/**
 * TeamsDaemonManager - Manages the letta-teams daemon lifecycle
 * 
 * Responsibilities:
 * - Spawn daemon process on demand
 * - Monitor daemon health (PID file, TCP port)
 * - Auto-restart on crash
 * - Provide TCP socket interface for IPC
 */

import { spawn, ChildProcess } from "child_process";
import * as net from "node:net";
import * as fs from "node:fs";
import * as path from "node:path";
import { app } from "electron";
import { EventEmitter } from "events";

const DAEMON_PORT = 9774;
const DAEMON_PID_FILE = "daemon.pid";
const DAEMON_PORT_FILE = "daemon.port";
const DEFAULT_PROJECT_DIR = process.cwd();

export type DaemonStatus = 
  | "stopped" 
  | "starting" 
  | "running" 
  | "stopping" 
  | "crashed"
  | "port-conflict";

export interface DaemonStatusPayload {
  status: DaemonStatus;
  pid?: number;
  port: number;
  error?: string;
}

export class TeamsDaemonManager extends EventEmitter {
  private child: ChildProcess | null = null;
  private status: DaemonStatus = "stopped";
  private intentionalStop = false;
  private lastError?: string;
  private projectDir: string = DEFAULT_PROJECT_DIR;

  getStatus(): DaemonStatusPayload {
    return {
      status: this.status,
      pid: this.child?.pid,
      port: DAEMON_PORT,
      error: this.lastError,
    };
  }

  isRunning(): boolean {
    return this.status === "running" || this.status === "starting";
  }

  async start(projectDir?: string): Promise<boolean> {
    if (this.child) {
      throw new Error("Teams daemon is already running");
    }

    if (projectDir) {
      this.projectDir = projectDir;
    }

    // Check if port is already in use
    const portInUse = await this.checkPortInUse(DAEMON_PORT);
    if (portInUse) {
      // Try to connect to existing daemon
      const connected = await this.tryConnectToExisting();
      if (connected) {
        this.setState("running", { pid: undefined });
        return true;
      }
      this.setState("port-conflict", { 
        error: `Port ${DAEMON_PORT} is in use by another process` 
      });
      throw new Error(`Port ${DAEMON_PORT} is in use`);
    }

    this.intentionalStop = false;
    this.lastError = undefined;
    this.setState("starting");

    try {
      // Resolve path to letta-teams CLI
      const cliPath = this.resolveCliPath();
      
      // Open log file for daemon output
      const logDir = path.join(app.getPath("userData"), "letta-teams-logs");
      fs.mkdirSync(logDir, { recursive: true });
      const logPath = path.join(logDir, "daemon.log");
      const logFd = fs.openSync(logPath, "a");

      const child = spawn(process.execPath, [cliPath, "daemon", "--internal"], {
        cwd: this.projectDir,
        env: {
          ...process.env,
          LETTA_BASE_URL: process.env.LETTA_BASE_URL || "https://api.letta.com",
          LETTA_API_KEY: process.env.LETTA_API_KEY,
        },
        detached: true,
        stdio: ["ignore", logFd, logFd],
        windowsHide: true,
      });

      this.child = child;

      child.on("spawn", () => {
        console.log(`[teams-daemon] Spawned with PID ${child.pid}`);
        // Wait a moment for daemon to initialize, then verify
        setTimeout(() => this.verifyDaemonReady(), 2000);
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
          this.setState("stopped", { exitCode: code, exitSignal: signal });
        } else {
          this.setState("crashed", {
            exitCode: code,
            exitSignal: signal,
            error: `Daemon exited unexpectedly (code=${code}, signal=${signal})`,
          });
          
          // Auto-restart if not intentional stop
          if (!wasIntentional && code !== 0) {
            console.log("[teams-daemon] Auto-restarting in 3s...");
            setTimeout(() => this.start(), 3000);
          }
        }
      });

      return true;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.setState("crashed", { error: this.lastError });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.child) return;
    
    this.intentionalStop = true;
    this.setState("stopping");

    // Send stop command via TCP first (graceful shutdown)
    try {
      await this.sendDaemonCommand({ type: "stop" }, 5000);
    } catch {
      // Ignore - daemon may not be responding
    }

    // Kill process if still running
    const child = this.child;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
      }, 3000);

      child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });

      child.kill("SIGTERM");
    });
  }

  async sendCommand<T = unknown>(
    command: Record<string, unknown>, 
    timeoutMs = 30000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let buffer = "";
      let resolved = false;

      const cleanup = () => {
        clearTimeout(timeoutId);
        socket.destroy();
      };

      socket.connect(DAEMON_PORT, "127.0.0.1", () => {
        socket.write(JSON.stringify(command) + "\n");
      });

      socket.on("data", (data) => {
        buffer += data.toString();
        if (buffer.includes("\n")) {
          if (resolved) return;
          resolved = true;
          try {
            const response = JSON.parse(buffer.trim());
            cleanup();
            resolve(response as T);
          } catch (error) {
            cleanup();
            reject(new Error("Invalid response from daemon"));
          }
        }
      });

      socket.on("error", (err) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        reject(new Error(`Daemon connection failed: ${err.message}`));
      });

      socket.on("close", () => {
        if (resolved) return;
        if (buffer) {
          try {
            const response = JSON.parse(buffer.trim());
            resolved = true;
            cleanup();
            resolve(response as T);
          } catch {
            resolved = true;
            cleanup();
            reject(new Error("Connection closed without response"));
          }
        }
      });

      const timeoutId = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        cleanup();
        reject(new Error("Timeout waiting for daemon response"));
      }, timeoutMs);
    });
  }

  private async verifyDaemonReady(): Promise<void> {
    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const connected = await this.checkPortInUse(DAEMON_PORT);
        if (connected) {
          this.setState("running", { pid: this.child?.pid });
          return;
        }
      } catch {
        // Continue waiting
      }
      await new Promise(r => setTimeout(r, 500));
    }
    this.setState("crashed", { error: "Daemon failed to start within timeout" });
  }

  private async checkPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(500);
      
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.once("error", () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.connect(port, "127.0.0.1");
    });
  }

  private async tryConnectToExisting(): Promise<boolean> {
    try {
      const response = await this.sendCommand({ type: "list" }, 2000);
      return response !== null;
    } catch {
      return false;
    }
  }

  private resolveCliPath(): string {
    // Find letta-teams CLI in node_modules
    const candidates = [
      path.join(app.getAppPath(), "node_modules", "letta-teams", "dist", "cli.js"),
      path.join(process.cwd(), "node_modules", "letta-teams", "dist", "cli.js"),
      path.join(__dirname, "..", "..", "node_modules", "letta-teams", "dist", "cli.js"),
    ];
    
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    
    throw new Error(`letta-teams CLI not found. Searched:\n${candidates.join("\n")}`);
  }

  private setState(
    status: DaemonStatus,
    extras: Partial<DaemonStatusPayload> = {}
  ): void {
    this.status = status;
    const payload: DaemonStatusPayload = {
      status,
      pid: this.child?.pid,
      port: DAEMON_PORT,
      ...extras,
    };
    this.emit("status", payload);
  }
}

// Singleton instance
export const teamsDaemon = new TeamsDaemonManager();
```

#### 3.1.3 Create Teams IPC Types (`src/electron/teams-types.ts`)

```typescript
/**
 * Type definitions for teams IPC communication
 */

// Re-export from letta-teams types where possible
export type {
  TeammateState,
  TaskState,
  TaskStatus,
  TeammateStatus,
  TodoItem,
  CouncilSessionMeta,
} from "letta-teams";

// IPC Request/Response types
export interface TeamsIPCRequest {
  // Daemon management
  "teams:daemon:start": { projectDir?: string };
  "teams:daemon:stop": void;
  "teams:daemon:status": void;
  
  // Teammate operations
  "teams:teammate:list": void;
  "teams:teammate:spawn": {
    name: string;
    role: string;
    model?: string;
    contextWindowLimit?: number;
    spawnPrompt?: string;
    skipInit?: boolean;
    memfsEnabled?: boolean;
    memfsStartup?: "blocking" | "background" | "skip";
  };
  "teams:teammate:kill": { name: string };
  "teams:teammate:fork": { rootName: string; forkName: string };
  "teams:teammate:reinit": { rootName: string; prompt?: string };
  
  // Task operations
  "teams:task:list": void;
  "teams:task:status": { taskId: string };
  "teams:task:dispatch": {
    targetName: string;
    message: string;
    pipelineId?: string;
    review?: {
      reviewer: string;
      gate: "on_success" | "always";
      template?: string;
      assignments: { name: string; message: string }[];
    };
  };
  
  // Council operations
  "teams:council:start": {
    prompt: string;
    message?: string;
    participantNames?: string[];
    maxTurns?: number;
  };
  "teams:council:status": { sessionId: string };
}

export interface TeamsIPCResponse {
  "teams:daemon:start": { success: boolean; error?: string };
  "teams:daemon:stop": { success: boolean };
  "teams:daemon:status": {
    status: "stopped" | "starting" | "running" | "stopping" | "crashed" | "port-conflict";
    pid?: number;
    port: number;
    error?: string;
  };
  "teams:teammate:list": { teammates: TeammateState[] };
  "teams:teammate:spawn": { teammate: TeammateState };
  "teams:teammate:kill": { name: string; cancelled: number };
  "teams:teammate:fork": { teammate: TeammateState };
  "teams:teammate:reinit": { taskId: string };
  "teams:task:list": { tasks: TaskState[] };
  "teams:task:status": { task: TaskState | null };
  "teams:task:dispatch": { taskId: string };
  "teams:council:start": { sessionId: string };
  "teams:council:status": { session: CouncilSessionMeta | null };
}
```

#### 3.1.4 Create Teams IPC Handlers (`src/electron/teams-ipc.ts`)

```typescript
/**
 * Teams IPC handlers - bridges Electron IPC to TCP daemon communication
 */

import { ipcMain } from "electron";
import { teamsDaemon } from "./teams-daemon-manager.js";
import type { TeamsIPCRequest, TeamsIPCResponse } from "./teams-types.js";

// Type-safe IPC handler registration
export function registerTeamsIPC(): void {
  // Daemon management
  ipcMain.handle("teams:daemon:start", async (_event, req: TeamsIPCRequest["teams:daemon:start"]) => {
    try {
      const success = await teamsDaemon.start(req?.projectDir);
      return { success } as TeamsIPCResponse["teams:daemon:start"];
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      } as TeamsIPCResponse["teams:daemon:start"];
    }
  });

  ipcMain.handle("teams:daemon:stop", async () => {
    await teamsDaemon.stop();
    return { success: true } as TeamsIPCResponse["teams:daemon:stop"];
  });

  ipcMain.handle("teams:daemon:status", () => {
    return teamsDaemon.getStatus() as TeamsIPCResponse["teams:daemon:status"];
  });

  // Teammate operations
  ipcMain.handle("teams:teammate:list", async () => {
    const response = await teamsDaemon.sendCommand({ type: "list" });
    // Parse and return teammates from tasks or make dedicated call
    return { teammates: [] } as TeamsIPCResponse["teams:teammate:list"]; // Placeholder
  });

  ipcMain.handle("teams:teammate:spawn", async (_event, req: TeamsIPCRequest["teams:teammate:spawn"]) => {
    const response = await teamsDaemon.sendCommand({
      type: "spawn",
      ...req,
      projectDir: process.cwd(),
    });
    return { teammate: response } as TeamsIPCResponse["teams:teammate:spawn"];
  });

  ipcMain.handle("teams:teammate:kill", async (_event, req: TeamsIPCRequest["teams:teammate:kill"]) => {
    const response = await teamsDaemon.sendCommand({
      type: "kill",
      ...req,
      projectDir: process.cwd(),
    });
    return response as TeamsIPCResponse["teams:teammate:kill"];
  });

  // Task operations
  ipcMain.handle("teams:task:list", async () => {
    const response = await teamsDaemon.sendCommand({
      type: "list",
      projectDir: process.cwd(),
    });
    return { tasks: response.tasks || [] } as TeamsIPCResponse["teams:task:list"];
  });

  ipcMain.handle("teams:task:dispatch", async (_event, req: TeamsIPCRequest["teams:task:dispatch"]) => {
    const response = await teamsDaemon.sendCommand({
      type: "dispatch",
      ...req,
      projectDir: process.cwd(),
    });
    return { taskId: response.taskId } as TeamsIPCResponse["teams:task:dispatch"];
  });

  // Council operations
  ipcMain.handle("teams:council:start", async (_event, req: TeamsIPCRequest["teams:council:start"]) => {
    const response = await teamsDaemon.sendCommand({
      type: "council_start",
      ...req,
      projectDir: process.cwd(),
    });
    return { sessionId: response.sessionId } as TeamsIPCResponse["teams:council:start"];
  });
}
```

#### 3.1.5 Modify Main Process (`src/electron/main.ts`)

Add to imports:
```typescript
import { teamsDaemon } from "./teams-daemon-manager.js";
import { registerTeamsIPC } from "./teams-ipc.js";
```

Add to `app.on("ready", ...)`:
```typescript
// Register teams IPC handlers
registerTeamsIPC();

// Broadcast daemon status changes to renderer
teamsDaemon.on("status", (payload) => {
    mainWindow?.webContents.send("teams:daemon:status", payload);
});

// Auto-start daemon if configured
if (appConfig.autoStartTeamsDaemon !== false) {
    teamsDaemon.start().catch((err) => {
        console.error("[teams] Auto-start failed:", err);
    });
}
```

Add to cleanup():
```typescript
teamsDaemon.stop().catch(() => {});
```

#### 3.1.6 Modify Preload Script (`src/electron/preload.cts`)

Add to `window.electron` object:
```typescript
// Teams IPC APIs
teams: {
    daemon: {
        start: (opts?: { projectDir?: string }) => 
            ipcInvoke("teams:daemon:start", opts),
        stop: () => 
            ipcInvoke("teams:daemon:stop"),
        getStatus: () => 
            ipcInvoke("teams:daemon:status"),
        onStatus: (callback: (payload: any) => void) => {
            const cb = (_: any, payload: any) => callback(payload);
            electron.ipcRenderer.on("teams:daemon:status", cb);
            return () => electron.ipcRenderer.off("teams:daemon:status", cb);
        },
    },
    teammate: {
        list: () => ipcInvoke("teams:teammate:list"),
        spawn: (opts: any) => ipcInvoke("teams:teammate:spawn", opts),
        kill: (opts: { name: string }) => ipcInvoke("teams:teammate:kill", opts),
        fork: (opts: { rootName: string; forkName: string }) => 
            ipcInvoke("teams:teammate:fork", opts),
        reinit: (opts: { rootName: string; prompt?: string }) => 
            ipcInvoke("teams:teammate:reinit", opts),
    },
    task: {
        list: () => ipcInvoke("teams:task:list"),
        dispatch: (opts: any) => ipcInvoke("teams:task:dispatch", opts),
        status: (opts: { taskId: string }) => ipcInvoke("teams:task:status", opts),
    },
    council: {
        start: (opts: any) => ipcInvoke("teams:council:start", opts),
        status: (opts: { sessionId: string }) => ipcInvoke("teams:council:status", opts),
    },
},
```

### Phase 2-5 Summary

- **Phase 2**: Basic Teams Panel with spawn functionality
- **Phase 3**: Task monitoring with real-time updates
- **Phase 4**: Council/deliberation UI
- **Phase 5**: Advanced features (workflows, visualization)

---

## 4. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| SDK version mismatch (1.7.11 vs 1.10.3) | Medium | Update letta-teams to use 1.10.3 |
| Port 9774 conflict | Medium | Check/connect to existing, kill if unresponsive |
| State sync drift | Low | Polling fallback, manual refresh, focus-sync |
| Bundling issues | Low | Add to electron-builder files array |

---

## 5. Timeline

| Week | Phase | Key Deliverables |
|------|-------|-----------------|
| 1 | Daemon Management | TeamsDaemonManager, IPC handlers, daemon lifecycle |
| 2 | Basic UI | Store, sidebar, spawn modal, App.tsx integration |
| 3 | Task Monitoring | Task cards, monitor view, polling |
| 4 | Council UI | Council view, start modal, session tracking |
| 5-6 | Advanced & QA | Workflows, visualization, bug fixes |

---

## 6. Conclusion

This integration provides a unified desktop experience where users can:
- Spawn specialized teammates
- Dispatch tasks and monitor execution
- Run multi-agent council sessions
- All from within the Letta OSS UI

The architecture is sound, the patterns are established in letta-code-desktop-new, and the implementation is achievable in 4-6 weeks.
