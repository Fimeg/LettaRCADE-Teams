# Letta-Code-Desktop-New Analysis Report

**Date:** 2026-04-23
**Source:** `/home/casey/Projects/letta-code-new`
**Framework:** Next.js 15.5.8 + Electron 27.0.0
**Analyst:** Claude Code Subagent

---

## Executive Summary

This is the **modern Letta Desktop** application using Next.js + Electron. It spawns `letta-code` CLI as a subprocess and uses an **Express proxy server** for API routing. Uses **WebSocket + SSE hybrid** for streaming.

**Key Innovation:** Spawns `@letta-ai/letta-code` package as subprocess with environment variables, creating a proper "local mode" that actually works.

---

## Architecture Overview

### Tech Stack
- **Framework:** Next.js 15.5.8 with React 19.0.1
- **Desktop Shell:** Electron 27.0.0 (packaged as AppImage)
- **Build:** Vite (dev server on port 4201)
- **State:** TanStack Query 5.62.10 + Jotai
- **API Client:** `@letta-ai/letta-client` v1.10.1 + ts-rest

### Project Structure
```
/home/casey/Projects/letta-code-new/
├── dist/
│   ├── main.js              # Electron main process (bundled)
│   ├── preload.js           # Electron preload script
│   ├── index.html           # Next.js output
│   └── package.json         # Runtime dependencies
├── node_modules/
│   └── @letta-ai/
│       ├── letta-client/    # API client SDK v1.10.1
│       └── letta-code/      # CLI SDK v0.21.15
└── assets/                  # Static assets
```

---

## Connection Architecture (Three-Tier)

### 1. Local Mode (Development)
- WebSocket and HTTP bound to `localhost:4201`
- Vite dev server with hot reload
- Origin validation for `http://localhost:*`

### 2. Desktop/Local Server Mode
- Express server bound to `127.0.0.1` with **random port**
- Local-only security: rejects non-localhost requests with 403
- WebSocket upgrades validated against `LOCALHOST_IPS`

### 3. Cloud Mode
- OAuth device flow authentication
- Hardcoded endpoints:
  - `https://app.letta.com/api/oauth/device/code`
  - `https://app.letta.com/api/oauth/token`
  - `https://app.letta.com/api/oauth/revoke`

### Connection Flow Diagram
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

---

## Streaming Implementation (Hybrid)

### Protocol: WebSocket + SSE

**Server-to-Client (UI):** WebSocket via `/v1/environments/:id/ws`

**SDK Streaming:** HTTP SSE for agent runs

### WebSocket Protocol (Main Process)

**Device WebSocket** (letta-code → main process):
- Handles device registration, message forwarding, ping/pong
- Message types:
  - `stream_delta` - Streaming content chunks
  - `forward` - Forwardable commands
  - `pong` - Heartbeat responses

**Status WebSocket** (ADE UI → main process):
- Subscribes to run updates
- Parks subscribers when no device connected
- Reopens when device attaches

### SSE Streaming (SDK Level)

```javascript
// SSE decoding from @letta-ai/letta-client
class SSEDecoder {
    decode(line) {
        if (line.startsWith('event:')) {
            this.event = value;
        } else if (line.startsWith('data:')) {
            this.data.push(value);
        }
    }
}

// Stream class provides async iteration
class Stream {
    static fromSSEResponse(response, controller, client) {
        // Parses SSE stream into async iterable
    }
}
```

---

## Server Management

### Express Proxy Server

**File:** `dist/main.js` lines 1684-1865

**Features:**
- Proxy middleware for `/v1`, `/api`, `/v1/git` routes
- Per-session token authentication
- Routes:
  - `/v1/*` → Letta API with Bearer token
  - `/v1/git` → Git proxy with Basic auth
  - `/v1/environments/*` → Local environment management

### Environment Server

**File:** `dist/main.js` lines 113-750

**Features:**
- Express router for `/v1/environments`
- WebSocket server attached to HTTP server
- Connection registry with heartbeats
- Session token validation

### Subprocess Management (Critical!)

**Spawns Letta-Code CLI subprocess:**

```javascript
// From dist/main.js
// Spawns letta.js from @letta-ai/letta-code package
const lettaCodeProcess = spawn('node', [
  path.join(__dirname, 'node_modules/@letta-ai/letta-code/letta.js')
], {
  env: {
    ...process.env,
    LETTA_BASE_URL: `http://localhost:${proxyPort}`,
    LETTA_API_KEY: sessionToken,
    // ... other env vars
  }
});

