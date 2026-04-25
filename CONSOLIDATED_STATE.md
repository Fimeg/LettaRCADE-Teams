# Letta Community ADE - Consolidated State

**Date:** 2026-04-24  
**Project:** `/home/casey/Projects/letta-oss-ui`  
**Gitea:** `Fimeg/letta-oss-ui` at `http://10.10.20.120:4455`

---

## Executive Summary

The Letta Community ADE (formerly Cowork) is an Electron-based desktop application for managing Letta agents. The project has undergone significant refactoring and is in a **functional but transitional state**.

### Working
- Server mode (connecting to external Letta server at localhost:8283)
- Agent CRUD, messaging, memory management
- Favorite Agent home view
- Navigation: Home / Agents / Teams / Settings

### Not Working
- **Local mode spawning** - This is the critical blocker. The app cannot spawn its own letta-code process.

---

## Architecture Overview

### 4 Reference Projects
1. **letta-code-sdk** (v0.1.14) - Official SDK in `node_modules/@letta-ai/letta-code-sdk`
2. **letta-oss-ui** (this project) - Community ADE desktop app
3. **letta-code-new** (hacked app) - Modern reference at `/home/casey/Projects/letta-code-new` - **PRIMARY pattern reference**
4. **letta-server** (v0.16.7) - Server at `/home/casey/Projects/letta-server`

### Key Technical Decision
**Use native Letta client, NOT custom wrapper APIs.**

```typescript
// Correct pattern
import { Letta } from "@letta-ai/letta-client";
const client = new Letta({ baseURL: "http://localhost:8283" });
const agents = await client.agents.list();
```

---

## Current Navigation Structure

| Tab | Status | Content |
|-----|--------|---------|
| **Home** | 🟡 needs redesign | Favorite Agent dashboard (when set), or CTA to pick one |
| **Agents** | 🟢 working | AgentWorkspace when agent selected, else AgentsBrowser grid |
| **Teams** | 🟡 stub | TeamsView placeholder - "Coming soon" |
| **Settings** | 🟡 basic | SettingsPanel with server setup wizard pending |

**Models tab removed** - was redundant, model config now in agent settings.

---

## Component Inventory

### Core UI Components
| Component | Location | Purpose |
|-----------|----------|---------|
| `App.tsx` | `src/ui/App.tsx` | Main shell, tab navigation, renderMainContent() switch |
| `AgentsBrowser.tsx` | `src/ui/components/AgentsBrowser.tsx` | Grid of agent cards with star/favorite |
| `AgentWorkspace.tsx` | `src/ui/components/AgentWorkspace.tsx` | Full agent UI: chat, memory, config |
| `AgentWizard.tsx` | `src/ui/components/agents/AgentWizard.tsx` | 5-step agent creation wizard |
| `FavoriteAgentView.tsx` | `src/ui/components/FavoriteAgentView.tsx` | Home dashboard for starred agent |
| `TeamsView.tsx` | `src/ui/components/TeamsView.tsx` | Placeholder for Teams integration |
| `SettingsPanel.tsx` | `src/ui/components/SettingsPanel.tsx` | Global settings |

### Hooks
| Hook | Location | Purpose |
|------|----------|---------|
| `useAppStore.ts` | `src/ui/store/useAppStore.ts` | Zustand store - agents, messages, sessions |
| `useStreamingMessages.ts` | `src/ui/hooks/useStreamingMessages.ts` | Direct SDK streaming |
| `useMessageHistory.ts` | `src/ui/hooks/useMessageHistory.ts` | Conversation history loading |
| `useLettaCodeSpawn.ts` | `src/ui/hooks/useLettaCodeSpawn.ts` | **Local mode spawn - BROKEN** |
| `useIPC.ts` | `src/ui/hooks/useIPC.ts` | Electron IPC bridge |

### Electron Main Process
| File | Location | Purpose |
|------|----------|---------|
| `main.ts` | `src/electron/main.ts` | Main entry, window creation, proxy server start |
| `letta-code-manager.ts` | `src/electron/letta-code-manager.ts` | Spawns letta-code CLI subprocess |
| `pathResolver.ts` | `src/electron/pathResolver.ts` | Resolves preload/bundle paths |
| `proxy-server.ts` | `src/electron/proxy-server.ts` | Local proxy for letta-code → upstream server |
| `ipc-handlers.ts` | `src/electron/ipc-handlers.ts` | IPC event handling |

