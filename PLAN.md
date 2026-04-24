# letta-oss-ui — Plan

**Single source of truth** for what's being built, what's active, and what's next.
Gitea: `Fimeg/letta-oss-ui` at `http://10.10.20.120:4455`.
Architecture reference lives in `CLAUDE.md` (do not duplicate here).

---

## Current state

| Subsystem | Status | Notes |
|---|---|---|
| Conversations | 🟡 basic | History loads (fixed 2026-04-24); create on first send; delete UI w/ confirm (2026-04-24); scoped per-conversation (fixed 2026-04-24) |
| Messaging / streaming | 🟢 working | Agent-scoped messaging via `useStreamingMessages` hook calling `client.agents.messages.create()` (refactored 2026-04-24 — eliminated chatApi wrapper, follows letta-code-new patterns); message history via `useMessageHistory` hook; tool/reasoning messages render |
| Memory | 🟢 working | Curator health, sacred blocks, archival CRUD; visuals are basic bars |
| Agents | 🟢 working | List / detail / edit / delete; creation wizard wired in `App.tsx` (2026-04-24); config form now pre-populates (was reading a non-existent `detail.raw` field) |
| Slash commands | 🟢 working | `/doctor /clear /remember /recompile` via native client |
| Settings (per-agent) | 🟢 working | All fields present (Identity/Inference/Generation/Reasoning/Behavior/Info) incl. Chat nickname (2026-04-24). Save path functional post `raw` fix. |
| Settings (global) | 🟡 basic | `SettingsPanel.tsx`; server-setup wizard + provider panel pending |
| Electron | 🟡 dev-only | `npm run dev` works; no hardening, auto-update, or signing |
| Connection mode | 🟢 working | Local/server toggle styled in AgentWorkspace header |

---

## Active work

| Gitea # | Title | Status | Next concrete step |
|---|---|---|---|
| — | Memory block management — memfs vs traditional | ⛔ not started | Detect agent memfs-compat from agent config; branch editor UI (memfs file-tree vs traditional block list) |
| — | Save-diff preview on settings | 🆕 new ask | Before applying, show "You're changing X from A to B" diff modal (user said "might add later") |
| — | Server-setup wizard modal | subagent output saved (`a791e0752cac1fe22`) | Implement from that output |
| — | Provider config panel | subagent output (unverified) | Audit output; may need re-spec |

---

## Recently shipped (today)

**SDK Refactor (2026-04-24):**
- Eliminated `chatApi` wrapper — now calling SDK directly via hooks
- `useStreamingMessages.ts` — agent-scoped streaming (`client.agents.messages.create`)
- `useMessageHistory.ts` — conversation-scoped history (`client.conversations.messages.list`)
- `useAppStore.ts` — fixed dual message state, added AbortController for race conditions
- `AgentWorkspace.tsx` — thin UI layer consuming hooks |

---

## Backlog

| Gitea # | Title | Blocking | Notes |
|---|---|---|---|
| **#3** | Agent Teleport (deploy to channel) | needs #1 + community-ade E | `DeployModal.tsx` scaffolded |
| **#4** | Electron App Overhaul | needs #1 | CSP, IPC validation, config dir, SQLite session store, auto-update, signing |
| — | `/wrapup` for stale conversations | new idea | For convs idle ≥ 2 weeks, offer user a reflection pass: summarize, extract durable facts into memory blocks/archival, then optionally close. Needs: staleness detector, reflection prompt, targeted memory writes, user-approval step. |

Stream-level epics from the old `MASTER_TRACKING.md` (`#1` SDK migration, `#2` 3-pane UI, `#5` community-ade integration) don't appear in current open Gitea. Needs verification — they may have been closed or never created.

---

## Settings schema (target for agent settings panel)

**Identity** — Name, Description, Tags (comma-separated)
**Inference** — Model (`provider/model-name`), Endpoint (custom API URL), Embedding, Generation, Context Window, Max Tokens, Freq. Penalty (-2.0 to 2.0), Parallel Tools
**Reasoning** — Reasoner, Max Reasoning Tokens, Effort
**Behavior** — Sleeptime, Autoclear Buffer
**Info (read-only)** — Agent ID, Created, Last Run, Ctx Window (model), Endpoint Type

Current `AgentWorkspace` Config tab covers most of the editable fields. Missing: Tags, Endpoint URL, separate Generation field, Endpoint Type (read-only), the Info block.

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