// Auto-restart on crash with exponential backoff
// Crash window: 5 crashes in 60 seconds = stop restarting
```

**This is how "local mode" actually works!**

---

## IPC (Inter-Process Communication)

### Preload Script

**File:** `dist/preload.js`

```javascript
contextBridge.exposeInMainWorld('electronAPI', {
    // OAuth
    openOAuthBrowser: (url) => ipcRenderer.invoke('open-oauth-browser', url),
    startDeviceAuth: () => ipcRenderer.invoke('start-device-auth'),
    
    // Listener management
    getListenerStatus: () => ipcRenderer.invoke('get-listener-status'),
    toggleListener: () => ipcRenderer.invoke('toggle-listener'),
    forceRestartListener: () => ipcRenderer.invoke('force-restart-listener'),
    
    // Terminal
    terminalSpawn: (id, cols, rows, cwd) => ipcRenderer.invoke('terminal-spawn', ...),
    terminalInput: (id, data) => ipcRenderer.invoke('terminal-input', id, data),
    
    // Filesystem
    fsReadDirectory: (path) => ipcRenderer.invoke('fs-read-directory', path),
    fsReadFile: (path) => ipcRenderer.invoke('fs-read-file', path),
    
    // Logs
    onLogEntry: (callback) => ipcRenderer.on('log-entry', callback),
    getLogHistory: () => ipcRenderer.invoke('get-log-history'),
});
```

---

## SDK Usage

### Letta Client SDK (`@letta-ai/letta-client` v1.10.1)

**Initialization:**
```javascript
class Letta {
    constructor(options) {
        // baseURL from LETTA_BASE_URL env or options
        // Environment selection (local/cloud)
    }
    
    // Resources:
    agents: Agents;
    messages: Messages;
    runs: Runs;
    tools: Tools;
}
```

**Streaming:**
```javascript
const stream = Stream.fromSSEResponse(response, controller, client);
for await (const chunk of stream) {
    // Handle chunk
}
```

### Letta Code SDK (`@letta-ai/letta-code` v0.21.15)

**Key Insight:** The letta-code package is both:
1. A CLI tool (`letta.js` entry point)
2. A library that can be spawned as subprocess

**Spawning:**
```javascript
// Spawn as subprocess with proper environment
const child = spawn('node', [pathToLettaJs], {
  env: {
    LETTA_BASE_URL: 'http://localhost:' + proxyPort,
    LETTA_API_KEY: sessionToken,
  }
});
```

---

## Key Improvements Over 16.2

| Aspect | Old (16.2) | New (letta-code-desktop-new) |
|--------|-----------|------------------------------|
| **Framework** | React app in static HTML | Next.js 15 with SSR |
| **State** | Likely Redux/MobX | TanStack Query + Jotai |
| **API Client** | Custom fetch | `@letta-ai/letta-client` |
| **Desktop** | Likely Tauri | Electron 27 |
| **Streaming** | Direct WebSocket | WebSocket + SSE hybrid |
| **Server** | Built-in Rust | Express proxy |
| **CLI Integration** | Channel adapter pattern | Native `@letta-ai/letta-code` |
| **Build** | Unknown | Vite + webpack |

---

## Hardcoded URLs

**OAuth/Cloud:**
- `https://app.letta.com/api/oauth/device/code`
- `https://app.letta.com/api/oauth/token`
- `https://app.letta.com/api/oauth/revoke`

**Local Development:**
- `http://localhost:4201` - Vite dev server
- `http://127.0.0.1:${randomPort}` - Express proxy

**API Routes (proxied):**
- `/v1/*` → Letta API
- `/v1/git` → Git service
- `/api` → Additional API
- `/v1/environments/*` → Local environment

---

## Critical Pattern: How "Local Mode" Actually Works

The key insight from this analysis:

1. **Does NOT assume** letta-code exposes a WebSocket server
2. **Spawns letta-code** as a subprocess via Node.js spawn
3. **Sets environment variables** (`LETTA_BASE_URL`, `LETTA_API_KEY`)
4. **Creates Express proxy** that routes to Letta API with auth
5. **Uses WebSocket internally** between main process and spawned CLI
6. **Uses SSE for SDK streaming** from Letta API

This is the correct pattern for implementing "local mode" - spawn the CLI tool and communicate via its native protocols, not via a non-existent WebSocket server.

---

## Files Summary

| File | Purpose |
|------|---------|
| `dist/main.js` | Electron main - proxy server, environment server, IPC |
| `dist/preload.js` | IPC bridge exposing `window.electronAPI` |
| `node_modules/@letta-ai/letta-client/` | Letta API client SDK |
| `node_modules/@letta-ai/letta-code/` | CLI SDK for spawning |
| `node_modules/@letta-ai/letta-code/letta.js` | CLI entry point |
