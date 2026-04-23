# Letta OSS UI Structure Analysis

**Version:** Current (0.0.5 SDK) -> Target (0.16.7 SDK)  
**Date:** 2026-04-23  
**Purpose:** Foundation for 3-pane, full-feature UI overhaul

---

## 1. Component Hierarchy

```
App.tsx (Root)
├── Sidebar.tsx (Left Pane - 280px fixed)
│   ├── Session List (sorted by updatedAt)
│   ├── New Task Button
│   ├── Session Dropdown Menu (Delete, Resume in Code)
│   └── Resume Dialog (CLI command copy)
│
├── Main Content Area (Center Pane - flex-1)
│   ├── Title Bar (draggable, session title)
│   ├── Message Scroll Container
│   │   ├── Top Sentinel (intersection observer for history)
│   │   ├── Beginning of conversation marker
│   │   ├── Loading indicator
│   │   ├── Message List (EventCard/MessageCard)
│   │   │   ├── UserPromptCard (local type)
│   │   │   ├── InitCard (session start info)
│   │   │   ├── AssistantCard (markdown content)
│   │   │   ├── ReasoningCard (thinking content)
│   │   │   ├── ToolCallCard (tool execution)
│   │   │   │   └── DecisionPanel (AskUserQuestion only)
│   │   │   └── ToolResultCard (output display)
│   │   ├── Partial Message (streaming display)
│   │   └── Messages End Ref (auto-scroll anchor)
│   ├── PromptInput (fixed bottom)
│   │   └── usePromptActions hook
│   └── New Messages Button (scroll-to-bottom)
│
└── Modals/Overlays
    ├── StartSessionModal (cwd + prompt)
    └── Global Error Toast
```

### Missing for 3-Pane Structure (Right Pane)
- **Agent Details Panel** - No current equivalent
- **Memory/Blocks Viewer** - No current equivalent
- **Tool Configuration** - No current equivalent
- **Conversation Settings** - No current equivalent

---

## 2. State Management Architecture

### Zustand Store (`useAppStore.ts`)

```typescript
// Core State
sessions: Record<string, SessionView>       // All sessions by ID
activeSessionId: string | null               // Currently selected
prompt: string                               // Input buffer
cwd: string                                  // Working directory
pendingStart: boolean                        // Modal flow state
globalError: string | null                   // Error display
showStartModal: boolean                      // Modal visibility
historyRequested: Set<string>                // Tracks loaded history

// Actions
setPrompt, setCwd, setPendingStart, setGlobalError
setShowStartModal, setActiveSessionId
markHistoryRequested, resolvePermissionRequest
handleServerEvent: (event: ServerEvent) => void   // Main event dispatcher
```

### SessionView Type
```typescript
interface SessionView {
  id: string;
  title: string;
  status: "idle" | "running" | "completed" | "error";
  cwd?: string;
  messages: StreamMessage[];
  permissionRequests: PermissionRequest[];
  lastPrompt?: string;
  createdAt?: number;
  updatedAt?: number;
  hydrated: boolean;  // Tracks if history loaded
}
```

---

## 3. IPC / Communication Architecture

### Electron Preload Bridge (`preload.cts`)
```typescript
window.electron = {
  sendClientEvent: (event: ClientEvent) => void
  onServerEvent: (callback) => unsubscribeFunction
  getRecentCwds: () => Promise<string[]>
  selectDirectory: () => Promise<string | null>
  subscribeStatistics: (callback) => void  // Currently unused
  getStaticData: () => Promise<any>      // Currently unused
}
```

### Event Flow
```
UI (React) -> IPC -> Electron Main -> SDK Runner -> Letta API
                     ^                                    |
                     |____________________________________|
                              Server Events (stream)
```

