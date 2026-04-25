# letta-oss-ui — Plan

**Single source of truth** for what's being built, what's active, and what's next.
Gitea: `Fimeg/letta-oss-ui` at `http://10.10.20.120:4455`.
Architecture reference lives in `CLAUDE.md` (do not duplicate here).

---

## Current state

| Subsystem | Status | Notes |
|---|---|---|
| **API layer (SDK direct)** | 🟢 migrated 2026-04-25 | `agentsApi`/`conversationsApi`/`api` wrappers removed; consumers call `getLettaClient()` directly. See `docs/plans/MIGRATE_TO_DIRECT_SDK.md` and the "API Service Location" / "Engineering patterns" sections in `CLAUDE.md`. |
| Conversations | 🟡 basic | History loads (fixed 2026-04-24); create on first send; delete UI w/ confirm (2026-04-24); scoped per-conversation (fixed 2026-04-24) |
| Messaging / streaming | 🟢 verified working | `client.conversations.messages.create()` with stream flags; `useMessageHistory.transformMessage` maps `message_type` → UI `type` shape (2026-04-24) — flash-and-vanish bug fixed. **Verified on server mode 2026-04-25**: agent replies persist. |
| Top-tab navigation | 🟢 reshaped 2026-04-25 | Teams promoted to a takeover surface (own header, "Back to ADE" button). ADE header has the brand stack with connection status snug under it. Teams launcher button replaces the right-side status pill. |
| Brand | 🟢 renamed 2026-04-24 late | `package.json` name → `letta-community-ade`; `electron-builder.json` appId → `com.letta.community-ade`, productName → `Letta Community ADE`; HTML title + in-app header already matched |
| Letta Teams | 🟡 stub | `TeamsView.tsx` placeholder lives at full takeover surface (2026-04-25); real backend wiring pending |
| **Home / Favorite Agent** | 🟢 wired 2026-04-25 | Eagerly loads the favorite agent so dashboard has real data (recent convs, memory pressure, status, curator health). `openFavoriteAgent(id, mode)` routes Chat → focus mode, Memory/Settings → full mode. Still buried under Home tab — top-level nav redesign separate. |
| **Focus Mode** | 🟢 shipped 2026-04-25 | Chat-only minimal surface; toggle in AgentWorkspace header; per-agent `localStorage['letta:focus-mode:{id}']`; `PanelGroup` `key` swap between focus/full to reset panel sizes. |
| **Memory: memfs detection** | 🟢 fixed 2026-04-25 | `isMemfsEnabledAgent` now has a 3-signal hierarchy: `memory.git_enabled` → `git-memory-enabled` tag → path-style block label. The "Enable memfs" button no longer falsely shows on agents with slash-labeled blocks. |
| **Memory pressure gauge** | 🟢 upgraded 2026-04-25 | Real tiktoken counts (`js-tiktoken` `cl100k_base`) replace the chars/4 estimate. Pressure ratio still uses chars (server limit unit). Display: `Tokens (cl100k)` instead of `~Tokens (est.)`. |
| **Next: Local mode + channels** | 🔴 broken | Spawning local letta-code session fails. Needs debugging: path resolution, binary detection, or SDK spawn mechanics |
| Memory | 🟢 working | Curator health, sacred blocks, archival CRUD; pressure gauge upgraded to tiktoken |
| Agents | 🟢 working | List / detail / edit / delete; creation wizard wired in `App.tsx` (2026-04-24); config form now pre-populates (was reading a non-existent `detail.raw` field); welcome hero added to browser 2026-04-24 late |
| Slash commands | 🟢 working | `/doctor /clear /remember /recompile` via native client |
| Settings (per-agent) | 🟢 working | All fields present (Identity/Inference/Generation/Reasoning/Behavior/Info) incl. Chat nickname (2026-04-24). Save path functional post `raw` fix. |
| Settings (global) | 🟡 basic | `SettingsPanel.tsx`; server-setup wizard + provider panel pending |
| Electron | 🟡 dev-only | `bun run dev` works; builds as "Letta Community ADE" now; **local mode spawn broken** — letta-code local session fails to start |
| Connection mode | 🟢 working | Local/server toggle styled in AgentWorkspace header (hidden in focus mode) |

---

## Active work

| Gitea # | Title | Status | Next concrete step |
|---|---|---|---|
| — | Memory block management — memfs vs traditional | 🟡 partial | Detection fixed (3-signal hierarchy in `isMemfsEnabledAgent`); UI already branches blocks-vs-files toggle. Remaining: explicit "traditional" mode polish (no slash-paths editor) for non-memfs agents. |
| — | Home as permanent top-level nav | ⛔ deferred | Currently Home tab. User vision: persistent "home base" reachable from anywhere. Options listed in "Next session focus" below. |
| — | Save-diff preview on settings | 🟡 in `AgentWorkspace.tsx` | Modal scaffolded; needs polish |
| — | Server-setup wizard modal | subagent output saved (`a791e0752cac1fe22`) | Implement from that output |
| — | Provider config panel | subagent output (unverified) | Audit output; may need re-spec |

