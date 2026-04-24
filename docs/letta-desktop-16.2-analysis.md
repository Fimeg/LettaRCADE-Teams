# Letta Desktop 0.16.2 AppImage Analysis Report

**Date:** 2026-04-23
**Source:** `/home/casey/Projects/AI/Letta-ADE/letta-desktop-0.16.2x86_64.AppImage`
**Analyst:** Claude Code Subagent

---

## Executive Summary

The Letta Desktop 0.16.2 AppImage is an Electron application with an embedded Letta server binary. Unlike the current OSS UI, it does NOT use WebSockets for local mode - instead it spawns the Letta server binary locally and uses HTTP streaming (SSE).

**Critical Finding:** The current OSS UI's "local mode" WebSocket implementation is fundamentally misaligned with how Letta actually works.

---

## Architecture Overview

### Electron Main Process
- **Entry:** `dist/main.js` (1592 lines, ~82KB)
- **Health Check:** Built-in HTTP server on port 8285
- **Server Management:** Spawns platform-specific Letta binary
  - Linux: `letta.elf`
  - macOS: `letta`
  - Windows: `letta.exe`

### Server Binary Management
```javascript
// Binary copied to: ~/.letta/bin/
// Migrations copied to: ~/.letta/migrations/
// Server args: [--use-file-pg-uri, --look-for-server-id=<id>, --no-generation]
```

### Configuration Schema (4 Connection Modes)

```typescript
// 1. Embedded Database (SQLite or embedded Postgres)
DesktopEmbeddedDatabaseSchema = {
  type: 'embedded',
  embeddedType: 'pgserver' | 'pglite' | 'sqlite'
}

// 2. External Database (user-provided Postgres)
DesktopExternalDatabaseSchema = {
  type: 'external',
  connectionString: string
}

// 3. Local Server Mode (connects to external Letta server)
LocalServerSchema = {
  type: 'local',
  url: string (URL),
  token?: string (optional)
}

// 4. Cloud Mode (connects to Letta Cloud)
CloudServerSchema = {
  type: 'cloud',
  token: string
}
```

**Note:** The "local" mode in 16.2 meant "connect to a locally running Letta server" (not letta-code!). The "embedded" mode actually spawned the server binary.

---

## Frontend Architecture

### Tech Stack
- **React 19.0.1** - UI framework
- **TanStack Query (React Query) 5.62.10** - Server state management
- **Axios & fetch** - HTTP clients
- **Zod** - Schema validation (1192 references)
- **ts-rest** - Type-safe REST API client
- **Jotai** - State management

### Hardcoded Endpoints
```javascript
// Baked into build:
OVERRIDE_WEB_ORIGIN_SDK_ENDPOINT: "http://localhost:8283"
LETTA_AGENTS_ENDPOINT: "http://localhost:8283/"
```

**URL Distribution:**
- `localhost:8283` - 15 references (primary API)
- `localhost:5000` - 59 references (likely MCP/tool server)
- `api.letta.com` - 1 reference
- `app.letta.com` - 3 references

---

## Communication Patterns

### IPC (Main <-> Renderer)

**Preload Script Exposes:**
```javascript
window.electron = {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  platform: process.platform,
  setToDashboardSize: () => ipcRenderer.invoke('set-to-dashboard-size')
}

window.desktopConfig = {
  get: () => ipcRenderer.invoke('desktop-config:get'),
  onGetConfig: (callback) => ipcRenderer.on('desktop-config:receive', callback),
  save: (config) => ipcRenderer.invoke('desktop-config:save', config)
}

window.lettaServer = {
  getLogs: () => ipcRenderer.invoke('letta-server:get-logs'),
  onGetLogs: (callback) => ipcRenderer.on('letta-server:receive-logs', callback),
  restart: () => ipcRenderer.invoke('letta-server:restart')
}

window.lettaConfig = {
  load: () => ipcRenderer.invoke('letta-config:load'),
  save: (config) => ipcRenderer.invoke('letta-config:save', config),
  onLoad: (callback) => ipcRenderer.on('letta-config:receive', callback)
}
```

---

## Critical Finding: NO WEBSOCKETS

**0 WebSocket/EventSource/socket.io references found!**

Instead uses **HTTP Streaming (SSE):**
```javascript
// Streaming endpoint: POST /v1/agents/{agentId}/messages/stream
// Headers: Accept: text/event-stream
// Body: JSON with stream_tokens: true, include_pings: true

const reader = response.body.getReader();
const decoder = new TextDecoder;
// Reads chunks, splits on \n, parses SSE-style data: messages
```

### Stream Recovery Mechanism
```javascript
// If network error during background run:
// 1. Check if run active: GET /v1/runs/{runId}
// 2. If active, attempt recovery: GET /v1/runs/{runId}/stream?starting_after={lastSeqId}
// 3. Resume streaming from last received sequence ID
```

### Run Monitoring (Polling-Based)
```javascript
// Active polling: every 5 seconds
// Inactive polling: every 15 seconds
// Endpoint: GET /v1/runs?agent_id={id}&limit=2&order=desc
```

---

## API Endpoints Discovered

