# Fix Procedure: Add Missing IPC Types to EventPayloadMapping

## Problem Summary

Four IPC handlers in `main.ts` are using raw `ipcMain.handle()` instead of the type-safe `ipcMainHandle()` helper because they are missing from `EventPayloadMapping` in `types.d.ts`:

1. `letta-code:get-status` (line 271)
2. `letta-code:spawn` (line 276)
3. `letta-code:stop` (line 351)
4. `letta:health-check` (line 361)

This breaks type safety for the `ipcInvoke()` helper in `preload.cts` and prevents compile-time validation of IPC payloads.

---

## Current State Analysis

### types.d.ts (lines 52-66) - Current EventPayloadMapping
```typescript
type EventPayloadMapping = {
    statistics: Statistics;
    getStaticData: StaticData;
    "generate-session-title": string;
    "get-recent-cwds": string[];
    "select-directory": string | null;
    "get-config": ConfigData;
    "save-config": ConfigData;
    "get-runtime-env": RuntimeEnv;
    "operator-profile:get": OperatorProfileData | null;
    "operator-profile:save": OperatorProfileData;
    "operator-secrets:set-memfs-token": boolean;
    "operator-secrets:has-memfs-token": boolean;
    "operator-secrets:clear-memfs-token": boolean;
}
```

### main.ts - Raw handlers (not using ipcMainHandle)
```typescript
// Line 271-274
ipcMain.handle("letta-code:get-status", () => {
    return lettaCode.getStatus();
});

// Line 276-349
ipcMain.handle("letta-code:spawn", async (_event, opts: { ... }) => { ... });

// Line 351-357
ipcMain.handle("letta-code:stop", async () => { ... });

// Line 361-383
ipcMain.handle("letta:health-check", async (_event, url: string, apiKey?: string) => { ... });
```

### preload.cts - Uses these channels via ipcInvoke
```typescript
// Lines 57-74
lettaCode: {
    getStatus: () => electron.ipcRenderer.invoke("letta-code:get-status"),
    spawn: (opts?) => electron.ipcRenderer.invoke("letta-code:spawn", opts ?? {}),
    stop: () => electron.ipcRenderer.invoke("letta-code:stop"),
    ...
},
letta: {
    healthCheck: (url: string, apiKey?: string) => electron.ipcRenderer.invoke("letta:health-check", url, apiKey),
}
```

---

## Required Type Definitions

Based on the handler implementations in `main.ts`, the following types need to be added:

### 1. LettaCodeStatusPayload (ALREADY EXISTS)
**Location:** types.d.ts lines 70-76  
**Status:** Already defined, no action needed.
```typescript
type LettaCodeStatus = "stopped" | "starting" | "running" | "stopping" | "crashed";

type LettaCodeStatusPayload = {
    status: LettaCodeStatus;
    pid?: number;
    exitCode?: number | null;
    exitSignal?: string | null;
    error?: string;
}
```

### 2. HealthCheckResult (NEW TYPE NEEDED)
**Purpose:** Return type for `letta:health-check`  
**Definition:**
```typescript
type HealthCheckResult = {
    healthy: boolean;
    error?: string;
}
```

### 3. LettaCodeSpawnOptions (OPTIONAL - for completeness)
**Purpose:** Input parameter type for `letta-code:spawn`  
**Note:** This is only needed if you want to type the input parameters. The `EventPayloadMapping` only types the _return_ value for `ipcMainHandle`.  
**Definition (if desired):**
```typescript
type LettaCodeSpawnOptions = {
    cwd?: string;
    serverUrl?: string;
    apiKey?: string;
    agentId?: string;
    agentMetadataEnv?: {
        letta_memfs_git_url?: string;
        letta_memfs_local?: string;
    };
}
```

---

## Exact Fix Procedure

### Step 1: Add HealthCheckResult Type
**File:** `/home/casey/Projects/letta-oss-ui/types.d.ts`  
**Location:** After line 76 (after LettaCodeStatusPayload definition)

**Insert:**
```typescript
type HealthCheckResult = {
    healthy: boolean;
    error?: string;
}
```

### Step 2: Add Missing Entries to EventPayloadMapping
**File:** `/home/casey/Projects/letta-oss-ui/types.d.ts`  
**Location:** Lines 52-66, inside the EventPayloadMapping type

**Add these 4 entries inside the EventPayloadMapping object (before the closing `}`):**
```typescript
    "letta-code:get-status": LettaCodeStatusPayload;
    "letta-code:spawn": LettaCodeStatusPayload;
    "letta-code:stop": LettaCodeStatusPayload;
    "letta:health-check": HealthCheckResult;
```

**Resulting EventPayloadMapping should look like:**
```typescript
type EventPayloadMapping = {
    statistics: Statistics;
    getStaticData: StaticData;
    "generate-session-title": string;
    "get-recent-cwds": string[];
    "select-directory": string | null;
    "get-config": ConfigData;
    "save-config": ConfigData;
    "get-runtime-env": RuntimeEnv;
    "operator-profile:get": OperatorProfileData | null;
    "operator-profile:save": OperatorProfileData;
    "operator-secrets:set-memfs-token": boolean;
    "operator-secrets:has-memfs-token": boolean;
    "operator-secrets:clear-memfs-token": boolean;
    // Missing IPC types - NOW ADDED
    "letta-code:get-status": LettaCodeStatusPayload;
    "letta-code:spawn": LettaCodeStatusPayload;
    "letta-code:stop": LettaCodeStatusPayload;
    "letta:health-check": HealthCheckResult;
}
```