### Client -> Server Events
| Event | Payload | Purpose |
|-------|---------|---------|
| `session.start` | `{title, prompt, cwd?, allowedTools?}` | Create new session |
| `session.continue` | `{sessionId, prompt, cwd?}` | Continue existing |
| `session.stop` | `{sessionId}` | Abort running session |
| `session.delete` | `{sessionId}` | Remove from UI |
| `session.list` | - | List all sessions |
| `session.history` | `{sessionId}` | Fetch message history |
| `permission.response` | `{sessionId, toolUseId, result}` | Approve/deny tool |

### Server -> Client Events
| Event | Payload | Handler |
|-------|---------|---------|
| `session.list` | `{sessions: SessionInfo[]}` | `handleServerEvent` |
| `session.status` | `{sessionId, status, title?, cwd?}` | Updates session metadata |
| `session.history` | `{sessionId, status, messages}` | Hydrates session |
| `session.deleted` | `{sessionId}` | Removes from store |
| `stream.message` | `{sessionId, message: SDKMessage}` | Appends to messages |
| `stream.user_prompt` | `{sessionId, prompt}` | Local user message |
| `permission.request` | `{sessionId, toolUseId, toolName, input}` | Adds to permissionRequests |
| `runner.error` | `{message}` | Sets globalError |

---

## 4. SDK Integration Points

### Current SDK: `@letta-ai/letta-code-sdk@0.0.5`

### Core SDK Imports (`runner.ts`)
```typescript
import {
  createSession,      // Creates new agent + conversation
  resumeSession,      // Continues existing conversation
  type Session as LettaSession,
  type SDKMessage,
  type CanUseToolResponse,
} from "@letta-ai/letta-code-sdk";
```

### SDK Usage Pattern
```typescript
// Session creation options (current)
const sessionOptions = {
  cwd: session.cwd ?? process.cwd(),
  permissionMode: "bypassPermissions",
  canUseTool: async (toolName, input) => {
    // Only AskUserQuestion waits for user
    if (toolName === "AskUserQuestion") {
      // Returns promise that resolves when user responds
    }
    return { behavior: "allow" };
  },
};

// Create or resume
lettaSession = createSession(undefined, sessionOptions);
// OR
lettaSession = resumeSession(conversationId, sessionOptions);

// Send prompt
await lettaSession.send(prompt);

// Stream messages
for await (const message of lettaSession.stream()) {
  // Handle SDKMessage types:
  // - init, assistant, reasoning, tool_call, tool_result, result
}
```

### SDK Message Types (Current)
| Type | Properties | Rendered By |
|------|------------|-------------|
| `init` | `conversationId`, `agentId`, `model` | InitCard |
| `assistant` | `content` | AssistantCard |
| `reasoning` | `content` | ReasoningCard |
| `tool_call` | `toolName`, `toolInput`, `toolCallId` | ToolCallCard |
| `tool_result` | `toolCallId`, `content`, `isError` | ToolResultCard |
| `result` | `success`, `error?` | Error display (null on success) |

### Streaming Implementation
```typescript
// In App.tsx: Partial message handling
const handlePartialMessages = useCallback((partialEvent: ServerEvent) => {
  if (partialEvent.type !== "stream.message") return;
  if (partialEvent.payload.message.type !== "stream_event") return;

  const event = message.event;
  if (event.type === "content_block_start") {
    // Reset partial buffer
  }
  if (event.type === "content_block_delta" && event.delta) {
    // Accumulate text/reasoning
    partialMessageRef.current += event.delta.text || event.delta.reasoning || "";
  }
  if (event.type === "content_block_stop") {
    // Hide partial, clear buffer
  }
}, [shouldAutoScroll]);
```

---

## 5. Electron Dependencies Analysis

### Hard Electron Dependencies (Require Native APIs)

