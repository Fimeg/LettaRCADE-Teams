# Electron App Analysis - letta-oss-ui

**Date:** 2026-04-23  
**SDK Version:** @letta-ai/letta-code-sdk ^0.0.5  
**Target:** SDK 0.1.14 overhaul planning

---

## 1. Main Process Architecture

### Entry Point: `main.ts`

```
┌─────────────────────────────────────────────────────────────────┐
│                         main.ts                                  │
├─────────────────────────────────────────────────────────────────┤
│ 1. Load .env configuration                                       │
│    - LETTA_BASE_URL (defaults to https://api.letta.com)         │
│    - LETTA_API_KEY (auto-set to "local-dev-key" for localhost)  │
│                                                                  │
│ 2. Detect letta CLI path via `which letta`                      │
│    - Stored in process.env.LETTA_CLI_PATH                       │
│                                                                  │
│ 3. Create BrowserWindow (1200x800)                              │
│    - preload: getPreloadPath()                                  │
│    - Dev: loadURL(http://localhost:5173)                        │
│    - Prod: loadFile(dist-react/index.html)                      │
│                                                                  │
│ 4. Setup IPC handlers                                           │
│    - getStaticData → test.ts                                    │
│    - client-event → ipc-handlers.ts                             │
│    - get-recent-cwds → returns [process.cwd()]                  │
│    - select-directory → dialog.showOpenDialog                   │
│                                                                  │
│ 5. Resource polling (test.ts) every 500ms                       │
│    - CPU usage, RAM usage, Storage usage                        │
└─────────────────────────────────────────────────────────────────┘
```

### Lifecycle Management

```
App Ready
    ↓
Menu.setApplicationMenu(null)  ← Hides default menu
    ↓
Create MainWindow
    ↓
Setup GlobalShortcuts (Cmd/Ctrl+Q)
    ↓
Start Resource Polling
    ↓
Register IPC Handlers
```

### Cleanup Flow

```
Cleanup Triggers:
- before-quit
- will-quit
- window-all-closed
- SIGTERM/SIGINT/SIGHUP
- Cmd/Ctrl+Q

Cleanup Actions:
1. globalShortcut.unregisterAll()
2. stopPolling()           ← Clears 500ms interval
3. cleanupAllSessions()    ← Aborts all runner handles
4. killViteDevServer()     ← Dev-only: kills port 5173
```

---

## 2. IPC Communication Channels

### Preload Script (`preload.cts`)

Exposes `window.electron` API to renderer process:

| Method | Direction | Handler | Purpose |
|--------|-----------|---------|---------|
| `subscribeStatistics(callback)` | Main→Renderer | `ipcOn("statistics")` | Real-time CPU/RAM/storage |
| `getStaticData()` | Renderer→Main (invoke) | `ipcHandle("getStaticData")` | Static system info |
| `sendClientEvent(event)` | Renderer→Main (send) | `ipcMain.on("client-event")` | All client operations |
| `onServerEvent(callback)` | Main→Renderer | `ipcMain.on("server-event")` | All server responses |
| `getRecentCwds(limit)` | Renderer→Main (invoke) | `ipcHandle("get-recent-cwds")` | Directory history |
| `selectDirectory()` | Renderer→Main (invoke) | `ipcHandle("select-directory")` | Directory picker |

### Client → Main Events (`ClientEvent`)

Defined in `types.ts`:

```typescript
type ClientEvent =
  | { type: "session.start"; payload: { title, prompt, cwd?, allowedTools? } }
  | { type: "session.continue"; payload: { sessionId, prompt, cwd? } }
  | { type: "session.stop"; payload: { sessionId } }
  | { type: "session.delete"; payload: { sessionId } }
  | { type: "session.list" }
  | { type: "session.history"; payload: { sessionId } }
  | { type: "permission.response"; payload: { sessionId, toolUseId, result } }
```

### Main → Client Events (`ServerEvent`)