### Step 3: Convert main.ts Handlers to Type-Safe ipcMainHandle
**File:** `/home/casey/Projects/letta-oss-ui/src/electron/main.ts`

**Change 1 - Line 271:**
```typescript
// BEFORE:
ipcMain.handle("letta-code:get-status", () => {
    console.log("[ipc:letta-code:get-status] current status:", lettaCode.getStatus());
    return lettaCode.getStatus();
});

// AFTER:
ipcMainHandle("letta-code:get-status", () => {
    console.log("[ipc:letta-code:get-status] current status:", lettaCode.getStatus());
    return lettaCode.getStatus();
});
```

**Change 2 - Line 276:**
```typescript
// BEFORE:
ipcMain.handle("letta-code:spawn", async (_event, opts: { cwd?: string; serverUrl?: string; apiKey?: string; agentId?: string; agentMetadataEnv?: { letta_memfs_git_url?: string; letta_memfs_local?: string } } = {}) => {

// AFTER:
ipcMainHandle("letta-code:spawn", async (_event, opts: { cwd?: string; serverUrl?: string; apiKey?: string; agentId?: string; agentMetadataEnv?: { letta_memfs_git_url?: string; letta_memfs_local?: string } } = {}) => {
```

**Change 3 - Line 351:**
```typescript
// BEFORE:
ipcMain.handle("letta-code:stop", async () => {
    console.log("[ipc:letta-code:stop] Stop requested");
    await lettaCode.stop();
    const status = lettaCode.getStatus();
    console.log("[ipc:letta-code:stop] Status after stop:", status);
    return status;
});

// AFTER:
ipcMainHandle("letta-code:stop", async () => {
    console.log("[ipc:letta-code:stop] Stop requested");
    await lettaCode.stop();
    const status = lettaCode.getStatus();
    console.log("[ipc:letta-code:stop] Status after stop:", status);
    return status;
});
```

**Change 4 - Line 361:**
```typescript
// BEFORE:
ipcMain.handle("letta:health-check", async (_event, url: string, apiKey?: string) => {

// AFTER:
ipcMainHandle("letta:health-check", async (_event, url: string, apiKey?: string) => {
```

---

## Summary of Changes

| File | Line(s) | Change |
|------|---------|--------|
| `types.d.ts` | After 76 | Add `HealthCheckResult` type |
| `types.d.ts` | 52-66 | Add 4 entries to `EventPayloadMapping` |
| `main.ts` | 271 | Change `ipcMain.handle` to `ipcMainHandle` |
| `main.ts` | 276 | Change `ipcMain.handle` to `ipcMainHandle` |
| `main.ts` | 351 | Change `ipcMain.handle` to `ipcMainHandle` |
| `main.ts` | 361 | Change `ipcMain.handle` to `ipcMainHandle` |

---

## Testing Approach

### 1. TypeScript Compilation Test
Run the TypeScript compiler to verify no type errors:
```bash
npm run build
# or
npx tsc --noEmit
```

**Expected:** No errors related to IPC handlers or EventPayloadMapping.

### 2. Runtime Test - letta-code:get-status
Open the app and check that the letta-code status is correctly fetched:
1. Open DevTools console
2. Execute: `window.electron.lettaCode.getStatus()`
3. **Expected:** Returns a Promise resolving to `{ status: string, pid?: number, ... }`

### 3. Runtime Test - letta-code:spawn
1. Navigate to an agent with memfs enabled
2. Click to spawn letta-code session
3. **Expected:** Spawn succeeds without IPC errors in console

### 4. Runtime Test - letta-code:stop
1. With letta-code running, click stop
2. **Expected:** Clean shutdown, status updates correctly

### 5. Runtime Test - letta:health-check
1. Go to Settings panel
2. Change server URL to trigger health check
3. **Expected:** Health status indicator updates (green/red dot)

### 6. ipcMainHandle Validation Test
Add a temporary deliberate type mismatch and verify TypeScript catches it:
```typescript
// Temporarily add this wrong handler in main.ts:
ipcMainHandle("letta-code:get-status", () => "wrong type");
```
**Expected:** TypeScript error: `Type 'string' is not assignable to type 'LettaCodeStatusPayload'`

Remove the test code after verification.

---

## Related Code Locations

- **Type definitions:** `/home/casey/Projects/letta-oss-ui/types.d.ts`
- **Handler implementations:** `/home/casey/Projects/letta-oss-ui/src/electron/main.ts` (lines 271, 276, 351, 361)
- **Type-safe helper:** `/home/casey/Projects/letta-oss-ui/src/electron/util.ts` (line 12)
- **Renderer API:** `/home/casey/Projects/letta-oss-ui/src/electron/preload.cts` (lines 57-75)
- **LettaCodeStatusPayload source:** `/home/casey/Projects/letta-oss-ui/src/electron/letta-code-manager.ts` (line 29)