---

## UI/UX punch list (2026-04-25 — session 5 walkthrough feedback)

User did a hands-on pass after the messaging fix. Overall verdict: shaping up well. Items below are grouped by surface; status markers indicate whether the item is a bug, polish, missing logic, or design decision.

### Messaging
- 🐛 **First-send display lag** — first user message doesn't render until the agent reply lands, then both snap in together. Reply itself works. Likely a render-order / optimistic-add issue in `useStreamingMessages` or `useMessageHistory`.
- 🐛 **Scroll lock during agent turns** — while the agent is replying, scrolling in the message list is locked; user can't scroll back through history until the agent finishes all of its turns. Likely an auto-scroll-to-bottom effect that doesn't release on user-initiated scroll, or a re-render that snaps scroll position back on each chunk. Should detect user scroll-up and pause auto-stick until they hit bottom again.

### Agent Detail Panel (right side)
- ✅ **Delete Agent button too visually significant** — demoted to subtle text link with icon in AgentWorkspace left panel (2026-04-25).
- 🎨 **Element overlap** — minor UI overlaps in several spots, more visible in focus vs regular sizing transitions. Audit constraints.
- ✅ **Redundant info** — removed duplicate model badge in AgentWorkspace header (2026-04-25).
- ❓ **"Protect" button on memory blocks / MemFS** — verified: currently localStorage-only (not synced to server). Label updated to "Protected", tooltip clarifies limitation (2026-04-25). Needs server-side enforcement.
- ✅ **"Sources" section is undefined** — removed from AgentMemoryPanel tabs (2026-04-25). Can be re-added when properly spec'd.
- ✅ **Agent ID and Server URL don't belong in the side panel** — Agent ID moved to compact display under agent name in workspace header (2026-04-25). Side panel footer simplified.
- 🎨 **Sizing consistency** — focus mode vs regular sizing inconsistency causes the minor overlaps; tighten the constraints.

### Settings page (per-agent)
- 🎨 **Too long, single-scroll** — break into sections; vertical tabs are a strong candidate.
- ✅ **Memory edits need a confirmation step** — added ConfirmDialog to AgentMemoryPanel before overwriting blocks (2026-04-25). Shows character count diff.
- 🎨 **Memory edit UI needs polish** — cleaner layout, clearer affordances.

### Providers
- 🔧 **Full rebuff needed** — currently can't properly edit, create, or switch between providers. Need a real CRUD panel for providers + their settings.

### Companion / Favorite Agent
- ✅ **Stays its own dedicated section** (confirmed design call) — will gain more options over time; do not absorb into another surface.
- 🆕 **Messages need user identity** — agent (and UI) should know the user's name/nickname so messages can address them and the agent prompt can use it.

### Letta-code workflow integration
- 🆕 **"Atmospheres"** — new feature added to the letta-code matrix channel. Want this surfaced as a workflow option in the UI. Need spec from matrix channel before implementing.

### Working well (acknowledgments)
- 🟢 **Local env section** — keep as-is.
- 🟢 **Overall progress** — direction is right; next pass is componentization + visual consistency.

---

## Recently shipped (today)

**SDK Refactor (2026-04-24 earlier):**
- Eliminated `chatApi` wrapper — now calling SDK directly via hooks
- `useStreamingMessages.ts` — agent-scoped streaming (`client.agents.messages.create`)
- `useMessageHistory.ts` — conversation-scoped history (`client.conversations.messages.list`)
- `useAppStore.ts` — fixed dual message state, added AbortController for race conditions
- `AgentWorkspace.tsx` — thin UI layer consuming hooks

**Session 2 (2026-04-24 late):**
- **P0 flash-and-vanish fix** — `useMessageHistory.transformMessage` was passing raw SDK `AssistantMessage` / `ToolCallMessage` / `ToolReturnMessage` objects straight through as `StreamMessage`. Those have `message_type: "assistant_message"` etc., but `EventCard` switches on `type: "assistant"` — so every assistant/tool message hit `default: return null` and rendered as nothing. Only user messages survived because they were explicitly transformed. Now every `message_type` is mapped to the SDKMessage `type` shape the UI renders.
- **Rebrand Cowork → Letta Community ADE** — `package.json` name, `electron-builder.json` appId + productName. HTML `<title>` and in-app header were already correct.
- **Top-tab navigation fix** — `App.tsx:renderMainContent` now respects `activeTab`; Agents/Teams/Models/Settings tabs actually swap content when clicked from inside an agent. Returning to Agents tab restores the active workspace.
- **Letta Teams tab stub** — `TeamsView.tsx` placeholder with a "Coming soon" card so the nav slot is reserved. `TopTab` type in the store extended to `'agents' | 'teams' | 'models' | 'settings'`.
- **AgentsBrowser welcome hero** — soft gradient banner above the search bar when not searching and agents exist: "Your Agents" + count + one-line framing.