| Feature | File | Electron API | Browser Alternative |
|---------|------|--------------|---------------------|
| IPC Communication | `useIPC.ts` | `window.electron.*` | WebSocket/fetch |
| Directory Selection | `StartSessionModal.tsx` | `window.electron.selectDirectory()` | `<input type="file" webkitdirectory>` |
| Recent CWDs | `StartSessionModal.tsx` | `window.electron.getRecentCwds()` | localStorage/IndexedDB |
| CLI Path Detection | `main.ts` | `execSync('which letta')` | Not needed (direct SDK) |
| Window Controls | `App.tsx` | `WebkitAppRegion: 'drag'` | CSS only |
| Window Styling | `main.ts` | `titleBarStyle: "hiddenInset"` | CSS only |
| Global Shortcuts | `main.ts` | `globalShortcut.register` | window.addEventListener |
| System Statistics | `test.ts` | `os-utils`, `systeminformation` | Not needed |
| SQLite (better-sqlite3) | `package.json` | Native module | IndexedDB, or server-side |

### Browser-Capable Components
- All React components in `src/ui/` (except IPC hooks)
- Zustand store (localStorage persistence instead of IPC)
- Markdown rendering (`react-markdown`, `highlight.js`)
- UI components (Radix UI based)

### Requires Adaptation for Browser
| Component | Current | Browser Version |
|-----------|---------|-----------------|
| `useIPC.ts` | Electron IPC | REST API client + EventSource |
| `StartSessionModal.tsx` | `window.electron.selectDirectory()` | File input + drag-drop |
| Session persistence | File-based | localStorage/IndexedDB |
| File system access | Node.js `fs` | Server proxy or File System Access API |

---

## 6. 0.16.7 SDK Update Requirements

### Critical Breaking Changes

#### 1. SDK Package Name/Path
```typescript
// CURRENT (0.0.5)
import { createSession, resumeSession } from "@letta-ai/letta-code-sdk";

// 0.16.7 - Likely changes to:
import { LettaClient } from "@letta-ai/letta-client";  // or similar
// OR direct REST API usage
```

#### 2. Memory Block Handling (High Impact)
```typescript
// CURRENT - No explicit memory handling
// Messages just stream in

// 0.16.7 - Memory blocks use `value` not `content`
// Need to update message rendering for block types:
interface MemoryBlock {
  id: string;
  type: "memory";
  label: string;      // Block name
  value: string;      // NOT "content"
  limit?: number;
}

// Updates needed in:
// - EventCard.tsx: Handle block messages
// - AppStore: Block accumulation logic
```

#### 3. Streaming API Pattern (High Impact)
```typescript
// CURRENT - Stream deltas
for await (const message of lettaSession.stream()) {
  // SDK handles delta accumulation
}

// 0.16.7 - Server-Sent Events (SSE) pattern likely
const response = await fetch('/v1/agents/{agent_id}/messages/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message }),
});

const reader = response.body?.getReader();
// Parse SSE chunks, accumulate content
```

#### 4. Agent vs Conversation Model (High Impact)
```typescript
// CURRENT - Implicit agent creation
// createSession() creates agent + conversation

// 0.16.7 - Explicit agent management
// Need new UI components:
// - Agent selection/creation in Sidebar
// - Agent settings panel (right pane)
// - Memory configuration per agent
```

### File-by-File Update Requirements

#### `/src/ui/App.tsx`
**Changes Required:**
- [ ] Update `handlePartialMessages` for new SSE streaming format
- [ ] Add memory block rendering support
- [ ] Update stream event types (`content_block_delta` -> new format)
- [ ] Add agent context to session display

**Effort:** Medium (2-3 days)

#### `/src/ui/components/EventCard.tsx`
**Changes Required:**
- [ ] Add `memory` message type handler
- [ ] Update block rendering (value vs content)
- [ ] Handle new message types from 0.16.7
- [ ] Update tool call display for new tool format

**Effort:** Medium (1-2 days)

#### `/src/ui/components/Sidebar.tsx`
**Changes Required:**
- [ ] Add agent selection UI (new component)
- [ ] Update session model to include `agentId`
- [ ] Add agent creation flow
- [ ] Handle multiple agents per session view

