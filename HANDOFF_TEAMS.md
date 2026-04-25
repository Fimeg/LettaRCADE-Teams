# Letta-Teams handoff

For Vedant — owner of the Letta-Teams integration in this app.

The Teams slot is wired and empty, waiting on you. This doc points at the seams, lists what's deliberately untouched, and flags the conventions in this codebase so your work fits without us having to rewrite it later.

Read `CLAUDE.md` first — it has the architectural truth (the four reference projects, the SDK patterns, "Engineering patterns established"). This doc is the supplement.

---

## TL;DR

- `src/ui/components/TeamsView.tsx` is a pure presentational stub. Replace its contents — nothing else needs to move for the slot to work.
- Nav, takeover header, and "Back to ADE" button are already wired around `activeTab === 'teams'`. Don't refactor the shell unless you have a reason.
- The earlier integration plan you've already seen is **draft, not adopted**. Revise or replace as you see fit.
- Conventions in this repo are stricter than they look at first glance — read the "Conventions to keep" section before laying out new files.

---

## Where things sit

### The Teams slot (fill it; don't refactor it)

| File | Purpose | What you do |
|---|---|---|
| `src/ui/components/TeamsView.tsx` | The slot | Replace contents |
| `src/ui/App.tsx` (around `isTeamsMode`) | Takeover header + Back button | Modify only if you need different chrome |
| `src/ui/store/useAppStore.ts` (`TopTab` type) | `'teams'` already a member | No change needed |
| Header launcher button in `App.tsx` | Routes to teams | Already wired |

### Shared state your work will read

- `useAppStore.operatorProfile` (`OperatorProfileData | null`) — single-operator-per-install profile. Display name, optional memfs git URL template. Use this for any "who is the human" copy.
- `useAppStore.agentList` / `useAppStore.agents` — agents available to compose into teams. Subscribe to the store; don't re-fetch your own copy.
- `useAppStore.serverConnected` — boolean / null. Read for connection-aware UI.

### Backend access

- **Native Letta client only**: `getLettaClient()` from `src/ui/services/api.ts`. Direct SDK calls. **Do not** introduce a `teamsApi` wrapper object — the previous wrapper layer was ripped out in 2026-04-25; see `CLAUDE.md` "API Service Location" for the rationale.
- Reference projects are documented in `CLAUDE.md`. The hacked `letta-code-new` is the modern SDK pattern reference; the published `@letta-ai/letta-code-sdk` 0.1.14 is the second-best.
- If Teams requires a daemon supervisor, `src/electron/letta-code-manager.ts` is the established pattern (spawn → emit status → emit log → broadcast to renderer). Mirror its shape; don't blend Teams logic into it.

---

## Conventions to keep

These aren't suggestions — they're load-bearing. Past PRs that violated them got reworked.

1. **Direct SDK, no wrappers.** Inline the SDK call at consumers. If 3+ sites need identical shape normalization, add a small free function in `src/ui/services/api.ts`. No `agentsApi`/`teamsApi`-style objects.
2. **Single-human-per-install ceiling.** No login, no multi-user table, no workspace-per-user, no role-switching. One operator profile per install — already in the store. If a design draft introduces user IDs, pull back.
3. **Direct fields over flattened mirrors.** `agent.raw` carries the full SDK `AgentState` response. Cast with a narrow shape and read fields directly. Don't introduce parallel typed copies of fields that already live on `raw`.
4. **localStorage seam for cross-component coordination.** Per-entity keys (`letta:focus-mode:{agentId}` etc.). Read with `useState` initializer + `useEffect` keyed on the id so re-navigation re-syncs. See `CLAUDE.md` "Engineering patterns established."
5. **Server unit for math, display unit for UI.** Memory block `limit` is characters server-side; tokens are display-only. Don't mix.
6. **No backwards-compat shims, no `// removed` comments, no `_var` placeholders for unused things.** If something is unused, delete it.
7. **Direct, narrow component code.** Default to no comments. Add one only when WHY is non-obvious. Don't write what the code already says.

---

## Decisions that are explicitly yours

The integration plan doc takes positions on these. They're plausible but not committed. Pick once and stay consistent.

- **Store split.** Plan proposes a separate `useTeamsStore`. Current convention is one big `useAppStore`. Either is acceptable. If Teams state is heavy and orthogonal, separate; if it overlaps significantly with agent state, integrate.
- **IPC organization.** Existing handlers register directly in `src/electron/main.ts`. If Teams needs many handlers, a dedicated `src/electron/teams-ipc.ts` is reasonable. Either way, the type seam belongs in `types.d.ts` (`EventPayloadMapping` + `Window.electron`).
- **Daemon vs. in-process.** Plan assumes a Teams daemon spawned by Electron main. If the Teams API can be called directly from the SDK, in-process is simpler. Up to you.
- **Routing model.** Teams is currently a takeover surface (full screen, own header). If you need sub-routes inside Teams (team detail, conversation, settings), pick a routing approach (URL hash, store-driven, etc.) and document it in this doc.

---

## Don't touch (yet)

- `src/electron/letta-code-manager.ts` — letta-code subprocess supervisor. Reference for shape, not a target.
- `src/electron/proxy-server.ts` — agent traffic proxy. Out of scope.
- `useAppStore.handleServerEvent` — letta-code streaming pipeline. Teams gets its own event seam.
- `src/electron/operatorProfile.ts` and the `operator-profile:*` IPC handlers — single-operator gate. Read it; don't extend it.

---

## Where to start

1. Read `CLAUDE.md` end-to-end.
2. Skim `PLAN.md` "Recently shipped," "Active work," and "Backlog."
3. Replace `TeamsView.tsx` with a real surface. Take whichever incremental path fits — empty list → mock data → real backend.
4. Open issues on the repo for anything Casey should weigh in on. Anything you decide alone, just decide and ship.

---

## Sync

Repo lives on GitHub (private; in process of being set up) and on Casey's Gitea (`http://10.10.20.120:4455/Fimeg/letta-oss-ui`). Casey keeps them in sync. Push to whichever you have credentials on; flag drift if you spot it.

---

*Last updated: 2026-04-25 — initial Teams handoff.*