**Session 3 (2026-04-25):**
- **P0 verified** — messaging fix confirmed working on server mode; agent replies persist after stream ends
- **Favorite Agent / Home view v1** — `FavoriteAgentView.tsx` with contact card, health monitors (memory pressure, curator, last activity), stats grid, schedule card, recent conversations. `favoriteAgentId` persisted to localStorage. Star button on agent cards to set/unset favorite.
- **Issue found**: Home view only accessible when Agents tab active + no agent selected. Needs redesign as permanent top-level surface.

**Session 4 (2026-04-25 late) — direct-SDK migration + dashboard wiring + focus mode:**
- **Direct SDK migration** — removed `agentsApi`/`conversationsApi`/`api` wrapper objects from `src/ui/services/api.ts`. All consumers (store, hooks, components, slash commands) now call `getLettaClient()` directly. Plan + execution log: `docs/plans/MIGRATE_TO_DIRECT_SDK.md`.
- **Memfs detection fixed** — `isMemfsEnabledAgent` gained a third fallback signal: any block label containing `/`. Agents with slash-labeled blocks no longer show a phantom "Enable memfs" button. Updated tooltip copy.
- **Pressure gauge → tiktoken** — installed `js-tiktoken`, added `src/ui/utils/tokens.ts` with lazy `cl100k_base` encoder. `calculateMemoryHealth` now produces real per-block `tokens` + `totalTokens`; `MemoryPressureGauge` displays them. Pressure ratio still uses chars (server limit semantics).
- **Header reshape — Teams as takeover** — connection status moved snug under the "Letta Community ADE" brand mark. Teams is no longer a peer tab; it's a takeover surface with its own header + "Back to ADE" button. Teams launcher promoted to a primary action button on the right of the ADE header.
- **Favorite Agent buttons wired** — `App.tsx` eagerly loads the favorite agent so dashboard health/conversations/pressure are real numbers (not zeros). `openFavoriteAgent(id, mode)` routes Chat → focus mode, Memory/Settings → full mode.
- **Focus Mode shipped** — toggle button in `AgentWorkspace` header; collapses to chat-only with reduced chrome. Per-agent `localStorage['letta:focus-mode:{id}']`. PanelGroup gets a `key` swap between focus/full so panel sizes don't bleed.
- **Docs touched (this commit)** — `CLAUDE.md` got new sections "Engineering patterns established" + memfs detection hierarchy + token-counting note. API service location section rewritten to reflect post-migration shape.

