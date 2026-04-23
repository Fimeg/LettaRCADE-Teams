# Universal Mega App — Master Tracking

**Vision:** The ultimate self-hosted Letta ADE — 3-pane UI, agent teleport, full 0.16.7 compatibility  
**Manager:** Claude (recursive subagent coordinator)  
**Repository:** `Fimeg/letta-oss-ui`  
**Gitea:** http://10.10.20.120:4455  
**Token:** `cfc7e6dc0f4323d6d3e608c15c2b41eb4c7b4073`

---

## Epic Issues (Gitea)

| # | Title | Status | Effort | Priority |
|---|-------|--------|--------|----------|
| #1 | SDK 0.0.5 → 0.1.14 Migration | 🆕 Open | 15 days | CRITICAL |
| #2 | 3-Pane UI Layout | 🆕 Open | 16 days | HIGH |
| #3 | Agent Teleport | 🆕 Open | 20 days | HIGH |
| #4 | Electron App Overhaul | 🆕 Open | 25 days | MEDIUM |
| #5 | community-ade Integration | 🆕 Open | 12 days | HIGH |

**Total Effort:** ~88 days (18 weeks)  
**Parallelizable:** SDK + 3-Pane can run concurrently  

---

## Work Streams

### Stream A: SDK Migration (Blocked by none)
**Goal:** Update all SDK calls from 0.0.5 to 0.1.14 patterns  
**Issue:** #1  
**Subtasks:**
- [ ] runner.ts — Update streaming to `agents.messages.createStream()`
- [ ] useAppStore.ts — Memory block handling (`content` vs `value`)
- [ ] EventCard.tsx — Block rendering
- [ ] Sidebar.tsx — Agent management
- [ ] types.ts — Re-export new SDK types
- [ ] IPC message types — Update for new SDK events

**Subagent spawn pattern:**
```
Agent({
  description: "Update runner.ts streaming",
  prompt: "Read OSS_UI_STRUCTURE.md. Update runner.ts to use agents.messages.createStream()...",
  model: "sonnet",
  subagent_type: "feature-dev:code-architect"
})
```

---

### Stream B: 3-Pane UI (Blocked by none, needs Stream A for data)
**Goal:** Transform 2-pane → 3-pane layout  
**Issue:** #2  
**Subtasks:**
- [ ] Create AgentDetailPanel component
- [ ] Create MemoryBlockEditor component
- [ ] Create ToolManager component
- [ ] Add resizable panel system
- [ ] Update Zustand store with `selectedAgentId`
- [ ] Wire agent selection to detail panel
- [ ] Real-time memory sync via WebSocket

---

### Stream C: Agent Teleport (Blocked by Stream A + E)
**Goal:** Deploy agents to any channel with click  
**Issue:** #3  
**Subtasks:**
- [ ] UI: Deploy button + channel selector modal
- [ ] UI: Channel health indicators
- [ ] Backend: Channel adapter registry (in community-ade)
- [ ] Backend: Runtime binding API
- [ ] Integration: Spawn letta-code processes
- [ ] Integration: Multi-channel message routing

---

### Stream D: Electron Overhaul (Blocked by Stream A)
**Goal:** Production-ready desktop app  
**Issue:** #4  
**Subtasks:**
- [ ] SDK 0.1.14 upgrade
- [ ] Security hardening (CSP, IPC validation)
- [ ] Config system (~/.config/letta-code/)
- [ ] Session persistence (SQLite)
- [ ] Auto-updater
- [ ] Code signing

---

### Stream E: community-ade Integration (Blocked by none)
**Goal:** Connect backend to frontend  
**Issue:** #5  
**Status:** Backend is 0.16.7 compatible ✅  
**Subtasks:**
- [ ] Expose REST API routes
- [ ] Expose WebSocket endpoint
- [ ] Create API client layer in frontend
- [ ] Auth integration (API keys)
- [ ] Test embedded vs external mode

---

## Recursive Subagent Management

### Manager Protocol

When you (Casey) say "Work on #X" or "Start stream Y", I will:

1. **Read current state** from Gitea issue
2. **Check dependencies** — what's blocked?
3. **Spawn subagent(s)** — parallel where safe, sequential where dependent
4. **Monitor progress** — subagents report back, I update issues
5. **Handle blockers** — escalate to you if stuck

### Subagent Types to Use

| Task Type | Agent Type | Why |
|-----------|------------|-----|
| Component design | `feature-dev:code-architect` | Plans structure |
| Implementation | `general-purpose` + `model: sonnet` | Fast execution |
| SDK migration | `claude-code-guide` | Knows patterns |
| Code review | `feature-dev:code-reviewer` | Catches issues |
| Complex debugging | `feature-dev:code-explorer` | Deep analysis |

### Check-In Pattern

Every subagent completes with:
1. **What was done** (files modified)
2. **Status** (✅ Done / ⚠️ Partial / ❌ Blocked)
3. **Next steps** (what depends on this)
4. **Issues to update** (Gitea references)

---

## Current State Snapshot

### Completed (Today)
- ✅ Community-ADE backend fixed for 0.16.7 (5 commits)
- ✅ OSS-UI structure analyzed (OSS_UI_STRUCTURE.md)
- ✅ Electron app analyzed (ELECTRON_ANALYSIS.md)
- ✅ Hacked app documented (HACKED_ASAR_DIFF.md — "futuristic examples")
- ✅ 5 Epic issues created in Gitea

### Ready to Start
- Stream A: SDK migration — all files mapped
- Stream B: 3-Pane — layout planned
- Stream E: Integration — backend ready

### Blocked
- Stream C: Teleport — needs Stream A + E
- Stream D: Electron — needs Stream A

---

## Quick Commands

```bash
# Check issue status
curl -s 'http://10.10.20.120:4455/api/v1/repos/Fimeg/letta-oss-ui/issues?state=open' \
  -H 'Authorization: token cfc7e6dc0f4323d6d3e608c15c2b41eb4c7b4073' | \
  jq -r '.[] | "\(.number): \(.title) [\(.state)]"'

# Update issue
curl -X PATCH 'http://10.10.20.120:4455/api/v1/repos/Fimeg/letta-oss-ui/issues/1' \
  -H 'Authorization: token cfc7e6dc0f4323d6d3e608c15c2b41eb4c7b4073' \
  -H 'Content-Type: application/json' \
  -d '{"state": "closed"}'

# View full issue
curl -s 'http://10.10.20.120:4455/api/v1/repos/Fimeg/letta-oss-ui/issues/1' \
  -H 'Authorization: token cfc7e6dc0f4323d6d3e608c15c2b41eb4c7b4073' | jq .
```

---

## Decision Log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-04-23 | Use letta-oss-ui as base, not community-ade UI | OSS has better foundation, just needs overhaul |
| 2026-04-23 | Keep community-ade as backend API | Now 0.16.7 compatible, good architecture |
| 2026-04-23 | Hacked app = reference only | Not a foundation, just "futuristic examples" |
| 2026-04-23 | Parallel streams A+B+E | Can run concurrently, minimal dependencies |

---

## What to Say to Start Work

**"Start Stream A"** → I spawn subagents for SDK migration  
**"Work on #3"** → I check if unblocked, spawn teleport subagents  
**"Status"** → I check all Gitea issues, report progress  
**"Unblock Stream C"** → I check dependencies, spawn what's ready  

---

*Last updated: 2026-04-23*  
*Manager: Claude Code*  
*Goal: Universal Mega App*
