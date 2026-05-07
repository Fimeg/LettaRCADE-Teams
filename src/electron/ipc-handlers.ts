import { BrowserWindow } from "electron";
import type { ClientEvent, ServerEvent } from "./types.js";
import { SessionManager } from "./libs/runner.js";
import type { CanUseToolResponse } from "@letta-ai/letta-code-sdk";
import type { CanUseToolWithSession } from "./libs/runner.js";

const DEBUG = process.env.DEBUG_IPC === "true";

const log = (msg: string, data?: Record<string, unknown>) => {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] [ipc] ${msg}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`[${timestamp}] [ipc] ${msg}`);
  }
};

const debug = (msg: string, data?: Record<string, unknown>) => {
  if (!DEBUG) return;
  log(msg, data);
};

function broadcast(event: ServerEvent) {
  const payload = JSON.stringify(event);
  // Log every broadcast to see what's being sent
  log(`BROADCAST type=${event.type}`, { payload: payload.length > 1000 ? payload.slice(0, 1000) + '...' : payload });
  const windows = BrowserWindow.getAllWindows();
  log(`BROADCAST sending to ${windows.length} windows`);
  for (const win of windows) {
    win.webContents.send("server-event", payload);
  }
}

// ── IPC Handlers ───────────────────────────────────────────────────────────
// Encapsulates session management in a class to avoid module-level mutable
// state (ETHOS anti-pattern). Instance is created at app startup.
export class IPCHandlers {
  private sessionManager: SessionManager;

  constructor() {
    this.sessionManager = new SessionManager({
      onEvent: broadcast,
      canUseTool: this.canUseTool.bind(this),
      // Don't use bypassPermissions — we want canUseTool to be called so the
      // UI can show an approval dialog for each tool.
      permissionMode: "default",
    });
  }

  private canUseTool: CanUseToolWithSession = async (conversationId, toolName, toolInput): Promise<CanUseToolResponse> => {
    // AskUserQuestion always requires runtime user input we can't surface yet
    if (toolName === "AskUserQuestion") {
      return { behavior: "deny", message: "AskUserQuestion not yet supported in the UI" };
    }

    const toolUseId = this.sessionManager.generateToolUseId();
    const sessionId = conversationId;

    return new Promise<CanUseToolResponse>((resolve) => {
      this.sessionManager.setPendingResolver(toolUseId, resolve);

      broadcast({
        type: "permission.request",
        payload: { sessionId, toolUseId, toolName, input: toolInput },
      });
    });
  };

  async handleClientEvent(event: ClientEvent) {
  debug(`handleClientEvent: ${event.type}`, { payload: "payload" in event ? event.payload : undefined });

  if (event.type === "session.list") {
    broadcast({ type: "session.list", payload: { sessions: [] } });
    return;
  }

  if (event.type === "session.history") {
    broadcast({
      type: "session.history",
      payload: { sessionId: event.payload.sessionId, status: "idle", messages: [] },
    });
    return;
  }

  // ── Start a new conversation on an agent ────────────────────────────────
  // The SessionManager creates a fresh SDK session (new CLI subprocess) and
  // sends the first user message.  The response streams back via stream.message
  // events.
  if (event.type === "session.start") {
    const { agentId, prompt, cwd } = event.payload;
    debug("session.start", { agentId, prompt: prompt?.slice(0, 50), cwd });

    try {
      const { conversationId } = await this.sessionManager.create(agentId);

      if (prompt) {
        await this.sessionManager.send(conversationId, prompt);
      }
    } catch (error) {
      log("session.start: ERROR", { error: String(error) });
      broadcast({
        type: "runner.error",
        payload: { message: String(error) },
      });
    }
    return;
  }

  // ── Continue an existing conversation ───────────────────────────────────
  if (event.type === "session.continue") {
    const { sessionId, prompt, cwd } = event.payload;
    debug("session.continue", { conversationId: sessionId, prompt: prompt?.slice(0, 50) });

    try {
      await this.sessionManager.ensure(sessionId);
      await this.sessionManager.send(sessionId, prompt);
    } catch (error) {
      log("session.continue: ERROR", { error: String(error) });
      broadcast({
        type: "session.status",
        payload: { sessionId, status: "error", error: String(error) },
      });
    }
    return;
  }

  // ── Stop (abort current turn, keep session alive) ───────────────────────
  if (event.type === "session.stop") {
    const { sessionId } = event.payload;
    debug("session.stop", { sessionId });

    // Deny any pending permission requests before aborting
    const pendingTools = this.sessionManager.getPendingToolUseIds();
    for (const toolUseId of pendingTools) {
      this.sessionManager.resolvePendingTool(toolUseId, {
        behavior: "deny",
        message: "Aborted by user"
      });
    }

    await this.sessionManager.abort(sessionId);
    return;
  }

  // ── Delete (close session permanently) ──────────────────────────────────
  if (event.type === "session.delete") {
    const { sessionId } = event.payload;
    debug("session.delete", { sessionId });
    await this.sessionManager.close(sessionId);
    return;
  }

  // ── Permission response (tool approval from UI dialog) ───────────────────
  if (event.type === "permission.response") {
    const { sessionId, toolUseId, result } = event.payload;
    debug("permission.response", { sessionId, toolUseId, behavior: result.behavior });

    const resolved = this.sessionManager.resolvePendingTool(toolUseId, result);
    if (!resolved) {
      log("permission.response: no pending resolver for", { toolUseId });
    }
    return;
  }
  }

  cleanupAllSessions(): void {
    this.sessionManager.closeAll();
  }
}