**Effort:** High (3-4 days)

#### `/src/ui/components/DecisionPanel.tsx`
**Changes Required:**
- [ ] Update for new permission API
- [ ] Handle `CanUseToolResponse` format changes
- [ ] May need to support more tool types

**Effort:** Low (1 day)

#### `/src/ui/components/PromptInput.tsx`
**Changes Required:**
- [ ] Update `handleSend` for new API pattern
- [ ] Add agent context to messages
- [ ] Handle new streaming start flow

**Effort:** Low (1 day)

#### `/src/ui/store/useAppStore.ts`
**Changes Required:**
- [ ] Update `StreamMessage` type union for new SDK types
- [ ] Add memory blocks to session state
- [ ] Update `handleServerEvent` for new event formats
- [ ] Add agent state management

**Effort:** High (3-4 days)

#### `/src/ui/types.ts`
**Changes Required:**
- [ ] Re-export new SDK types
- [ ] Update `StreamMessage` union
- [ ] Add new message types (blocks, etc.)
- [ ] Update `SessionInfo` for agent association

**Effort:** Medium (1-2 days)

#### `/src/electron/libs/runner.ts`
**Changes Required:**
- [ ] Replace `createSession`/`resumeSession` with new SDK client
- [ ] Update streaming implementation to SSE
- [ ] Handle new authentication pattern
- [ ] Update `canUseTool` callback signature
- [ ] Add memory block streaming support

**Effort:** High (4-5 days)

#### `/src/electron/ipc-handlers.ts`
**Changes Required:**
- [ ] Update all event handlers for new SDK responses
- [ ] Add agent management handlers
- [ ] Update session start/stop for new patterns

**Effort:** Medium (2-3 days)

#### `/src/electron/main.ts`
**Changes Required:**
- [ ] Update environment variable handling
- [ ] Add agent listing endpoints
- [ ] May need new IPC channels

**Effort:** Low-Medium (1-2 days)

---

## 7. 3-Pane UI Architecture for Overhaul

### Proposed New Structure

```
App.tsx
├── Sidebar (Left Pane - 280px)
│   ├── Agent Selector (NEW)
│   ├── Session List (per agent)
│   └── New Session Button
│
├── Chat Area (Center Pane - flexible)
│   ├── Agent Header (NEW - shows active agent)
│   ├── Message List
│   └── Input Area
│
└── Details Panel (Right Pane - 320px, collapsible)
    ├── Agent Memory (NEW)
    │   ├── Core Memory Blocks
    │   └── Archival Memory
    ├── Tool Configuration (NEW)
    ├── Conversation Settings (NEW)
    └── Token Usage (NEW)
```

### New Components Needed

| Component | Purpose | SDK Calls |
|-----------|---------|-----------|
| `AgentSelector.tsx` | Switch between agents | `GET /v1/agents` |
| `AgentCreator.tsx` | Create new agent | `POST /v1/agents` |
| `MemoryPanel.tsx` | Display/edit memory blocks | `GET/POST /v1/agents/{id}/memory` |
| `ToolConfig.tsx` | Enable/disable tools | `GET /v1/tools`, `PATCH /v1/agents/{id}` |
| `TokenUsage.tsx` | Show context window usage | Derived from message stream |
| `AgentHeader.tsx` | Show agent name/model | From active agent state |

---

## 8. Estimated Effort for Overhaul

### Phase 1: SDK Migration (0.0.5 -> 0.16.7)

| Task | Files | Effort | Risk |
|------|-------|--------|------|
| SDK integration rewrite | runner.ts, ipc-handlers.ts | 5 days | High - API changes unknown |
| Type system update | types.ts, useAppStore.ts | 2 days | Medium |
| Message rendering update | EventCard.tsx | 2 days | Medium |
| Streaming rewrite | App.tsx, runner.ts | 3 days | High - Core UX |
| Testing & debugging | All | 3 days | Medium |
| **Subtotal** | | **15 days** | |

