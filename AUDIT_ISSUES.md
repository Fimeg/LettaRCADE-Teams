# Letta OSS UI - Comprehensive Audit Report

**Date:** 2026-04-26
**Audited By:** Claude Code (Multi-Agent Audit)

---

## Executive Summary

Three major audit areas identified critical bugs, performance issues, and UI polish problems:

1. **Connection & IPC Layer** - Config overwrites, missing types, API key not passed
2. **Performance & Memory** - Memory leaks, excessive re-renders, missing memoization
3. **UI Components** - Icon alignment issues, missing exports, inconsistent patterns

---

## 1. CONNECTION & IPC LAYER ISSUES

### 1.1 CRITICAL: Config Overwrite on Local Mode Spawn
**File:** `src/electron/main.ts` (lines 284-288)

**Problem:** When spawning in Local mode, the external server URL and API key are overwritten with localhost settings.

```typescript
if (opts.serverUrl || opts.apiKey) {
    appConfig = { ...appConfig, serverUrl: upstreamUrl, apiKey: upstreamKey };
    saveConfig(appConfig);  // WIPES external server config!
}
```

**Impact:** Users lose their external Letta server configuration when using Local mode.

**Fix:** Only save config for non-localhost URLs:
```typescript
const isLocalhost = upstreamUrl.includes("localhost") || upstreamUrl.includes("127.0.0.1");
if ((opts.serverUrl || opts.apiKey) && !isLocalhost) {
    appConfig = { ...appConfig, serverUrl: upstreamUrl, apiKey: upstreamKey };
    saveConfig(appConfig);
}
```

### 1.2 CRITICAL: API Key Not Passed to Local Spawn
**File:** `src/ui/components/ConnectionModeIndicator.tsx` (lines 88-92)

**Problem:** `apiKey` is not retrieved from localStorage and passed to spawn:

```typescript
const result = await spawn({
  agentId,
  agentMetadataEnv,
  serverUrl: "http://localhost:8283",
  // apiKey is MISSING!
});
```

**Fix:** Add API key retrieval:
```typescript
const apiKey = localStorage.getItem("letta_api_key") || undefined;
const result = await spawn({
  agentId,
  apiKey,  // ADD
  agentMetadataEnv,
  serverUrl: "http://localhost:8283",
});
```

### 1.3 MAJOR: Missing IPC Types in EventPayloadMapping
**File:** `types.d.ts` (lines 52-66)

**Problem:** `letta-code:*` and `letta:health-check` handlers bypass frame validation because they're not in `EventPayloadMapping`.

**Missing entries:**
- `letta-code:get-status`
- `letta-code:spawn`
- `letta-code:stop`
- `letta:health-check`

**Fix:** Add to types.d.ts:
```typescript
type EventPayloadMapping = {
    // ... existing entries ...
    "letta-code:get-status": LettaCodeStatusPayload;
    "letta-code:spawn": LettaCodeStatusPayload;
    "letta-code:stop": LettaCodeStatusPayload;
    "letta:health-check": { healthy: boolean; error?: string };
}
```

### 1.4 MINOR: Direct ipcMain.handle() Usage
**File:** `src/electron/main.ts` (lines 271, 276, 351)

Three handlers use direct `ipcMain.handle()` instead of typed `ipcMainHandle()`, bypassing frame validation.

---

## 2. PERFORMANCE & MEMORY ISSUES

### 2.1 CRITICAL: Unbounded Memory Leak - EventCard.tsx
**File:** `src/ui/components/EventCard.tsx` (lines 18-56)

**Problem:** Module-level global Maps grow forever:

```typescript
const toolStatusMap = new Map<string, ToolStatus>();  // Never cleaned up
const toolStatusListeners = new Set<() => void>();     // Never cleaned up
```

**Impact:** Memory grows unbounded during long sessions.

**Fix:** Implement cleanup/expiration or move to per-conversation state.

### 2.2 CRITICAL: Missing useCallback Dependency - AgentWorkspace.tsx
**File:** `src/ui/components/AgentWorkspace.tsx` (lines 212-218)

**Problem:** Effect uses `populateConfigForm` but it's not in dependencies:

```typescript
useEffect(() => {
  populateConfigForm(agent.raw);  // Uses populateConfigForm
}, [agent?.raw]);  // MISSING: populateConfigForm
```

**Impact:** Stale closures, violates React hooks rules.

**Fix:** Add `populateConfigForm` to dependency array.

### 2.3 MAJOR: Expensive Message Transformations - useAppStore.ts
**File:** `src/ui/store/useAppStore.ts` (lines 943-1004)

**Problem:** `getMessages` transforms all messages with complex type checking on every call:

```typescript
const streamMessages: StreamMessage[] = apiMessages.map((msg): StreamMessage => {
  // Multiple typeof checks, nested conditionals, Date parsing
});
```

**Impact:** Loading 200 messages triggers 200+ complex transformations synchronously.

**Fix:** Memoize transformations or use virtualized lists.

### 2.4 MAJOR: SplitPane Full Remount on Focus Toggle - AgentWorkspace.tsx
**File:** `src/ui/components/AgentWorkspace.tsx` (line 980)