---

## The Local Mode Problem (CRITICAL)

### Current State
Local mode (spawning `letta-code` as subprocess) **does not work**. The UI shows the ConnectionModeIndicator toggle, but clicking "Local" fails to spawn.

### Root Cause
The official `@letta-ai/letta-code` package in npm does NOT have memfs support enabled. The app needs Casey's **custom developer build** of letta-code with memfs patches applied.

### Key Finding (2026-04-24)
The **custom letta-code is already built and ready** at:
- **Source:** `/home/casey/Projects/letta-code/`
- **Bundle:** `/home/casey/Projects/letta-code/letta.js` (6.3MB, built on Apr 23)
- **Status:** ✅ Memfs patches ALREADY applied

Evidence from source grep:
```typescript
// src/agent/memoryGit.ts already has:
const envUrl = process.env.LETTA_MEMFS_GIT_URL;
if (envUrl) {
  return envUrl.replace("{agentId}", agentId);
}
```

### What Exists
- `LettaCodeManager` class in `src/electron/letta-code-manager.ts` - handles spawn/stop/status
- `useLettaCodeSpawn` hook in `src/ui/hooks/useLettaCodeSpawn.ts` - UI integration
- Path resolution logic in `letta-code-manager.ts` line 37-65 tries to find `@letta-ai/letta-code/letta.js` in node_modules

### The Fix Needed
The `LettaCodeManager.resolveCliPath()` function currently searches:
1. `app.getAppPath()/node_modules/@letta-ai/letta-code/letta.js`
2. `process.cwd()/node_modules/@letta-ai/letta-code/letta.js`
3. `__dirname/../../node_modules/@letta-ai/letta-code/letta.js`

**It should also check:**
- `/home/casey/Projects/letta-code/letta.js` (custom dev build)

**Plus set env vars when spawning:**
```bash
LETTA_MEMFS_GIT_URL=https://gitea.example.com/Casey/{agentId}.git
LETTA_MEMFS_GIT_TOKEN=xxx  # If needed for private repos
```

### Related Project
See `/home/casey/Projects/letta-external-memfs/` - contains patches and setup for external memfs.

---

## Gitea Issues Status

| Issue | Title | Status | Notes |
|-------|-------|--------|-------|
| #6 | Slash commands | ✅ **CLOSE** | `/doctor /clear /remember /recompile` - working in `slashCommands.ts` |
| #7 | Curator health + sacred blocks | ✅ **CLOSE** | `memoryHealth.ts`, `useSacredBlocks.ts`, `SacredToggle.tsx` |
| #8 | Archival memory management | ✅ **CLOSE** | Integrated in `AgentMemoryPanel.tsx` |
| #9 | Connection mode indicator | ✅ **CLOSE** | `ConnectionModeIndicator.tsx` styled and working |
| #10 | Agent creation wizard | ✅ **CLOSE** | `AgentWizard.tsx` with 5 steps wired in `App.tsx` |

**Action needed:** Update Gitea with closure comments linking to code locations.

---

## Recent Changes (Last 3 Sessions)

### Session 1 (2026-04-24 early)
- SDK Refactor: Eliminated `chatApi` wrapper, calling SDK directly
- `useStreamingMessages.ts` - agent-scoped streaming
- `useMessageHistory.ts` - conversation-scoped history
- Fixed dual message state in store

### Session 2 (2026-04-24 late)
- **P0 Fix:** `useMessageHistory.transformMessage` was passing raw SDK objects without mapping `message_type` → UI `type`
- Rebrand: Cowork → Letta Community ADE
- Top-tab navigation fix: `App.tsx:renderMainContent` now respects `activeTab`
- TeamsView stub added
- AgentsBrowser welcome hero

### Session 3 (2026-04-25)
- **P0 Verified:** Messaging fix confirmed working on server mode
- Favorite Agent v1: `FavoriteAgentView.tsx` with health monitors, stats, schedule card
- Richer agent cards: status dot, last run, tool count, star button
- Fixed `__dirname` polyfill for ESM in `pathResolver.ts` and `main.ts`
- Fixed preload path to work in dev/production without NODE_ENV dependency

