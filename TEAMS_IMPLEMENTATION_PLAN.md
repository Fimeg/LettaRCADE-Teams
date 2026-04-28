# Teams Integration Plan

**Audience:** the main agent working in this Electron app  
**Context:** replace the current `TeamsView` placeholder with a real Letta Teams integration that fits this repo's existing patterns.

---

## Source docs reviewed

This plan is based on the current repo state plus these project docs:

- `HANDOFF_TEAMS.md`
- `LETTA_TEAMS_INTEGRATION_PLAN.md`
- `CLAUDE.md`
- `STATUS.md`
- current implementation seams in:
  - `src/ui/App.tsx`
  - `src/ui/components/TeamsView.tsx`
  - `src/ui/store/useAppStore.ts`
  - `src/ui/services/api.ts`
  - `src/electron/main.ts`
  - `src/electron/preload.cts`
  - `types.d.ts`
  - `src/ui/vite-env.d.ts`

---

## Executive summary

The older `LETTA_TEAMS_INTEGRATION_PLAN.md` is useful background, but it should **not** be treated as the implementation source of truth for this repo.

The current app architecture points to a simpler approach:

1. Keep `src/ui/components/TeamsView.tsx` as the Teams entry slot.
2. Use **`letta-teams-sdk` in the Electron main process**.
3. Expose a **thin typed IPC bridge** to the renderer.
4. Add a **dedicated `useTeamsStore`** for Teams-only state.
5. Build an **MVP first**: daemon/runtime status, teammate list, spawn, task list, dispatch, refresh.
6. Defer council/workflow/visualization features until the basic integration is working.

---

## Hard constraints from this repo

### 1. Teams lives inside `TeamsView.tsx`
The shell is already wired:

- `activeTab === 'teams'`
- Teams takeover header
- “Back to ADE” button
- `TopTab` already includes `'teams'`

Do not redesign the shell unless there is a real need.

### 2. No `teamsApi` wrapper layer
This repo explicitly prefers direct SDK usage and thin helpers over service-wrapper objects.

That means:

- do **not** add `src/ui/services/teams-api.ts`
- do **not** recreate `agentsApi`-style abstractions
- if a tiny shared normalization helper is needed, keep it tiny and local

### 3. Single operator per install stays intact
Reuse existing operator profile flow and shared app assumptions.

Do not introduce:

- multi-user auth
- workspace-per-user state
- role-switching systems

### 4. Shared app state should stay shared
Read these from `useAppStore` instead of duplicating them:

- `operatorProfile`
- `agentList`
- `agents`
- `serverConnected`

### 5. IPC typing is a real seam here
If Teams adds IPC, update the actual typed boundaries:

- `types.d.ts`
- `src/ui/vite-env.d.ts`
- `src/electron/preload.cts`

---

## Main architecture decision

## Use `letta-teams-sdk` in Electron main, not a custom daemon/TCP stack in the renderer

The old draft plan proposed:

- manually spawning `letta-teams`
- writing a custom daemon manager
- writing a renderer -> main -> TCP bridge by hand

That is no longer the best fit.

Instead, use the already extracted SDK/runtime surface from `letta-teams-sdk` in the Electron **main** process. Let the SDK/runtime own daemon orchestration internally, and expose only the app-specific operations the renderer needs.

### Why this is the right fit

- matches the handoff direction better than the old daemon-heavy draft
- avoids rebuilding protocol logic the SDK already owns
- keeps the renderer simple
- stays aligned with this repo's “thin seams, direct usage” pattern

---

## Recommended implementation shape

### Electron main process
Add:

- `src/electron/teams-runtime.ts`
- `src/electron/teams-ipc.ts`

#### `teams-runtime.ts`
Responsibilities:

- hold a singleton Teams runtime
- configure runtime using the current Letta connection settings
- ensure daemon/runtime availability before teammate/task operations
- translate app config into the runtime's expected configuration

Important: this app has **3 connection modes** and the renderer currently owns the resolved connection choice through localStorage-backed logic in `src/ui/services/api.ts`.

So the Teams bridge must not assume main-process config alone is sufficient. It needs a way to receive the resolved connection inputs from the renderer, at minimum:

- `baseUrl`
- `apiKey`
- optionally `projectDir`

#### `teams-ipc.ts`
Responsibilities:

- register typed Teams IPC handlers
- call `teams-runtime.ts`
- return plain serializable payloads to the renderer
- normalize error responses consistently

### Preload / typing
Update:

- `src/electron/preload.cts`
- `types.d.ts`
- `src/ui/vite-env.d.ts`