**Problem:** `key={focusMode ? 'focus' : 'full'}` causes full remount:

```typescript
<SplitPaneGroup key={focusMode ? 'focus' : 'full'}>
```

**Impact:** UI hangs when toggling focus mode due to complete re-mounting.

### 2.5 MAJOR: Missing Virtualization for Large Lists
**Files:**
- `src/ui/components/AgentsBrowser.tsx` (lines 140-164)
- `src/ui/components/AgentMemoryPanel.tsx` (lines 791-834)

**Problem:** All agents and archival passages render at once without virtualization.

**Impact:** With 100+ agents or passages, render and updates become sluggish.

**Fix:** Implement `react-window` or `react-virtualized`.

### 2.6 MAJOR: WebSocket Leak - useMemorySync.ts
**File:** `src/ui/hooks/useMemorySync.ts` (lines 20-66)

**Problem:** Cleanup doesn't handle `CONNECTING` state:

```typescript
return () => {
  if (ws.readyState === WebSocket.OPEN) {  // Only handles OPEN state
    ws.close();
  }
};
```

**Impact:** Rapid agent switching leaves WebSockets in `CONNECTING` state.

### 2.7 MODERATE: Health Recalculation Every Render - AgentMemoryPanel.tsx
**File:** `src/ui/components/AgentMemoryPanel.tsx` (line 180)

**Problem:** `calculateMemoryHealth` runs on every render:

```typescript
const memoryHealth = calculateMemoryHealth(memoryBlocks);  // Expensive!
```

**Fix:** Memoize with `useMemo`.

### 2.8 MODERATE: Monolithic Store - useAppStore.ts
**File:** `src/ui/store/useAppStore.ts` (lines 188-253)

**Problem:** Single store contains all state. Any change triggers subscribers to all slices.

**Impact:** Components using only `serverConnected` re-render when session messages update.

---

## 3. UI COMPONENT ISSUES

### 3.1 UI Polish: Icon Alignment in Top Panel
**File:** `src/ui/components/ui/layout/Tabs.tsx` (line 246)

**Problem:** TabsTrigger wraps children in `<span>`, causing icon+text misalignment:

```typescript
<span>{children}</span>  // Icon appears slightly above text
```

**Current usage in App.tsx:**
```typescript
<TabsTrigger value="home">
  <Icon icon={Home} size="sm" />  {/* Icon slightly above text */}
  Home
</TabsTrigger>
```

**Fix:** Remove wrapping `<span>` or add `items-center` flexbox to trigger:

```typescript
// In TabsTrigger component:
className={cn(
  tabsTriggerVariants({ orientation, variant, isActive }),
  "items-center",  // ADD vertical alignment
  className
)}
```

### 3.2 Icon Vertical Alignment - Icon.tsx
**File:** `src/ui/components/ui/primitives/Icon.tsx`

**Problem:** No vertical alignment classes for inline use with text.

**Fix:** Add alignment utilities or document usage pattern:
```typescript
// When using Icon with text, wrap in flex container with items-center
<span className="inline-flex items-center gap-2">
  <Icon icon={Home} size="sm" />
  <span>Home</span>
</span>
```

### 3.3 Missing Component Exports
**Status:** VERIFIED - All components properly exported via index files.

### 3.4 Type Safety
**Status:** VERIFIED - TypeScript builds successfully.

---

## 4. CSP & SECURITY

### 4.1 CSP Missing blob: for Workers
**File:** `src/electron/main.ts` (lines 164-168)

**Problem:** Vite dev mode uses blob workers that are blocked by CSP.

**Fix Applied:**
```typescript
'script-src \'self\' \'unsafe-inline\' blob:; ' +
'worker-src \'self\' blob:; ' +
```

---

## Priority Fix Order

### Immediate (Breaking/Critical)
1. EventCard.tsx - Fix memory leak (unbounded Maps)
2. main.ts - Fix config overwrite on local spawn
3. AgentWorkspace.tsx - Add missing useCallback dependency
4. ConnectionModeIndicator.tsx - Pass apiKey to spawn

### Short-term (Performance)
5. useAppStore.ts - Memoize message transformations
6. AgentMemoryPanel.tsx - Memoize health calculations
7. Tabs.tsx - Fix icon alignment in triggers
8. useMemorySync.ts - Fix WebSocket cleanup

### Medium-term (UX/Scaling)
9. AgentsBrowser.tsx - Add virtualization
10. AgentMemoryPanel.tsx - Add passage virtualization
11. useAppStore.ts - Split into domain stores
12. types.d.ts - Add missing IPC type mappings

---

## Working Reference Files

Per CLAUDE.md, the working reference is:
- `/home/casey/Projects/letta-code-new` - Modern patterns, newer than SDK
- Uses `@letta-ai/letta-client` package (native client)

---

## Related Documentation

- `CLAUDE.md` - Architecture patterns and 4-project reference
- `HANDOFF_TEAMS.md` - Teams feature integration notes
- `WAVE_5_REFACTOR.md` - Component library migration status