```typescript
type ServerEvent =
  | { type: "stream.message"; payload: { sessionId, message: SDKMessage } }
  | { type: "stream.user_prompt"; payload: { sessionId, prompt } }
  | { type: "session.status"; payload: { sessionId, status, title?, cwd?, error? } }
  | { type: "session.list"; payload: { sessions: SessionInfo[] } }
  | { type: "session.history"; payload: { sessionId, status, messages[] } }
  | { type: "session.deleted"; payload: { sessionId } }
  | { type: "permission.request"; payload: { sessionId, toolUseId, toolName, input } }
  | { type: "runner.error"; payload: { sessionId?, message } }
```

---

## 3. CLI Spawning Mechanism (SDK-Based)

**IMPORTANT:** The app does NOT spawn `letta-code` CLI directly. Instead, it uses the `@letta-ai/letta-code-sdk` package which internally handles CLI communication.

### Runner Architecture (`libs/runner.ts`)

```
┌─────────────────────────────────────────────────────────────────┐
│                     runLetta(options)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Input: { prompt, session, resumeConversationId?, onEvent,    │
│           onSessionUpdate }                                      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. Determine Session Creation Strategy                   │   │
│  │    - resumeConversationId provided + valid?              │   │
│  │      → resumeSession(resumeConversationId)               │   │
│  │    - resumeConversationId invalid?                       │   │
│  │      → resumeSession(cachedAgentId) OR createSession()   │   │
│  │    - cachedAgentId exists?                               │   │
│  │      → resumeSession(cachedAgentId)                      │   │
│  │    - Otherwise:                                          │   │
│  │      → createSession(undefined)  // New agent          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 2. Configure Session Options                            │   │
│  │    {                                                            │
│  │      cwd: session.cwd || process.cwd(),                  │   │
│  │      permissionMode: "bypassPermissions",                │   │
│  │      canUseTool: (toolName, input) => {                  │   │
│  │        // Special handling for AskUserQuestion          │   │
│  │        if (toolName === "AskUserQuestion") {              │   │
│  │          // Emit permission.request, wait for response  │   │
│  │        }                                                  │   │
│  │        return { behavior: "allow" };  // All others       │   │
│  │      }                                                    │   │
│  │    }                                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 3. Execute & Stream                                       │   │
│  │    await lettaSession.send(prompt)                      │   │
│  │    for await (message of lettaSession.stream()) {       │   │
│  │      emit("stream.message", { sessionId, message })     │   │
│  │      if (message.type === "result") {                   │   │
│  │        emit("session.status", { status: "completed" })  │   │
│  │      }                                                    │   │
│  │    }                                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 4. Return Handle                                          │   │
│  │    return {                                               │   │
│  │      abort: () => lettaSession.abort()                  │   │
│  │    }                                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Agent ID Caching

```typescript
// Global cache (module-level variable)
let cachedAgentId: string | null = null;

