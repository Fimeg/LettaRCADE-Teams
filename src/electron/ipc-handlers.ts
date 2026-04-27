import { BrowserWindow } from "electron";
import type { ClientEvent, ServerEvent } from "./types.js";
import { SessionManager } from "./libs/runner.js";
import type { CanUseToolResponse } from "@letta-ai/letta-code-sdk";

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

// ── Session Manager ─────────────────────────────────────────────────────────
// Persistent SDK sessions keyed by conversation ID.  The CLI subprocess stays
// alive across send/stream cycles so the tool harness (bash, read, write, etc.)
// remains available for every turn.
//
// When canUseTool is provided, it is called for every tool the agent invokes.
// Return { behavior: "allow" } to auto-approve, { behavior: "deny", message }
// to reject.  AskUserQuestion always requires user input (so it prompts even
// in bypassPermissions mode).
const canUseTool = async (toolName: string, input: unknown): Promise<CanUseToolResponse> => {
  // For now, auto-allow everything.  The UI can surface approval dialogs by
  // emitting permission.request events and resolving via permission.response.
  if (toolName === "AskUserQuestion") {
    // Future: emit permission.request and wait for response
    return { behavior: "deny", message: "AskUserQuestion not yet supported in the UI" };
  }
  return { behavior: "allow" };
};

const sessionManager = new SessionManager({
  onEvent: broadcast,
  canUseTool,
  permissionMode: "bypassPermissions",
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

  // ── Permission response (future: tool approval UI) ──────────────────────
  if (event.type === "permission.response") {
    // PendingPermission handling is managed inside SessionManager's canUseTool
    // callback.  When a tool approval dialog is surfaced, the UI responds here.
    debug("permission.response", event.payload);
    return;
  }
}

export function cleanupAllSessions(): void {
  sessionManager.closeAll();
}
