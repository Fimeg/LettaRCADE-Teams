import { BrowserWindow } from "electron";
import type { ClientEvent, ServerEvent } from "./types.js";
import { runLetta, type RunnerHandle } from "./libs/runner.js";
import type { PendingPermission } from "./libs/runtime-state.js";
import {
  createRuntimeSession,
  getSession,
  updateSession,
  deleteSession,
} from "./libs/runtime-state.js";

// Track active runner handles
const runnerHandles = new Map<string, RunnerHandle>();

function broadcast(event: ServerEvent) {
  const payload = JSON.stringify(event);
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send("server-event", payload);
  }
}

function emit(event: ServerEvent) {
  // Update runtime state on status changes
  if (event.type === "session.status") {
    updateSession(event.payload.sessionId, { status: event.payload.status });
  }
  broadcast(event);
}

export async function handleClientEvent(event: ClientEvent) {
  if (event.type === "session.list") {
    // TODO: Implement listing via letta-client once we track agentId
    // For now, return empty - sessions are created via SDK
    emit({ type: "session.list", payload: { sessions: [] } });
    return;
  }

  if (event.type === "session.history") {
    // TODO: Implement history fetch via letta-client
    // For now, return empty - messages stream in real-time
    const conversationId = event.payload.sessionId;
    const status = getSession(conversationId)?.status || "idle";
    emit({
      type: "session.history",
      payload: { sessionId: conversationId, status, messages: [] },
    });
    return;
  }

  if (event.type === "session.start") {
    const pendingPermissions = new Map<string, PendingPermission>();

    try {
      let conversationId: string | null = null;
      let handle: RunnerHandle | null = null;
      
      handle = await runLetta({
        prompt: event.payload.prompt,
        session: {
          id: "pending",
          title: event.payload.title,
          status: "running",
          cwd: event.payload.cwd,
          pendingPermissions,
        },
        onEvent: (e) => {
          // Use conversationId for all events
          if (conversationId && "sessionId" in e.payload) {
            const payload = e.payload as { sessionId: string };
            payload.sessionId = conversationId;
          }
          emit(e);
        },
        onSessionUpdate: (updates) => {
          // Called when session is initialized with conversationId
          console.log("[DEBUG] onSessionUpdate called:", updates);
          if (updates.lettaConversationId && !conversationId) {
            conversationId = updates.lettaConversationId;
            
            createRuntimeSession(conversationId);
            updateSession(conversationId, { status: "running" });
            if (handle) runnerHandles.set(conversationId, handle);
            
            // Emit session.status to unblock UI - use conversationId as title
            emit({
              type: "session.status",
              payload: { sessionId: conversationId, status: "running", title: conversationId, cwd: event.payload.cwd },
            });
            console.log("[DEBUG] Emitting stream.user_prompt:", { sessionId: conversationId, prompt: event.payload.prompt });
            emit({
              type: "stream.user_prompt",
              payload: { sessionId: conversationId, prompt: event.payload.prompt },
            });
          }
        },
      });
    } catch (error) {
      console.error("Failed to start session:", error);
      emit({
        type: "runner.error",
        payload: { message: String(error) },
      });
    }
    return;
  }

  if (event.type === "session.continue") {
    const conversationId = event.payload.sessionId;
    let runtimeSession = getSession(conversationId);
    
    if (!runtimeSession) {
      runtimeSession = createRuntimeSession(conversationId);
    }

    updateSession(conversationId, { status: "running" });
    emit({
      type: "session.status",
      payload: { sessionId: conversationId, status: "running" },
    });

    emit({
      type: "stream.user_prompt",
      payload: { sessionId: conversationId, prompt: event.payload.prompt },
    });

    try {
      const handle = await runLetta({
        prompt: event.payload.prompt,
        session: {
          id: conversationId,
          title: conversationId,
          status: "running",
          cwd: event.payload.cwd,
          pendingPermissions: runtimeSession.pendingPermissions,
        },
        resumeConversationId: conversationId,
        onEvent: emit,
        onSessionUpdate: () => {},
      });
      runnerHandles.set(conversationId, handle);
    } catch (error) {
      updateSession(conversationId, { status: "error" });
      emit({
        type: "session.status",
        payload: { sessionId: conversationId, status: "error", error: String(error) },
      });
    }
    return;
  }

  if (event.type === "session.stop") {
    const conversationId = event.payload.sessionId;
    const handle = runnerHandles.get(conversationId);
    if (handle) {
      handle.abort();
      runnerHandles.delete(conversationId);
    }
    updateSession(conversationId, { status: "idle" });
    emit({
      type: "session.status",
      payload: { sessionId: conversationId, status: "idle" },
    });
    return;
  }

  if (event.type === "session.delete") {
    const conversationId = event.payload.sessionId;
    const handle = runnerHandles.get(conversationId);
    if (handle) {
      handle.abort();
      runnerHandles.delete(conversationId);
    }
    deleteSession(conversationId);
    
    // Note: Letta client may not have a delete method for conversations
    // The conversation will remain in Letta but be removed from our UI
    
    emit({ type: "session.deleted", payload: { sessionId: conversationId } });
    return;
  }

  if (event.type === "permission.response") {
    const session = getSession(event.payload.sessionId);
    if (!session) return;

    const pending = session.pendingPermissions.get(event.payload.toolUseId);
    if (pending) {
      pending.resolve(event.payload.result);
    }
    return;
  }
}

export function cleanupAllSessions(): void {
  for (const [, handle] of runnerHandles) {
    handle.abort();
  }
  runnerHandles.clear();
}