```
GET    /health                           (health check)
GET    /agents                           (list agents)
POST   /agents                           (create agent)
GET    /agents/{id}                      (get agent)
DELETE /agents/{id}                      (delete agent)
GET    /agents/{id}/messages             (get messages)
POST   /agents/{id}/messages             (send message)
POST   /agents/{id}/messages/stream      (streaming - SSE)
POST   /agents/{id}/messages/cancel      (cancel run)
GET    /agents/{id}/core-memory          (core memory)
GET    /agents/{id}/core-memory/blocks   (memory blocks)
POST   /agents/{id}/files/{id}/open      (file open)
POST   /agents/{id}/files/{id}/close     (file close)
GET    /agents/{id}/runs                 (list runs)
GET    /runs/{id}                        (get run)
GET    /runs/{id}/stream                 (recovery stream)
GET    /conversations/{id}/messages      (conversation messages)
POST   /conversations/{id}/messages      (send to conversation)
GET    /admin/orgs/                      (orgs list)
GET    /admin/users/                     (users list)
```

---

## Web Workers

1. **agentRunManager.worker.js**
   - Message fetching with pagination
   - SSE streaming response parsing
   - Run monitoring and recovery
   - Error classification (network, rate limit, credits)

2. **pythonValidatorWorker.js**
   - Uses Pyodide (WASM Python) from CDN
   - Pydantic validation of Python code
   - Line number error mapping

3. **computeCoreMemorySummaryWorker.js**
   - Jinja2 templating via Pyodide
   - Memory block rendering

---

## File Structure

| File | Purpose |
|------|---------|
| `dist/main.js` | Electron main process - server management, IPC |
| `dist/main.preload.js` | Preload script - bridge between main and renderer |
| `dist/assets/index-DOk1B42u.js` | Frontend React app bundle (~13.8MB) |
| `~/.letta/desktop_config.json` | Desktop connection configuration |
| `~/.letta/env` | Letta server environment variables |
| `~/.letta/desktop.log` | Desktop app logs |
| `~/.letta/bin/letta.elf` | Copied Letta server binary |
| `~/.letta/migrations/` | Alembic database migrations |

---

## Key Differences from Current OSS UI

| Aspect | 16.2 Desktop | Current OSS UI |
|--------|-------------|----------------|
| **Architecture** | Full Electron with embedded server | React app only |
| **Local Mode** | Spawns Letta server binary locally | WebSocket (broken) |
| **Streaming** | HTTP SSE streaming | WebSocket (non-functional) |
| **Connection Modes** | 4 modes (embedded/external/local/cloud) | 2 modes (server/local) |
| **Server Management** | Main process spawns/controls server | None - external only |
| **State Management** | TanStack Query | Native Letta client + Zustand |
| **Monitoring** | Polling-based | None |
| **Stream Recovery** | Resume from sequence ID | None |

---

## What to Replicate

1. **Mode Selection UI** - Clean 4-mode selection (embedded/external/local/cloud)
2. **HTTP Streaming** - SSE-based streaming with recovery mechanisms
3. **Run Monitoring** - Polling-based with active/inactive intervals
4. **Configuration Persistence** - JSON file-based config storage
5. **IPC Bridge** - Clean API for config/server management
6. **Stream Recovery** - Resume from last sequence ID on network errors

---

## What to Avoid

1. **Hardcoded Endpoints** - Make API URL configurable at runtime
2. **Bundled Environment** - Don't bake env vars into build
3. **Single Port Assumption** - Allow custom ports
4. **Pyodide from CDN** - Bundle locally or make optional
5. **No WebSocket Fallback** - Use HTTP streaming instead

---

## Port Configuration

| Port | Purpose |
|------|---------|
| 8283 | Letta API server (primary) |
| 8285 | Electron health check server |
| 5000 | Likely MCP/tool server |

---

## Build Information

- **Version:** 0.16.2
- **tdBuildId:** 260114bm2mw9rzw
- **Product:** Letta Desktop
- **Built with:** ToDesktop (todesktop.com)
- **Update Server:** `https://download.todesktop.com/250121l7z0c6n`

---

## Recommendations for Current OSS UI

### Option A: Restore 16.2 Architecture (Full Desktop)
- Add Electron main process server management
- Spawn Letta server binary locally
- Use HTTP streaming (SSE) instead of WebSocket
- Implement 4-mode connection selector

### Option B: Simplify to Browser-Only
- Remove broken "local mode" WebSocket
- Keep server mode (connect to external Letta)
- Use HTTP streaming for messages
- No server management

### Option C: Hybrid (Letta-Code Integration)
- Use letta-code SDK for local sessions
- Spawn `letta-code` CLI for "local mode"
- Use SDK's `createSession()` and streaming
- No WebSocket needed

---

## Conclusion

The 16.2 Desktop was a full-featured Electron application with embedded server management. The current OSS UI's WebSocket-based "local mode" is fundamentally broken because it assumes letta-code exposes a WebSocket server (it doesn't - it's a CLI client that connects outbound to Letta Cloud).

**Key Takeaway:** The current OSS UI needs significant architectural changes to support true local mode, either by restoring the 16.2 "embedded server" approach or properly integrating with letta-code SDK.