### Phase 2: 3-Pane UI Implementation

| Task | Components | Effort | Risk |
|------|------------|--------|------|
| Agent management | AgentSelector, AgentCreator | 4 days | Medium |
| Right pane layout | MemoryPanel, ToolConfig | 4 days | Low |
| Memory block display | MemoryPanel, EventCard updates | 3 days | Medium |
| Agent-memory binding | useAppStore, runner.ts | 3 days | Medium |
| Responsive behavior | App.tsx, CSS | 2 days | Low |
| **Subtotal** | | **16 days** | |

### Phase 3: Browser Compatibility

| Task | Approach | Effort | Risk |
|------|----------|--------|------|
| API client abstraction | New `useAPI.ts` hook | 3 days | Low |
| File input adaptation | StartSessionModal | 1 day | Low |
| Storage replacement | localStorage/IndexedDB | 2 days | Low |
| Build configuration | Vite + optional Electron | 2 days | Medium |
| **Subtotal** | | **8 days** | |

### Total Estimated Effort
- **Conservative:** 40 days (8 weeks)
- **Optimistic:** 30 days (6 weeks)
- **With unexpected SDK changes:** 50+ days

---

## 9. Critical Unknowns

Before starting overhaul, need to resolve:

1. **0.16.7 SDK API surface** - Exact method signatures, authentication pattern
2. **Memory block streaming** - Do blocks stream as messages or require separate fetch?
3. **Tool permission model** - Has `canUseTool` callback pattern changed?
4. **Agent management** - Do we need separate agent CRUD or is it implicit?
5. **Conversation history** - New pagination model for message fetching?
6. **Authentication** - Still env-based or OAuth/login flow?

---

## 10. Recommended Migration Strategy

### Option A: Big Bang (Higher Risk)
- Freeze current UI
- Rewrite all SDK integration at once
- Release when fully functional

### Option B: Parallel Implementation (Lower Risk)
- Create new `runner-0.16.7.ts` alongside existing
- Feature flag to switch SDK versions
- Gradual migration of components
- Remove old code once stable

### Recommended: Option B
- Allows incremental testing
- Can revert if SDK issues
- Parallel development possible

---

## Appendix: File Locations

```
/home/casey/Projects/letta-oss-ui/
├── src/
│   ├── ui/
│   │   ├── App.tsx                    # Main layout
│   │   ├── main.tsx                   # React entry
│   │   ├── types.ts                   # Type definitions
│   │   ├── index.css                  # Global styles
│   │   ├── App.css                    # App styles
│   │   ├── store/
│   │   │   └── useAppStore.ts         # Zustand store
│   │   ├── hooks/
│   │   │   ├── useIPC.ts              # Electron IPC
│   │   │   └── useMessageWindow.ts    # Virtual scrolling
│   │   ├── components/
│   │   │   ├── Sidebar.tsx            # Session list
│   │   │   ├── EventCard.tsx          # Message display
│   │   │   ├── PromptInput.tsx        # Input area
│   │   │   ├── DecisionPanel.tsx      # Tool approval
│   │   │   └── StartSessionModal.tsx  # New session
│   │   └── render/
│   │       └── markdown.tsx           # MD rendering
│   └── electron/
│       ├── main.ts                    # Electron entry
│       ├── preload.cts                # IPC bridge
│       ├── ipc-handlers.ts            # Event handlers
│       ├── types.ts                   # Electron types
│       ├── util.ts                    # Helpers
│       ├── test.ts                    # Stats polling
│       ├── pathResolver.ts            # Path resolution
│       └── libs/
│           ├── runner.ts              # SDK integration
│           └── runtime-state.ts       # Session state
├── package.json                       # Dependencies
├── vite.config.ts                     # Vite config
└── index.html                         # HTML entry
```