---

## Next Session Priorities (For Next Model)

### Priority 1: Debug Local Mode Spawn 🔴
**Goal:** Get local letta-code spawning working with Casey's custom build.

**Files to touch:**
- `src/electron/letta-code-manager.ts` - `resolveCliPath()` function (line 37-65)
- `src/electron/main.ts` - env var setup for memfs

**Questions for Casey:**
1. What's the exact path to your custom letta-code binary? (`/home/casey/Projects/letta-code/letta.js`?)
2. Do you have memfs patches applied to it?
3. What's your Gitea instance URL for memfs?
4. Do you want the app to use system letta-code or bundle it?

### Priority 2: Home Tab Redesign 🟡
**Current:** Home only accessible when no agent selected + favorite set.  
**Target:** Permanent home base - always returnable to.

**Options:**
1. Click app logo/title → go home (like most apps)
2. Dedicated Home tab (already exists, but improve visibility)
3. Persistent header avatar/card

### Priority 3: Memfs Branch UI 🟡
**Goal:** Detect agent memfs-compat and show file-tree vs traditional block list.

**Components:**
- `MemfsFileTree.tsx` - already exists at `src/ui/components/MemfsFileTree.tsx`
- `MemfsFileTreeDemo.tsx` - demo component
- Need: detection logic, per-agent sync endpoint probe

### Priority 4: Provider Config Panel 🟡
**Goal:** Server-setup wizard + provider configuration.

**Subagent output exists** at task ID `a791e0752cac1fe22` - may have implementation details.

### Priority 5: Gitea Sync 🟡
- Close issues #6-#10
- Create new issue for "local mode spawn failure"
- Create new issue for "Home view redesign"
- Verify any old MASTER_TRACKING issues

---

## Key Environment Variables

For local mode with memfs, these need to be set when spawning letta-code:

```bash
# For letta-code subprocess
LETTA_BASE_URL=http://127.0.0.1:{proxyPort}  # Local proxy
LETTA_API_KEY={sessionToken}
LETTA_MEMFS_GIT_URL=https://gitea.example.com/user/repo.git  # External git
LETTA_MEMFS_GIT_TOKEN=xxx  # Git token

# For server (letta-server)
LETTA_MEMFS_SERVICE_URL=local  # Enable local memfs backing
```

---

## File Paths Reference

| What | Path |
|------|------|
| This project | `/home/casey/Projects/letta-oss-ui` |
| Letta Code (custom build with memfs) | `/home/casey/Projects/letta-code` |
| Letta Server | `/home/casey/Projects/letta-server` |
| External MemFS patches | `/home/casey/Projects/letta-external-memfs` |
| Reference app (modern patterns) | `/home/casey/Projects/letta-code-new` (if exists) |

---

## Running the App

```bash
cd /home/casey/Projects/letta-oss-ui

# Development (server mode only currently works)
bun run dev

# Build
bun run build
bun run transpile:electron

# Run built version
npx electron .
```

---

## API Service Location

`/home/casey/Projects/letta-oss-ui/src/ui/services/api.ts`
- Exports `getLettaClient()` for native Letta client
- Exports `agentsApi`, `conversationsApi`, `toolsApi`

---

## Important Notes for Next Model

1. **Bun, not Node** - See `CLAUDE.md` for Bun-specific patterns
2. **SDK 0.1.14 format** - Memory blocks use `content` field (new) or `value` (legacy)
3. **No custom wrapper APIs** - Use `@letta-ai/letta-client` directly
4. **Local mode is the blocker** - Everything else is polish or features
5. **Ask Casey for:** Path to custom letta-code binary, Gitea URL, memfs status

---

## Open Questions

1. Should the custom letta-code be:
   - Bundled with the Electron app?
   - Installed globally on the system?
   - Referenced via absolute path to Casey's dev build?

2. For memfs - what's the Gitea instance details?

3. Is there a Teams API available yet or still placeholder?

4. Should Home be a dedicated tab (current) or logo-click behavior?

---

*Last updated: 2026-04-24 by consolidation review*
