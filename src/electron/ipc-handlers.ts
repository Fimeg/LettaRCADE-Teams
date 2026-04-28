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
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send("server-event", payload);
  }
}

// ── Tool Approval Resolver Map ────────────────────────────────────────
// When canUseTool fires, we broadcast a permission.request to the UI and
// store the resolve function. The UI responds with permission.response,
// which calls the stored resolver.
let toolUseIdCounter = 0;
const pendingResolvers = new Map<string, (response: CanUseToolResponse) => void>();

// ── Session Manager ─────────────────────────────────────────────────────────
const canUseTool: CanUseToolWithSession = async (conversationId, toolName, toolInput): Promise<CanUseToolResponse> => {
  // AskUserQuestion always requires runtime user input we can't surface yet
  if (toolName === "AskUserQuestion") {
    return { behavior: "deny", message: "AskUserQuestion not yet supported in the UI" };
  }

  const toolUseId = `tool-${++toolUseIdCounter}`;
  const sessionId = conversationId;

  return new Promise<CanUseToolResponse>((resolve) => {
    pendingResolvers.set(toolUseId, resolve);

    broadcast({
      type: "permission.request",
      payload: { sessionId, toolUseId, toolName, input: toolInput },
    });

    // Timeout: if the UI doesn't respond within 120s, deny automatically.
    setTimeout(() => {
      const resolver = pendingResolvers.get(toolUseId);
      if (resolver) {
        pendingResolvers.delete(toolUseId);
        resolver({ behavior: "deny", message: "Tool approval timed out" });
      }
    }, 120_000);
  });
};

const sessionManager = new SessionManager({
  onEvent: broadcast,
  canUseTool,
  // Don't use bypassPermissions — we want canUseTool to be called so the
  // UI can show an approval dialog for each tool.
  permissionMode: "default",
});

export async function handleClientEvent(event: ClientEvent) {
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
      const { conversationId } = await sessionManager.create(agentId);

      if (prompt) {
        await sessionManager.send(conversationId, prompt);
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
      await sessionManager.ensure(sessionId);
      await sessionManager.send(sessionId, prompt);
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
    await sessionManager.abort(sessionId);
    return;
  }

  // ── Delete (close session permanently) ──────────────────────────────────
  if (event.type === "session.delete") {
    const { sessionId } = event.payload;
    debug("session.delete", { sessionId });
    await sessionManager.close(sessionId);
    return;
  }

  // ── Permission response (tool approval from UI dialog) ───────────────────
  if (event.type === "permission.response") {
    const { sessionId, toolUseId, result } = event.payload;
    debug("permission.response", { sessionId, toolUseId, behavior: result.behavior });

    const resolver = pendingResolvers.get(toolUseId);
    if (resolver) {
      pendingResolvers.delete(toolUseId);
      resolver(result);
    } else {
      log("permission.response: no pending resolver for", { toolUseId });
    }
    return;
  }
}

export function cleanupAllSessions(): void {
  sessionManager.closeAll();
}