**Session 5 (2026-04-25 continued) — side panel cleanup + messaging fixes:**
- **Delete Agent demoted** — changed from prominent red-bordered button to subtle text link with trash icon in AgentWorkspace left panel.
- **Agent ID relocated** — moved from side panel footer to compact "ID: xxx" display under agent name in workspace header; removed redundant model badge.
- **Sources tab removed** — undefined "Sources" placeholder tab removed from AgentMemoryPanel (can be re-added when properly spec'd).
- **Protect button clarified** — verified it's localStorage-only (not server-enforced). Updated labels from "Sacred" to "Protected", improved tooltips to clarify limitation.
- **Memory edit confirmation** — added ConfirmDialog before overwriting memory blocks; shows original vs new character count.
- **Messaging scroll-lock fix** — changed smooth→auto scroll behavior, added wheel/touch listeners to release auto-stick on user scroll-up.
- **First-send optimistic message** — added pendingUserMessage state so user's first message appears immediately while streaming, instead of waiting for refetch.
- **Companion navigation fix** — added atomic `navigateToAgent` store action to ensure tab switching works reliably from Home dashboard.

---

## Backlog

| Gitea # | Title | Blocking | Notes |
|---|---|---|---|
| **#3** | Agent Teleport (deploy to channel) | needs #1 + community-ade E | `DeployModal.tsx` scaffolded |
| **#4** | Electron App Overhaul | needs #1 | CSP, IPC validation, config dir, SQLite session store, auto-update, signing |
| — | Favorite Agent front page — "Ani Everything" style | new ask 2026-04-24 | Front page (or prominent surface on the Agents tab) for the user's favorite/personal agent: image contact card, buddy health monitors, schedules, etc. Reference UI: `~/Projects/ani-everything-page` (Vite + React + Tailwind). Implies: persist a "favorite agent" per user; health = derived from memory-pressure + last-activity + curator health; schedules = new surface, likely ties into sleeptime or cron-style triggers. Fine to delegate segments to subagents once the overall shape is decided. |
| — | Letta Teams integration (replace stub) | pending backend | Real wiring when the Teams API lands — multi-agent coordination, shared memory scoped to team, team-lead routing, role prompts + hand-off rules. Stub placeholder lives at `src/ui/components/TeamsView.tsx`. |
| — | `/wrapup` for stale conversations | new idea | For convs idle ≥ 2 weeks, offer user a reflection pass: summarize, extract durable facts into memory blocks/archival, then optionally close. Needs: staleness detector, reflection prompt, targeted memory writes, user-approval step. |
| — | Local mode with node discovery | future | Detect running Letta instances first; else a separate config flow for fresh local setup (letta server + channels). Mirror the node discovery pattern in letta-code-new. |
| — | Richer agent cards | new ask 2026-04-24 | AgentsBrowser cards could surface last-activity timestamp, conversation count, attached memory-block count, and a status dot. Non-urgent polish but called out by Casey. |

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

## Next Session Focus

### Priority 1: Redesign Favorite Agent / Home as permanent top-level nav
**Current state (2026-04-25)**: Home tab exists; the favorite agent dashboard renders there with real data (eager load wired). The Chat/Memory/Settings buttons route correctly via `openFavoriteAgent(id, mode)`. **Still buried** behind the Home tab — user vision is a "home base" reachable from anywhere.

**Target design**: User can ALWAYS return to their "home base" — the favorite agent dashboard — regardless of what tab they're on or what they're doing. Options:
1. **Persistent "Home" button in header** — always-visible avatar + name that opens home view (preferred — minimal visual cost, max accessibility)
2. **Clicking the app logo/title returns home** — like most apps
3. **Favorite agent card pinned to sidebar** — if we add a sidebar nav
4. **Dedicated "Home" tab** — current state; works but easy to lose

**Decision needed**: Pattern 1 + 2 in combination is probably right. Pattern 1 is the explicit affordance, pattern 2 is the discoverable shortcut.

### Priority 2: Debug local mode spawn
**Current**: Server mode works (verified). Local mode (spawning letta-code) fails silently or errors.

**Debug steps**:
1. Check if `letta-code` binary is in PATH
2. Check how SDK spawns the process (`createSession` in letta-code-sdk)
3. Verify the spawn command and working directory
4. Check IPC bridge between Electron main and renderer for local session

### Priority 3: Richer agent cards (from v1 — shipped)
Status: **Complete**. Cards now show:
- Status dot (Active/Idle/Stale based on last run)
- Last run relative time (or created time for new agents)
- Tool count
- Star button for setting favorite
- Better layout with min-height for consistent sizing

### Priority 4: Gitea sync
Current open items on `Fimeg/letta-oss-ui` at `http://10.10.20.120:4455` need updating:
- Close any issues fixed by P0 messaging fix
- Create/update issue for Favorite Agent redesign
- Create issue for local mode spawn failure (if not already)
- Verify #6, #7, #8, #9, #10 status vs. current codebase

### Priority 5: Clear out remaining active-work
1. **Save-diff preview on settings** 🆕 — modal scaffolded in `AgentWorkspace.tsx`, needs polish
2. **Server-setup wizard modal** 📝 — subagent output exists at `a791e0752cac1fe22`
3. **Provider config panel** 📝 — may need re-spec
4. **`/wrapup` for stale conversations** 💡 — new feature

### Priority 6: Verify migration runtime behavior
The direct-SDK migration is type-clean but the build wasn't run. Before relying on it, manual smoke-test:
- Agent loads with memory blocks visible
- Memfs file tree populates for an enabled agent
- Memory pressure gauge shows non-zero tokens
- Conversations load and messages send
- Settings save with diff preview
- Slash commands (`/doctor /clear /remember /recompile`) all run
- Tool attach/detach from workspace + wizard
- Models list in settings + wizard

Most failures here are likely to be SDK shape edge cases (e.g. the model
normalization helper handling missing fields). If something breaks, check
`docs/plans/MIGRATE_TO_DIRECT_SDK.md` "SDK Method Mapping Reference".

---

## Working notes

- **The four reference projects** (see `CLAUDE.md`): letta-code-sdk 0.1.14, this repo (0.0.5 base), letta-code-new (modern reference), letta server 0.16.7.
- **No custom wrapper APIs** — use `@letta-ai/letta-client` directly.
- **Gitea token** in `MASTER_TRACKING.md` (moving to archive); keep in env, not this file.
- When closing issues, link the shipping commit or code path in the close comment so the trail survives.
- **Messaging refactor complete but unverified** — next session must test and fix if needed.

---

*Last updated: 2026-04-25 (session 4 — direct-SDK migration, focus mode, dashboard wiring, docs sync)*