// First session: createSession() returns new agentId
// Subsequent sessions: resumeSession(cachedAgentId) creates new conversation on same agent
```

### Session ID Validation

```typescript
const isValidLettaId = (id: string | undefined): boolean => {
  if (!id) return false;
  return /^(agent-|conv-|conversation-|[0-9a-f]{8}-[0-9a-f4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/.test(id);
};
```

---

## 4. Session Management

### Runtime State (`libs/runtime-state.ts`)

In-memory only - no persistence:

```typescript
type RuntimeSession = {
  conversationId: string;
  agentId?: string;
  status: "idle" | "running" | "completed" | "error";
  pendingPermissions: Map<string, PendingPermission>;
  abortController?: AbortController;
};

// In-memory storage
const sessions = new Map<string, RuntimeSession>();
```

### Session Lifecycle

```
session.start
    ↓
createRuntimeSession(conversationId)
    ↓
runLetta() → SDK creates agent/conversation
    ↓
onSessionUpdate({ lettaConversationId }) ← From SDK
    ↓
emit("session.status", { status: "running" })
    ↓
Stream messages...
    ↓
Result received → emit("session.status", { status: "completed" })

session.continue (resume)
    ↓
getSession(conversationId) OR createRuntimeSession()
    ↓
runLetta({ resumeConversationId }) ← Passes conversation ID to SDK
    ↓
SDK resumes that specific conversation

session.stop
    ↓
runnerHandles.get(conversationId).abort()
    ↓
emit("session.status", { status: "idle" })

session.delete
    ↓
handle.abort()
    ↓
deleteSession(conversationId)
    ↓
emit("session.deleted")
    ↓
Note: Conversation remains in Letta server, just removed from UI
```

---

## 5. Build Configuration

### electron-builder.json

```json
{
  "appId": "com.letta.cowork",
  "productName": "Letta Cowork",
  "files": ["dist-electron", "dist-react"],
  "extraResources": ["dist-electron/preload.cjs"],
  "asarUnpack": [
    "node_modules/@letta-ai/letta-code-sdk/**/*",
    "node_modules/@letta-ai/letta-code/**/*"
  ],
  "mac": { "target": "dmg" },
  "linux": { "target": "AppImage", "category": "Utility" },
  "win": { "target": ["portable"] }
}
```

### Build Scripts (package.json)

```
# Development
bun run dev                    # Concurrently runs: vite + electron
  ├─ dev:react → vite          # React dev server on PORT (from .env)
  └─ dev:electron → tsc --project src/electron/tsconfig.json && electron .

# Production Build Steps
bun run transpile:electron       # tsc --project src/electron/tsconfig.json
    ↓
bun run build                    # vite build (outputs to dist-react)
    ↓
electron-builder --mac --arm64   # Or --win, --linux
```

### Output Structure

```
dist-electron/
  ├── main.js           # Compiled from main.ts
  ├── preload.cjs       # Compiled from preload.cts
  ├── ipc-handlers.js
  ├── libs/
  │   ├── runner.js
  │   └── runtime-state.js
  └── ...

dist-react/
  ├── index.html
  └── assets/
```

---

## 6. Security Considerations

### Current Security Measures

1. **Context Isolation**: Uses `contextBridge.exposeInMainWorld()` - GOOD
2. **Frame Validation**: `validateEventFrame()` in `util.ts` checks origin
   - Dev: allows `localhost:${DEV_PORT}`
   - Prod: only allows `pathToFileURL(getUIPath())`
3. **Node Integration**: Not explicitly enabled (defaults off) - GOOD
4. **Preload Only**: Renderer cannot directly access Node APIs

### Security Issues

1. **Permission Mode**: `permissionMode: "bypassPermissions"` allows all tool executions except `AskUserQuestion`
2. **No CSP**: No Content-Security-Policy defined
3. **Environment Leak**: `.env` file loaded in main process, could leak to renderer via IPC
4. **No Request Validation**: IPC handlers don't validate payload structure
5. **CLI Path Discovery**: Uses `which letta` / `where letta` without path validation

---

## 7. Overhaul Recommendations

### Critical Changes for SDK 0.1.14

1. **SDK Version Update**
   - Current: `^0.0.5`
   - Target: `^0.1.14`
   - Check for breaking changes in:
     - `createSession()` / `resumeSession()` signatures
     - Message types (`SDKMessage` union)
     - Session options structure
     - Streaming interface

2. **Type Safety Improvements**
   ```typescript
   // Current: EventPayloadMapping is loosely typed
   type EventPayloadMapping = {
     statistics: Statistics;
     getStaticData: StaticData;
     // ... only 5 entries
   };

   // Should be: Strict typing for all IPC channels
   type EventPayloadMapping = {
     "session.start": { title: string; prompt: string; ... };
     "session.status": { sessionId: string; status: SessionStatus; ... };
     // All 15+ event types
   };
   ```

3. **Replace Hardcoded Values**
   | Current | Should Be |
   |---------|-----------|
   | `DEFAULT_CWD = process.cwd()` | Configurable default cwd |
   | `permissionMode: "bypassPermissions"` | User-configurable permission mode |
   | `DEV_PORT = 5173` | Read from vite.config.ts or env |
   | Window size (1200x800) | User preferences / last state |
   | `POLLING_INTERVAL = 500` | Configurable / disable option |

### Architecture Improvements

1. **Session Persistence**
   ```typescript
   // Current: In-memory only
   // Should: SQLite persistence for session metadata
   // - Keep conversationId → agentId mapping
   // - Store session titles, timestamps
   // - Recent working directories
   ```

2. **Error Handling**
   ```typescript
   // Current: Generic try/catch with console.error
   // Should: Structured error types
   enum SessionErrorType {
     NETWORK_ERROR,
     AUTH_ERROR,
     SDK_VERSION_MISMATCH,
     INVALID_CONVERSATION_ID,
   }
   ```

3. **Configuration System**
   ```typescript
   // Current: process.env + hardcoded defaults
   // Should: Electron Store with UI settings
   interface AppConfig {
     api: { baseUrl: string; apiKey: string };
     agent: { defaultAgentId?: string; permissionMode: PermissionMode };
     ui: { windowSize: { width, height }; polling: boolean };
   }
   ```

4. **Logging System**
   ```typescript
   // Current: Console logs with DEBUG env flags
   // Should: Structured logging with levels
   logger.debug("session.start", { sessionId, prompt });
   logger.info("Session created", { conversationId, agentId });
   logger.error("SDK error", { error, context });
   ```

### Simplification Opportunities

1. **Remove redundant code**
   - `test.ts` contains both resource polling AND static data - should split
   - `getRecentCwds()` returns `[process.cwd()]` - placeholder not useful
   - `killViteDevServer()` is dev-only hack - use Vite's built-in cleanup

2. **Consolidate event handling**
   ```typescript
   // Current: Scattered event emitting
   emit({ type: "session.status", ... });
   emit({ type: "stream.message", ... });
   
   // Could be: Centralized event bus
   eventBus.emit(new SessionStatusEvent(sessionId, status));
   ```

3. **Simplify IPC**
   ```typescript
   // Current: Two different IPC patterns
   ipcMainHandle("getStaticData", ...)  // invoke/handle
   ipcMain.on("client-event", ...)       // send/on
   
   // Could be: Single pattern with typed channels
   createIPCHandler("getStaticData", handler);
   createIPCHandler("client-event", handler);
   ```

### Build/Package Improvements

1. **Add auto-updater**: electron-updater integration
2. **Code signing**: Required for macOS distribution
3. **Notarization**: Required for macOS 10.15+
4. **Windows installer**: Currently only portable, should offer MSI/EXE
5. **Linux packages**: Add deb, rpm, snap targets

---

## 8. Files Summary

| File | Purpose | Lines | Overhaul Priority |
|------|---------|-------|-------------------|
| `main.ts` | Entry point, window creation, lifecycle | 136 | High |
| `preload.cts` | Context bridge, renderer API exposure | 42 | Medium |
| `ipc-handlers.ts` | Main IPC logic, session orchestration | 279 | High |
| `types.ts` | TypeScript interfaces, event types | 59 | High |
| `libs/runner.ts` | SDK integration, session execution | 239 | Critical |
| `libs/runtime-state.ts` | In-memory session storage | 56 | Medium |
| `util.ts` | Dev detection, IPC utilities | 28 | Low |
| `pathResolver.ts` | Path resolution for dev/prod | 23 | Low |
| `test.ts` | Resource polling, static data | 70 | Medium |

---

## 9. Migration Checklist

- [ ] Update `@letta-ai/letta-code-sdk` to 0.1.14
- [ ] Review SDK changelog for breaking changes
- [ ] Update `createSession()` / `resumeSession()` calls
- [ ] Verify message type compatibility
- [ ] Add structured error handling
- [ ] Implement configuration persistence
- [ ] Add CSP headers
- [ ] Improve permission system (configurable modes)
- [ ] Add proper session persistence (SQLite)
- [ ] Refactor IPC to use typed channels
- [ ] Add comprehensive logging
- [ ] Update build config for code signing
- [ ] Add auto-updater
- [ ] Remove hardcoded values
- [ ] Add window state persistence
- [ ] Review and improve security measures
