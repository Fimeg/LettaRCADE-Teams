# Implementation Prompt for Claude (Opus)

## Objective
Fix the critical issues in the Letta OSS UI and implement the correct "Local Mode" architecture based on findings from analyzing letta-code-desktop-new.

## Background Reading (READ FIRST)

**Critical Analysis Documents (in /home/casey/Projects/letta-oss-ui/docs/):**
1. `COMPREHENSIVE_ARCHITECTURE_FINDINGS.md` - Overall architecture synthesis
2. `letta-code-desktop-new-analysis.md` - How the working implementation does it
3. `letta-desktop-16.2-analysis.md` - Original desktop architecture
4. `letta-code-cli-analysis.md` - Understanding the CLI tool

**Reference Projects:**
- `/home/casey/Projects/letta-code-desktop-new/` - Working Next.js + Electron implementation
- `/home/casey/Projects/letta-code/` - The CLI tool (@letta-ai/letta-code package)

## Gitea Issues to Address

| Issue | Status | What to Do |
|-------|--------|------------|
| #6 | Partial | Fix `/recompile` command - currently does no-op update |
| #7 | Complete | Curator health working - verify no changes needed |
| #8 | Complete | Archival memory working - verify no changes needed |
| #9 | Broken | Connection mode indicator uses wrong architecture |
| #10 | Incomplete | Wizard built but not integrated into App.tsx |

## Critical Discovery

**The current OSS UI "Local Mode" is fundamentally broken.**

It tries to connect to `ws://localhost:8283/ws`, but:
- Port 8283 is the REST API port, not WebSocket
- Letta-code doesn't expose a WebSocket server

**The correct pattern** (from letta-code-desktop-new):
1. Spawn `@letta-ai/letta-code` CLI as a subprocess
2. Set `LETTA_BASE_URL` to point to your Express proxy
3. Create Express proxy for routing to Letta API
4. Use WebSocket internally (main process ↔ CLI)
5. Use SSE for agent streaming from API

## Source Files to Modify

### High Priority (Broken Features)

#### 1. `/src/ui/services/slashCommands.ts`
- **Line 105-125**: `/recompile` command does no-op update
- **Fix**: Remove or implement actual recompile (touch memory block to force refresh)

#### 2. `/src/ui/store/useAppStore.ts`
- **Line 225**: `setSelectedAgentId` resets `activeConversationId` to null
- **Fix**: Track last conversation per agent (add `lastConversationPerAgent` state)

#### 3. `/src/ui/App.tsx`
- **Line 103**: TODO - create agent modal not implemented
- **Fix**: Integrate AgentWizard component (add state, import, render)

#### 4. `/src/ui/services/api.ts`
- **Missing**: `listAllModels` method referenced by wizard
- **Fix**: Add `listAllModels` using `client.models.list()`

### Architecture Changes (Remove Broken Local Mode)

#### 5. `/src/ui/components/ConnectionModeIndicator.tsx`
- **Current**: Shows Server/Local toggle with WebSocket URL input
- **Fix**: Hide or disable "Local" mode until properly implemented

#### 6. `/src/ui/components/AgentWorkspace.tsx`
- **Line 62**: Hardcoded `ws://localhost:8283/ws` 
- **Lines 295-328**: WebSocket connection logic for letta-code
- **Fix**: Remove broken WebSocket approach or disable local mode

## Files to Create (New Architecture)

### Electron Main Process
- `src/electron/proxy-server.ts` - Express proxy middleware
- `src/electron/letta-code-manager.ts` - Spawn/manage CLI subprocess

### Hooks
- `src/ui/hooks/useLettaCodeSpawn.ts` - React hook for spawned CLI

## Implementation Options

### Option A: Minimal Fixes (Recommended Short-term)
1. Fix `/recompile` command
2. Fix conversation resumption (track last conversation per agent)
3. Integrate wizard into App.tsx
4. Add `listAllModels` API
5. **Hide the broken "Local Mode" toggle** (don't remove, just hide)

### Option B: Full Architecture (Recommended Long-term)
1. All of Option A, plus:
2. Add Electron main process with proxy server
3. Implement correct "Local Mode" spawning letta-code CLI
4. Use Express proxy for routing
5. Proper WebSocket internal communication

## Key Code Patterns to Follow

### From letta-code-desktop-new (dist/main.js):
```javascript
// Spawn letta-code CLI
const child = spawn('node', [
  './node_modules/@letta-ai/letta-code/letta.js'
], {
  env: {
    LETTA_BASE_URL: `http://localhost:${proxyPort}`,
    LETTA_API_KEY: sessionToken,
  }
});

// Express proxy
app.use('/v1', createProxyMiddleware({
  target: 'https://api.letta.com',
  changeOrigin: true,
  headers: { 'Authorization': `Bearer ${token}` }
}));
```

### From current OSS UI (for reference):
```typescript
// Current broken approach (AgentWorkspace.tsx:62)
const [lettaCodeUrl, setLettaCodeUrl] = useState('ws://localhost:8283/ws');
```

## SDK Versions
```json
{
  "@letta-ai/letta-client": "^1.10.3",
  "@letta-ai/letta-code": "^0.23.9"
}
```

## Definition of Done

- [ ] `/recompile` command either works or is removed
- [ ] Conversation resumption works (switching agents preserves conversation)
- [ ] Wizard integrated into App.tsx (can create agents through UI)
- [ ] `listAllModels` API added
- [ ] Broken "Local Mode" WebSocket hidden/disabled
- [ ] All changes follow existing code patterns (Tailwind, Zustand, native Letta client)
- [ ] No custom wrapper APIs (per CLAUDE.md guidelines)

## Questions?

If unclear on approach:
1. Read the analysis documents in docs/
2. Check reference implementation in /home/casey/Projects/letta-code-desktop-new/
3. Ask user for clarification

## Starting Point

Begin by reading:
1. `/home/casey/Projects/letta-oss-ui/docs/COMPREHENSIVE_ARCHITECTURE_FINDINGS.md`
2. `/home/casey/Projects/letta-oss-ui/src/ui/services/slashCommands.ts`
3. `/home/casey/Projects/letta-oss-ui/src/ui/store/useAppStore.ts`
4. `/home/casey/Projects/letta-oss-ui/src/ui/App.tsx`
5. `/home/casey/Projects/letta-oss-ui/CLAUDE.md` (project guidelines)

Then proceed with Option A (minimal fixes) unless user specifies otherwise.
