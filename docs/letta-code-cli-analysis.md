# Letta-Code CLI Analysis Report

**Date:** 2026-04-23
**Source:** `/home/casey/Projects/letta-code`
**Package:** `@letta-ai/letta-code` v0.23.9
**Analyst:** Claude Code Subagent

---

## Executive Summary

**Letta-Code is a CLI tool with TUI (Terminal User Interface), NOT a WebSocket server.** It connects **outbound** to Letta API and external platforms. The "channel adapter" connects to Matrix/Slack/Telegram/Discord as a client, not a server.

**Critical Finding:** The OSS UI's assumption that letta-code exposes a WebSocket server is incorrect.

---

## What is Letta-Code?

**Type:** CLI tool with interactive TUI, published as `@letta-ai/letta-code` on npm.

**Purpose:** A "memory-first coding harness" for interacting with stateful Letta agents from the terminal.

**User Interaction:**
```bash
# Interactive TUI mode
letta                    # Resume last conversation
letta --new             # Create new conversation
letta --agent <id>      # Open specific agent
letta -p "hello"        # Headless mode with JSON output

# Inside interactive session
/profile save MyAgent   # Save current agent as profile
/remember <text>        # Add to agent memory
/skill <instructions>   # Learn a skill
```

**Main Entry:** `/home/casey/Projects/letta-code/src/index.ts` (2246 lines)

---

## Channel Adapter - What Is It?

**The "Channel Adapter" is NOT a WebSocket server.** It is an **inbound adapter interface** that connects Letta agents to external messaging platforms.

**How it works:**
1. **Outbound connections:** CLI connects TO platforms (Matrix homeserver, Telegram HTTP long-polling, Slack Socket Mode, Discord Gateway)
2. **Routes messages:** Platform-specific chat IDs mapped to Letta agent+conversation pairs via routing tables
3. **Delivers to agent:** Messages formatted and sent through Letta API

**Adapter Interface** (`/home/casey/Projects/letta-code/src/channels/types.ts`):
```typescript
export interface ChannelAdapter {
  readonly id: string;
  readonly channelId?: SupportedChannelId;
  readonly name: string;
  
  start(): Promise<void>;           // Begin long-polling
  stop(): Promise<void>;
  isRunning(): boolean;
  
  sendMessage(msg: OutboundChannelMessage): Promise<{ messageId: string }>;
  
  onMessage?: (msg: InboundChannelMessage) => Promise<void>;
}
```

**Supported Platforms:**
- Matrix (with E2EE, voice, streaming)
- Slack (Socket Mode)
- Telegram (HTTP long-polling)
- Discord (Gateway)

**Key Files:**
- `src/channels/registry.ts` - ChannelRegistry singleton (2595 lines)
- `src/channels/matrix/adapter.ts` - Matrix adapter (2270 lines)

---

## Connection Modes

Letta-Code connects in **CLIENT mode**, not server mode:

| Mode | URL | How it works |
|------|-----|--------------|
| **Letta Cloud** (default) | `https://api.letta.com` | OAuth 2.0 Device Code Flow |
| **Self-hosted/Docker** | `LETTA_BASE_URL` env var | Direct API key authentication |
| **Listen Mode** | WebSocket to Letta Cloud | CLI acts as client receiving remote commands |

**Connection Code** (`src/agent/client.ts`):
```typescript
return new Letta({
  apiKey,
  baseURL,
  timeout: Number(process.env.LETTA_REQUEST_TIMEOUT_MS) || 10 * 60 * 1000,
  defaultHeaders: {
    "X-Letta-Source": "letta-code",
    "User-Agent": `letta-code/${packageJson.version}`,
  },
});
```

---

## WebSocket vs HTTP - How Streaming Actually Works

**NO exposed WebSocket server in normal operation.**

**Uses HTTP + Server-Sent Events (SSE):**
```javascript
// Streaming endpoint: POST /v1/conversations/{id}/messages
// With body: { stream: true, stream_tokens: true }
// Returns: Stream<LettaStreamingResponse>

const stream = client.conversations.messages.create(conversationId, {
  messages,
  stream: true,
  stream_tokens: true,
});
```

**WebSocket client (outbound) for "listen mode" only:**
- Connects TO Letta Cloud WebSocket as a client
- Receives commands to execute locally (remote control mode)
- File: `src/websocket/listener/client.ts`

---

## SDK Versions

From `package.json`:
```json
{
  "name": "@letta-ai/letta-code",
  "version": "0.23.9",
  "dependencies": {
    "@letta-ai/letta-client": "1.10.1",
    "ws": "^8.19.0"
  }
}
```

**SDK Usage:**
- Uses `@letta-ai/letta-client@1.10.1` (official Letta client SDK)
- No separate `@letta-ai/letta-code-sdk` - the CLI itself IS the SDK for headless mode
- Protocol types exported from `src/types/protocol.ts` for consumers

---

## Key Features & Architecture

### Session Management
- Stores `lastAgent` and `lastConversation` in:
  - Global: `~/.letta/settings.json`
  - Local: `.letta/settings.local.json` (project-specific)
- Channel routing in `.letta/routing.yaml`

### Tool Execution Flow
1. Agent sends tool call via SSE stream
2. CLI receives `ToolCallMessage`
3. User approval (if required) or auto-approval
4. Tool executes locally (file edit, bash command, etc.)
5. Result sent back via `ApprovalCreate` message

### Matrix-Specific Features (most advanced)
- E2EE via `matrix-js-sdk` with Rust crypto WASM
- Voice: STT (Faster-Whisper) + TTS (VibeVoice)
- Reaction-based approvals (👍👎✏️🎲)
- Live streaming edits via `m.replace`
- Thread context preservation

---

## Key Architectural Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main CLI entry, TUI initialization |
| `src/headless.ts` | Headless mode implementation |
| `src/channels/registry.ts` | Channel registry, routing, ingress pipeline |
| `src/channels/types.ts` | ChannelAdapter interface |
| `src/agent/message.ts` | Agent streaming via SSE |
| `src/agent/client.ts` | Letta SDK client initialization |
| `src/websocket/listener/client.ts` | WebSocket listen mode (outbound) |
| `src/types/protocol.ts` | Wire protocol types |

---

## Critical Finding: OSS UI Assumption vs Reality

**OSS UI Assumption:** Letta Code exposes a WebSocket server to connect to.

**Reality:**
- Letta Code is a **CLI client** that connects **outbound** to:
  1. Letta API (HTTP/SSE) for agent communication
  2. External platforms (Matrix/Slack/Telegram/Discord) via their protocols
  3. Letta Cloud WebSocket (listen mode, outbound connection)

- The CLI does NOT expose a WebSocket server for external connections
- It uses Server-Sent Events (HTTP streaming) for real-time agent communication
- Channel adapters are **inbound from platform perspective** but **outbound from CLI perspective**

---

## Implications for OSS UI

The OSS UI's current "local mode" implementation:
```typescript
// WRONG - This will never work
const [lettaCodeUrl, setLettaCodeUrl] = useState('ws://localhost:8283/ws');
```

**Why it fails:**
1. Port 8283 is the Letta REST API port, not a WebSocket server
2. Letta-code doesn't listen on any port
3. It connects outbound to `https://api.letta.com` or user-provided baseURL

**Correct approach (from letta-code-new):**
1. Spawn letta-code as a subprocess
2. Set `LETTA_BASE_URL` to point to your proxy/API
3. Use the SDK (`@letta-ai/letta-code`) for communication
4. Use WebSocket only for the "listen mode" (outbound to cloud)
