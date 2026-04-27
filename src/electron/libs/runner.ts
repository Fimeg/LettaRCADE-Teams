import {
  createSession,
  resumeSession,
  type Session as LettaSession,
  type SDKMessage,
  type CanUseToolResponse,
  type CanUseToolCallback,
  type SendMessage,
  type MessageContentItem,
} from "@letta-ai/letta-code-sdk";
import type { ServerEvent, SessionStatus } from "../types.js";
import type { PendingPermission } from "./runtime-state.js";

/**
 * Extract text content from SDK 0.1.14 message content.
 * Handles both string and MessageContentItem[] formats.
 */
function extractContentText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (content && typeof content === 'object' && 'text' in content) {
    return String((content as { text?: string }).text ?? '');
  }
  if (Array.isArray(content)) {
    return content
      .map((item: MessageContentItem) => {
        if (typeof item === 'string') return item;
        if (item.type === 'text') return item.text ?? '';
        return '';
      })
      .join('');
  }
  return '';
}

const DEFAULT_CWD = process.cwd();

/**
 * Manages persistent SDK Session instances keyed by conversation ID.
 *
 * The CLI subprocess is spawned on first session creation and stays alive
 * across multiple turns (send/stream cycles).  Each conversation gets its
 * own SDK Session, which maps to a letta-code CLI subprocess.
 */
export class SessionManager {
  private sessions = new Map<string, LettaSession>();
  private onEvent: (event: ServerEvent) => void;
  private canUseTool?: CanUseToolCallback;
  private permissionMode: "bypassPermissions" | "default";

  constructor(options: {
    onEvent: (event: ServerEvent) => void;
    canUseTool?: CanUseToolCallback;
    permissionMode?: "bypassPermissions" | "default";
  }) {
    this.onEvent = options.onEvent;
    this.canUseTool = options.canUseTool;
    this.permissionMode = options.permissionMode ?? "bypassPermissions";
  }

  /** Create a new conversation session on the given (or default) agent. */
  async create(agentId?: string): Promise<{ conversationId: string; agentId: string }> {
    const session = createSession(agentId, {
      permissionMode: this.permissionMode,
      canUseTool: this.canUseTool,
      cwd: DEFAULT_CWD,
      includePartialMessages: true,
    });

    // The SDK auto-initialises on first send; we call it explicitly here so
    // we can capture the conversationId before the UI sends messages.
    const init = await session.initialize();
    const conversationId = init.conversationId;

    this.sessions.set(conversationId, session);

    this.emitSessionStatus(conversationId, "running", { agentId: init.agentId });

    return { conversationId, agentId: init.agentId };
  }

  /** Ensure a session exists for an already-known conversation. */
  async ensure(conversationId: string): Promise<void> {
    if (this.sessions.has(conversationId)) return;

    const session = resumeSession(conversationId, {
      permissionMode: this.permissionMode,
      canUseTool: this.canUseTool,
      cwd: DEFAULT_CWD,
      includePartialMessages: true,
    });

    // resumeSession doesn't need an explicit initialize — it auto-inits
    // on the next send(). But we hold the reference so the session stays open.
    this.sessions.set(conversationId, session);
  }

  /** Send a message on an existing session and stream results via onEvent. */
  async send(conversationId: string, prompt: string): Promise<void> {
    const session = this.sessions.get(conversationId);
    if (!session) {
      throw new Error(`No session found for conversation: ${conversationId}`);
    }

    this.emitStreamUserPrompt(conversationId, prompt);

    // Convert to SDK SendMessage format
    const msg: SendMessage = [{ type: "text", text: prompt }];
    await session.send(msg);

    // Stream results
    for await (const message of session.stream()) {
      this.emitStreamMessage(conversationId, message);

      if (message.type === "result") {
        const status = message.success ? "completed" : "error";
        this.emitSessionStatus(conversationId, status, {
          error: message.error,
          agentId: session.agentId ?? undefined,
        });
        return;
      }
    }

    // Stream ended without a result message — likely interrupted
    this.emitSessionStatus(conversationId, "completed", {
      agentId: session.agentId ?? undefined,
    });
  }

  /** Abort the current turn without closing the session. */
  async abort(conversationId: string): Promise<void> {
    const session = this.sessions.get(conversationId);
    if (!session) return;

    await session.abort();
    this.emitSessionStatus(conversationId, "idle");
  }

  /** Close and remove a session. */
  async close(conversationId: string): Promise<void> {
    const session = this.sessions.get(conversationId);
    if (!session) return;

    session.close();
    this.sessions.delete(conversationId);
    this.emit({ type: "session.deleted", payload: { sessionId: conversationId } });
  }

  /** Close every tracked session. */
  closeAll(): void {
    for (const [id, session] of this.sessions) {
      session.close();
    }
    this.sessions.clear();
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private emit(event: ServerEvent): void {
    this.onEvent(event);
  }

  private emitSessionStatus(
    conversationId: string,
    status: SessionStatus,
    extras?: { agentId?: string; error?: string },
  ): void {
    this.emit({
      type: "session.status",
      payload: {
        sessionId: conversationId,
        status,
        title: conversationId,
        ...(extras?.agentId ? { agentId: extras.agentId } : {}),
        ...(extras?.error ? { error: extras.error } : {}),
      },
    });
  }

  private emitStreamUserPrompt(conversationId: string, prompt: string): void {
    this.emit({
      type: "stream.user_prompt",
      payload: { sessionId: conversationId, prompt },
    });
  }

  private emitStreamMessage(conversationId: string, message: SDKMessage): void {
    this.emit({
      type: "stream.message",
      payload: { sessionId: conversationId, message },
    });
  }
}
