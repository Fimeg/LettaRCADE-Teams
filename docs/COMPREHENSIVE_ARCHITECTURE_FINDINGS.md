# Comprehensive Architecture Findings

**Date:** 2026-04-24  
**Analyst:** Claude Code (multi-subagent analysis)  
**Purpose:** Understanding the "Local Mode" architecture across Letta projects

---

## The Core Discovery

**The OSS UI's "Local Mode" is fundamentally broken** because it assumes letta-code exposes a WebSocket server. It does not.

**The Correct Pattern** (from letta-code-desktop-new):  
Spawn `@letta-ai/letta-code` CLI as a subprocess, set environment variables, and use an Express proxy to route traffic.

---

## The Three Projects Analyzed

| Project | Location | Type | Key Insight |
|---------|----------|------|-------------|
| **letta-code-desktop-16.2-old** | `/home/casey/Projects/letta-code-desktop-16.2-old` | Electron + embedded server | Spawns Letta server binary locally, uses HTTP SSE |
| **letta-code-desktop-new** | `/home/casey/Projects/letta-code-desktop-new` | Next.js + Electron + spawned CLI | **Spawns letta-code CLI as subprocess**, uses WebSocket + SSE hybrid |
| **letta-code (CLI)** | `/home/casey/Projects/letta-code` | CLI tool | Connects outbound to Letta API and platforms, **does NOT expose WebSocket server** |

---

## The Mental Model (Corrected)

**Server Mode** = "Brain in a jar" (external Letta server at URL)  
**Local Mode** = "Summon a Letta-Code instance as a channel into the adapter, choose endpoint based on network availability"

This aligns with how **letta-code-desktop-new** works.

---

## Architecture Comparison

### 1. Letta-Code-Desktop-16.2-Old (The Original)

**What it is:** Full Electron desktop with embedded Letta server

**Local Mode Implementation:**
- Spawns platform-specific binary (`letta.elf`, `letta`, `letta.exe`)
- Binary copied to `~/.letta/bin/`
- Server managed by main process (start/stop/restart)
- Uses HTTP SSE streaming (not WebSocket)
- Configuration stored in `~/.letta/desktop_config.json`

**Connection Modes:**
```typescript
type ConnectionMode =
  | { type: 'embedded', embeddedType: 'pgserver' | 'pglite' | 'sqlite' }
  | { type: 'external', connectionString: string }
  | { type: 'local', url: string, token?: string }
  | { type: 'cloud', token: string }
```

**Key Files:**
- `extracted-app/dist/main.js` - Electron main process with server management
- Binary at `~/.letta/bin/letta.elf` (copied from AppImage)
- Uses **port 8283** for API, **port 8285** for health check

**Streaming:** HTTP SSE (Server-Sent Events) via `/v1/agents/{id}/messages/stream`

---

### 2. Letta-Code (The CLI)

**What it is:** CLI tool with TUI, published as `@letta-ai/letta-code`

**Critical Finding:**
- **Does NOT expose a WebSocket server**
- Connects **outbound** to Letta API via HTTP
- Uses **HTTP SSE** for streaming
- Has "Channel Adapter" for connecting to Matrix/Slack/Telegram/Discord (connects as client)

**Connection Modes:**
- **Letta Cloud** (default): OAuth 2.0 to `https://api.letta.com`
- **Self-hosted**: `LETTA_BASE_URL` env var
- **Listen Mode**: WebSocket **client** (outbound to cloud)

**Key Insight:**
```javascript
// This is WRONG and will never work:
const ws = new WebSocket('ws://localhost:8283/ws');
// Because letta-code doesn't listen on any port!
```

**SDK Versions:**
- `@letta-ai/letta-client`: 1.10.1
- No separate letta-code-sdk - the CLI itself IS the SDK

**Key Files:**
- `src/index.ts` - Main CLI entry, TUI initialization
- `src/channels/registry.ts` - Channel registry (2595 lines)
- `src/agent/message.ts` - Agent streaming via SSE
- `src/websocket/listener/client.ts` - WebSocket listen mode (outbound only!)

---

### 3. Letta-Code-Desktop-New (The Modern Approach)

**What it is:** Next.js 15 + Electron 27, spawns letta-code CLI

