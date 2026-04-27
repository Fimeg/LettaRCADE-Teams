# Letta OSS UI - Project Status

**Last Updated:** 2026-04-26

---

## Current State

### Build Status
✅ **TypeScript compilation:** Clean (no errors)
✅ **Vite production build:** Successful
✅ **Dev server:** Ready to start

### Recently Completed (2026-04-26)

#### 1. Wave 5 Component Library Migration ✅ COMPLETE
- App.tsx refactored to use TopNav, Tabs
- AgentWorkspace refactored to use SplitPane
- SettingsPanel refactored to use Tabs, FormField, Input, Button
- All components properly exported and typed

#### 2. Critical Bug Fixes (6 Issues) ✅ COMPLETE

| Fix | File(s) | Description |
|-----|---------|-------------|
| **#1 EventCard Memory Leak** | `ToolStatusContext.tsx` (new), `EventCard.tsx`, `MessageCard.tsx`, `AgentWorkspace.tsx` | Moved module-level global Maps to per-conversation React Context |
| **#2 Config Overwrite** | `main.ts` | Added `isLocalhostUrl()` helper, smart save logic preserves external server config when using Local mode |
| **#3 Missing Dependency** | `AgentWorkspace.tsx` | Fixed React hooks dependencies (populateConfigForm ordering + useCallback deps) |
| **#4 IPC Types** | `types.d.ts`, `main.ts` | Added HealthCheckResult type + 4 IPC mappings; converted handlers to type-safe ipcMainHandle |
| **#5 API Key** | `ConnectionModeIndicator.tsx`, `useLettaCodeSpawn.ts` | Now passes API key to spawn; fixed hook fallback |
| **#6 Icon Alignment** | `Tabs.tsx`, `App.tsx` | Fixed icon+text alignment in tab triggers using flexbox |

### Outstanding Issues (Known)

#### 1. CSP for Dev Mode - FIXED
- Added `blob:` to `script-src` and `worker-src` for Vite dev server workers

#### 2. Type Errors - FIXED
- `preload.cts` callback parameter types updated
- `vite-env.d.ts` Statistics type aligned with actual payload

#### 3. Dev Server Stability - KNOWN ISSUE
- Concurrently kills all processes when one exits (normal behavior)
- Need clean shutdown process (tracked in issues)

---

## Architecture

### 3-Mode Connection
The app supports three connection modes:
1. **Server** - Direct HTTP SDK calls to external Letta server
2. **Local** - Spawn letta-code CLI locally, connect to localhost:8283
3. **Remote** - Connect to user-provided remote Letta server URL

### Component Library Structure
```
src/ui/components/ui/
├── primitives/     # Button, Input, Icon, Spinner, etc.
├── composites/     # Alert, Badge, Card, FormField, etc.
├── business/       # ConfirmDialog, MessageCard, etc.
├── patterns/       # Breadcrumbs, DataTable, EmptyState, etc.
└── layout/         # SplitPane, Tabs, TopNav, etc.
```

### Key Patterns
- **Direct SDK usage** - No wrapper APIs; use `@letta-ai/letta-client` directly
- `agent.raw` carries full server AgentState
- localStorage for cross-component coordination
- Conditional `<PanelGroup>` children + key swap for Focus Mode

---

## Documentation Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Architecture patterns, 4-project reference |
| `AUDIT_ISSUES.md` | Full audit findings (6 fix procedures documented) |
| `STATUS.md` | This file - current project state |
| `FIX_PROCEDURE_*.md` | Individual fix procedures (6 files) |
| `HANDOFF_TEAMS.md` | Teams feature integration notes |
| `WAVE_5_REFACTOR.md` | Component library migration status |

---

## Next Steps (When You Return)

### Immediate
1. Run `npm run dev` to test the fixes
2. Verify icon alignment looks correct in top nav
3. Test Local mode spawn with API key

### Short-term
1. Add virtualization for AgentsBrowser (100+ agents)
2. Add virtualization for archival memory passages
3. Memoize `calculateMemoryHealth` in AgentMemoryPanel
4. Fix WebSocket cleanup in useMemorySync

### Medium-term
1. Split useAppStore into domain-specific stores
2. Implement batched state updates in handleInputSend
3. Add react-window for large lists
4. Test Teams feature integration (Vedant's work)

---

## Reference Projects (Per CLAUDE.md)

1. **Letta-Code-SDK** (v0.1.14) - `node_modules/@letta-ai/letta-code-sdk`
2. **OSS-UI/LettaCoWork** (this project) - `/home/casey/Projects/letta-oss-ui`
3. **Hacked Letta-Code-App** (MODERN patterns) - `/home/casey/Projects/letta-code-new`
4. **Letta-AI Server** (v16.7) - Docker server at `http://localhost:8283`

---

## Quick Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Type check only
npx tsc -b

# Transpile Electron code
npm run transpile:electron
```

---

## Notes for Future Self

- All 6 fix procedures are documented in `FIX_PROCEDURE_*.md` files
- The component library is stable and ready for Vedant's Teams feature
- Memory leak fix uses React Context pattern - verify with heap snapshots if needed
- Config overwrite fix preserves external URLs when using Local mode
- Type safety now enforced for all IPC handlers
