# letta-oss-ui — Plan

**Single source of truth** for what's being built, what's active, and what's next.
Gitea: `Fimeg/letta-oss-ui` at `http://10.10.20.120:4455`.
Architecture reference lives in `CLAUDE.md` (do not duplicate here).

---

## Current state

| Subsystem | Status | Notes |
|---|---|---|
| Conversations | 🟡 basic | History loads (fixed 2026-04-24); create on first send works; delete UI not built |
| Messaging / streaming | 🟢 working | Native `client.agents.messages.stream`; tool/reasoning messages render |
| Memory | 🟢 working | Curator health, sacred blocks, archival CRUD; visuals are basic bars |
| Agents | 🟡 partial | List / detail / edit / delete work; **creation wizard scaffolded but not integrated** |
| Slash commands | 🟢 working | `/doctor /clear /remember /recompile` via native client |
| Settings | 🟡 basic | `SettingsPanel.tsx`; server-setup wizard + provider panel pending |
| Electron | 🟡 dev-only | `npm run dev` works; no hardening, auto-update, or signing |
| Connection mode | 🟢 working | Local/server toggle styled in AgentWorkspace header |

---

## Active work

| Gitea # | Title | Status | Next concrete step |
|---|---|---|---|
| — | Conversation delete UI | store+API done | Add trash button + confirm modal in AgentWorkspace conv dropdown |
| — | Memory pressure gauge | `MemoryPressureBar.tsx` (43 lines, linear) | Circular SVG gauge + token-count estimate beside it |
| — | Server-setup wizard modal | subagent output saved (`a791e0752cac1fe22`) | Implement from that output |
| — | Provider config panel | subagent output (unverified) | Audit output; may need re-spec |
| **#10** | Agent creation wizard | Components in `src/ui/components/agents/` | Integrate into `App.tsx`; add "New Agent" trigger in `Sidebar` / `AgentsBrowser`; verify `agentsApi.listAllModels()` |

---

## Backlog

| Gitea # | Title | Blocking | Notes |
|---|---|---|---|
| **#3** | Agent Teleport (deploy to channel) | needs #1 + community-ade E | `DeployModal.tsx` scaffolded |
| **#4** | Electron App Overhaul | needs #1 | CSP, IPC validation, config dir, SQLite session store, auto-update, signing |

Stream-level epics from the old `MASTER_TRACKING.md` (`#1` SDK migration, `#2` 3-pane UI, `#5` community-ade integration) don't appear in current open Gitea. Needs verification — they may have been closed or never created.

---

## Recently shipped (close on Gitea)

- **#6** Slash commands — see `src/ui/services/slashCommands.ts`
- **#7** Curator health + sacred blocks — `memoryHealth.ts`, `useSacredBlocks.ts`, `SacredToggle.tsx`
- **#8** Archival memory management — integrated in `AgentMemoryPanel.tsx`
- **#9** Connection mode indicator — `ConnectionModeIndicator.tsx`

---

## Archive

Retired planning docs (do not edit; reference only):

- `docs/archive/MASTER_TRACKING.md` — original 5-stream epic plan (2026-04-23)
- `docs/archive/HANDOFF.md` — 2026-04-23 snapshot after feature-port sprint
- `docs/archive/SUBAGENT_TASK_*.md` — one-shot subagent briefs
- `docs/archive/OPUS_PROMPT_MEMORY_EDITING.md`, `docs/archive/PROMPT_FOR_CLAUDE.md` — handoff prompts

---

## Working notes

- **The four reference projects** (see `CLAUDE.md`): letta-code-sdk 0.1.14, this repo (0.0.5 base), letta-code-new (modern reference), letta server 0.16.7.
- **No custom wrapper APIs** — use `@letta-ai/letta-client` directly.
- **Gitea token** in `MASTER_TRACKING.md` (moving to archive); keep in env, not this file.
- When closing issues, link the shipping commit or code path in the close comment so the trail survives.

---

*Last updated: 2026-04-24*