Expose a narrow `window.electron.teams` surface, e.g.:

- `configure(...)`
- `daemon.getStatus()`
- `daemon.ensureRunning()`
- `teammates.list()`
- `teammates.spawn()`
- `teammates.get()`
- `teammates.reinit()`
- `tasks.list()`
- `tasks.get()`
- `tasks.dispatch()`
- `tasks.cancel()`

This should be a thin bridge, not a mini-client framework.

### Renderer state
Add:

- `src/ui/store/useTeamsStore.ts`

This store should own only Teams-specific UI state, for example:

- `daemonStatus`
- `teammates`
- `tasks`
- `selectedTeammate`
- `selectedTask`
- `loading`
- `error`
- modal state for spawn/dispatch
- actions for init, refresh, spawn, dispatch, select

Do **not** move existing ADE state into this store.

### Renderer UI
Keep `src/ui/components/TeamsView.tsx` as the app-facing entry point, but it can delegate internally to small Teams components.

Likely subtree:

- `src/ui/components/teams/TeamsSidebar.tsx`
- `src/ui/components/teams/TeamsMainPanel.tsx`
- `src/ui/components/teams/SpawnTeammateDialog.tsx`
- `src/ui/components/teams/DispatchTaskDialog.tsx`
- optional `TeamsStatusBanner.tsx`

---

## MVP scope

Build this first:

1. Teams runtime/daemon status
2. teammate list
3. spawn teammate
4. task list
5. dispatch task to a teammate
6. refresh/poll status while the Teams tab is open
7. basic detail panes for selected teammate/task

This is enough to prove the integration, validate the SDK boundary, and give the user a working Teams surface.

---

## Explicit non-goals for the first pass

Do **not** start with:

- council UI
- workflow graphs
- advanced visualization
- deeply nested routing inside Teams
- a custom TCP client in the renderer
- a `teamsApi` service wrapper
- merging Teams state into `useAppStore`

Those can come later if the MVP lands cleanly.

---

## Suggested implementation order

### Phase 1 - dependency + main-process bridge
- add `letta-teams-sdk`
- add `src/electron/teams-runtime.ts`
- add `src/electron/teams-ipc.ts`
- register Teams IPC from `src/electron/main.ts`

### Phase 2 - typed preload seam
- extend `types.d.ts`
- extend `src/ui/vite-env.d.ts`
- expose `window.electron.teams` in `src/electron/preload.cts`

### Phase 3 - Teams store
- create `src/ui/store/useTeamsStore.ts`
- support:
  - init/configure
  - refresh
  - spawn
  - dispatch
  - selection state

### Phase 4 - replace `TeamsView` stub
- turn `TeamsView.tsx` into the real container
- show status/loading/error states
- show teammate list + task list
- add spawn and dispatch actions

### Phase 5 - polish
- task polling / auto-refresh
- empty states
- better detail panes
- error affordances
- optional daemon status banner

---

## Proposed data flow

1. User enters the Teams tab.
2. `TeamsView` initializes `useTeamsStore`.
3. The store reads the current connection inputs it needs.
4. The store calls `window.electron.teams.configure(...)`.
5. Electron main configures/returns the singleton Teams runtime.
6. Renderer requests teammate/task data via the typed IPC bridge.
7. UI renders lists and detail panes.
8. Spawn/dispatch actions update the runtime, then refresh local store state.

---

## Repo-specific notes to remember while implementing

- `src/ui/services/api.ts` remains thin; do not add a Teams wrapper there.
- `useAppStore` is already large enough; prefer a dedicated Teams store.
- Teams should feel like a takeover surface, but still use the current component/style system.
- The old integration draft is background context only; the handoff doc plus current codebase patterns should drive actual implementation.
- If Teams needs many IPC handlers, a dedicated `src/electron/teams-ipc.ts` is reasonable and cleaner than bloating `main.ts`.

---

## Success criteria for the first merge

A good first Teams merge should achieve all of this:

- `TeamsView` is no longer a placeholder
- renderer can talk to Teams through typed Electron IPC
- Teams runtime is configured using the app's current Letta connection settings
- user can see teammates and tasks
- user can spawn a teammate
- user can dispatch a task
- no `teamsApi` wrapper was introduced
- no major shell/nav refactor was required

---

## Final recommendation

The main agent should implement Teams as a **thin Electron bridge over `letta-teams-sdk`**, with a dedicated Teams store and a `TeamsView`-anchored UI.

That gives the app a clean MVP, respects current repo conventions, and avoids locking the integration into the older custom-daemon draft architecture.