**Critical Innovation:** This is the **correct pattern** for implementing local mode.

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                    │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Proxy Server │───▶│  Environment │───▶│   Listener   │  │
│  │   (Express)   │    │   Server     │    │  (letta-code)│  │
│  │  Port: random │    │  WS + HTTP   │    │   subprocess │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                    │          │
│    HTTP proxy           WebSocket          WebSocket        │
│    /v1/* routes        /v1/environments      (device)       │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   ┌──────────┐         ┌──────────┐          ┌──────────┐
   │  Letta   │         │   ADE    │          │  Local   │
   │   API    │         │  (UI)    │          │  Agent   │
   │ (Cloud)  │         │(Renderer)│          │ Process  │
   └──────────┘         └──────────┘          └──────────┘
```

**How Local Mode Works:**
1. **Spawns letta-code CLI** as Node.js subprocess:
   ```javascript
   const child = spawn('node', [
     './node_modules/@letta-ai/letta-code/letta.js'
   ], {
     env: {
       LETTA_BASE_URL: `http://localhost:${proxyPort}`,
       LETTA_API_KEY: sessionToken,
     }
   });
   ```

2. **Creates Express proxy server**:
   ```javascript
   app.use('/v1', createProxyMiddleware({
     target: 'https://api.letta.com',  // Or local server
     changeOrigin: true,
     headers: { 'Authorization': `Bearer ${token}` }
   }));
   ```

3. **Uses WebSocket internally** between main process and spawned CLI

4. **Uses SSE for SDK streaming** from Letta API

**Key Files:**
- `dist/main.js` - Electron main with proxy server, environment server, IPC
- `dist/preload.js` - IPC bridge
- Uses `@letta-ai/letta-client` v1.10.1
- Uses `@letta-ai/letta-code` v0.21.15

---

## The Problem with Current OSS UI

### What OSS UI Does (Wrong)
```typescript
// AgentWorkspace.tsx line 62
const [lettaCodeUrl, setLettaCodeUrl] = useState('ws://localhost:8283/ws');
```

**Why it fails:**
1. Port 8283 is the **REST API port**, not a WebSocket server
2. Letta-code **doesn't listen on any port** - it connects outbound
3. The WebSocket connection will never succeed

### What OSS UI Should Do (Correct)
Follow the **letta-code-desktop-new** pattern:

1. **Remove the broken WebSocket approach**
2. **Add Electron main process** that can spawn subprocesses
3. **Spawn letta-code CLI** with proper environment variables
4. **Create Express proxy** for routing and auth
5. **Use IPC** between renderer and main process

---

## Path Forward: Community ADE Architecture

### Option A: Standalone Channel (Matrix/Slack/etc)
Community ADE becomes its own channel adapter, like Matrix or Slack:
- Pros: Users can message agents from Community ADE interface
- Cons: Complex, requires protocol implementation

### Option B: Spawn Letta-Code (Recommended)
Community ADE spawns letta-code CLI as subprocess (like letta-code-desktop-new):
- Pros: 
  - Uses official Letta tooling
  - Automatic channel integration (Matrix, Slack, etc.)
  - Proper local mode support
  - Can choose endpoint based on network
- Cons: Requires Electron main process

### Option C: Hybrid
- Browser-only mode: Connect to external Letta server
- Desktop mode: Spawn letta-code CLI locally

---

## Key Implementation Files Needed

For implementing the correct pattern:

| File | Purpose |
|------|---------|
| `electron/main.ts` | Main process with proxy server, subprocess management |
| `electron/preload.ts` | IPC bridge exposing safe APIs to renderer |
| `src/services/proxy.ts` | Express proxy middleware for API routing |
| `src/services/lettaCodeManager.ts` | Spawn/manage letta-code subprocess |
| `src/hooks/useLettaCode.ts` | React hook for letta-code integration |

---

## SDK Versions to Use

```json
{
  "dependencies": {
    "@letta-ai/letta-client": "^1.10.3",
    "@letta-ai/letta-code": "^0.23.9"
  }
}
```

---

## Summary

**The OSS UI's current "local mode" is fundamentally broken** because it assumes letta-code is a WebSocket server.

**The correct approach** (proven in letta-code-desktop-new):
1. Spawn `@letta-ai/letta-code` CLI as subprocess
2. Set `LETTA_BASE_URL` to point to your proxy
3. Use Express proxy for routing to Letta API
4. Use WebSocket internally (main process ↔ CLI)
5. Use SSE for agent streaming

This creates the "channel into the adapter" - the spawned CLI connects through your proxy, which can route to local or cloud endpoints based on availability.

---

## Renamed Projects

| Old Name | New Name | Location |
|----------|----------|----------|
| `letta-code-new` | `letta-code-desktop-new` | `/home/casey/Projects/letta-code-desktop-new` |
| (AppImage extraction) | `letta-code-desktop-16.2-old` | `/home/casey/Projects/letta-code-desktop-16.2-old` |
| `letta-code` | `letta-code` (unchanged - this is the CLI) | `/home/casey/Projects/letta-code` |

---

## Document References

- `docs/letta-desktop-16.2-analysis.md` - Detailed 16.2 analysis
- `docs/letta-code-cli-analysis.md` - Detailed letta-code CLI analysis
- `docs/letta-code-desktop-new-analysis.md` - Detailed new desktop analysis
- This file - Synthesis and recommendations
