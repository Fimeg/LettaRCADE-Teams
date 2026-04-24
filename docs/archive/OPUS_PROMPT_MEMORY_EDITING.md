# Opus Prompt: Memory Editing & Session Management Overhaul

**Context:** You are continuing work on the "Universal Mega App" — a Letta Community ADE that combines the best of letta-oss-ui, community-ade backend, and "futuristic" patterns from a hacked reference app.

## Original Vision

Build the ultimate self-hosted Letta ADE with:
- **3-pane UI layout** (Sidebar | Chat | Agent Details)
- **Agent teleport** — deploy agents to Matrix/Telegram/CLI channels
- **Full 0.16.7 compatibility** — works with Letta server 0.16.7 + SDK 0.1.14
- **Memory editing** — users can view AND edit agent memory blocks
- **Session management** — start/resume sessions, see where agents are running
- **Machine awareness** — agents know which host/machine they're on

## Current State (What's Done)

### ✅ Completed
- 3-pane resizable layout (react-resizable-panels)
- AgentDetailPanel with memory block display, tool list, metadata
- DeployModal UI for Matrix/Telegram/CLI channels
- API client layer connecting to community-ade backend
- WebSocket real-time sync hook (falls back to HTTP)
- SDK 0.1.14 migration (streaming, memory format)
- Browser-mode support (works in Electron OR browser)
- Backend running on port 9333 with 68 agents available

### ⚠️ Partial / Mock
- Deploy backend — UI exists, API mocked (returns success)
- Memory editing — UI shows blocks as read-only, no edit capability
- Session management — basic list, no machine location, no resume

## Critical Gaps & Bugs

### 1. Memory Editing (PRIMARY FOCUS)
**Current:** MemoryBlockList shows blocks with "Show more/less" but NO edit capability.

**Needs:**
- Click a memory block → enters edit mode
- Textarea with current content
- Save/Cancel buttons
- Update flows to backend via `api.updateMemoryBlock()`
- Real-time sync updates other connected clients

**Backend API exists:**
```typescript
// PATCH /api/agents/:id/memory/:label
api.updateMemoryBlock(agentId, blockLabel, newValue)
```

### 2. Session Management — Machine Location
**Current:** Sessions list shows title/status but NOT which machine the agent is "on".

**Needs:**
- Sessions show hostname/machine identifier (from agent's perspective)
- This comes from agent's system message or metadata
- e.g., "Running on: ani@10.10.20.19" or "jean-luc@10.10.20.150"

### 3. Resume Old Sessions
**Current:** Sidebar shows sessions but clicking them doesn't properly resume.

**Needs:**
- Click session → loads conversation history
- Shows agent details in right panel
- Chat continues from where it left off

### 4. Start Session Flow
**Current:** StartSessionModal exists but may not properly wire to backend.

**Needs:**
- Create conversation via `api.createConversation(agentId)`
- Link session to specific agent
- Update URL or state to reflect active session

## Reference: The "Hacked App" (Futuristic Examples)

The hacked app (from the .asar diff) contains patterns that are "ahead of their time":

**Key patterns to adapt:**
- Memory block editing with live preview
- Session cards showing machine location + agent status
- Tool toggle switches (enable/disable per agent)
- Archival memory search/insertion
- Multi-channel deployment health indicators

**Location:** `/home/casey/Projects/letta-oss-ui/HACKED_ASAR_DIFF.md`

## Technical Architecture

**Frontend:** `/home/casey/Projects/letta-oss-ui/src/ui/`
- React + TypeScript + Tailwind v4
- Zustand store: `src/ui/store/useAppStore.ts`
- API client: `src/ui/services/api.ts`
- Components: `src/ui/components/`

**Backend:** `/home/casey/Projects/community-ade/` (port 9333)
- Express + Letta SDK 0.1.14
- API endpoints for agents, memory, chat, deploy
- WebSocket at `/ws` (needs Redis for full functionality)

**Current Data Flow:**
```
UI (browser) → HTTP API → community-ade → Letta 0.16.7 server
     ↓              ↓            ↓
  (fallback)   WebSocket    (needs Redis)
```

## Specific Implementation Tasks

### Priority 1: Memory Block Editing
**File:** `src/ui/components/MemoryBlockList.tsx`

Current state:
- Shows block label, limit badge
- "Show more/less" for long text
- Read-only display

Make it:
- Click block (or edit button) → enter edit mode
- Full textarea with block content
- Save button → calls `updateMemoryBlock()` → refreshes list
- Cancel button → reverts to read-only
- Optimistic UI update (show new value immediately, revert on error)

### Priority 2: Session Machine Location
**Files:** `src/ui/components/Sidebar.tsx`, `src/ui/store/useAppStore.ts`

Add to session info:
- `hostname` or `machineId` field
- Display in Sidebar session cards
- Shows "jean-luc@10.10.20.150" format

Source: Agent's system message or metadata from backend

### Priority 3: Resume Session
**File:** `src/ui/components/Sidebar.tsx`

On session click:
1. Set active session ID
2. Fetch conversation messages via API
3. Load agent details for right panel
4. Switch to chat view with history

### Priority 4: Tool Toggles
**File:** `src/ui/components/ToolAttachmentList.tsx`

Current: Shows tools as read-only
Make it: Toggle switch to enable/disable tools per agent

API exists in backend: `POST /api/agents/:id/tools/:toolId/attach` and `/detach`

## File Locations to Modify

| Feature | Files |
|---------|-------|
| Memory editing | `src/ui/components/MemoryBlockList.tsx` |
| | `src/ui/store/useAppStore.ts` (add updateMemoryBlock action) |
| Session machine location | `src/ui/components/Sidebar.tsx` |
| | `src/ui/store/useAppStore.ts` |
| Resume session | `src/ui/components/Sidebar.tsx` |
| | `src/ui/hooks/useIPC.ts` (load history) |
| Tool toggles | `src/ui/components/ToolAttachmentList.tsx` |
| | `src/ui/services/api.ts` (ensure attach/detach exist) |

## Design Philosophy (From Hacked App)

- **Inline editing** — Don't open modals, edit in place
- **Real-time sync** — Changes appear instantly (WebSocket or polling)
- **Machine awareness** — Agents have a sense of "where" they are
- **Channel status** — Visual indicators for deployed channels
- **No dead ends** — Every feature should work end-to-end

## Current Bugs to Fix

1. **Browser mode:** Works but has limited functionality without WebSocket
2. **Memory display:** Shows raw block value, not formatted
3. **Session list:** May not update when backend changes
4. **Agent selection:** Clicking agent in sidebar may not load details panel

## Deliverables

1. **Memory editing working** — User can click, edit, save memory blocks
2. **Session machine location** — Shows which host/machine
3. **Resume working** — Can click old session and continue chatting
4. **Tool toggles** — Enable/disable tools per agent
5. **Commit** — Fast commit, no attribution

## Test With

- Backend: http://localhost:9333 (68 agents available)
- UI: http://localhost:5173/
- Test agent: `agent-c791805f-ffe7-419d-ad8a-b7228af1be2c` (Aster)

## Questions to Ask Yourself

1. Does the memory editing feel like the hacked app's inline editing?
2. Can a user tell which machine an agent is "thinking" on?
3. Is there any dead UI (buttons that don't work)?
4. Does it feel like a unified experience, not glued-together parts?

---

**Goal:** Working memory editing and session management that rivals the hacked app's futuristic UX, backed by the solid community-ade architecture.
