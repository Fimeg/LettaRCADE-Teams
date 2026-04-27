# Fix Procedure: Missing API Key in ConnectionModeIndicator.tsx

## Issue Summary

**Location**: `/home/casey/Projects/letta-oss-ui/src/ui/components/ConnectionModeIndicator.tsx` lines 88-92

**Problem**: The `spawn()` function is called without passing the `apiKey` parameter:
```typescript
const result = await spawn({
  agentId,
  agentMetadataEnv,
  serverUrl: "http://localhost:8283",
  // apiKey is MISSING!
});
```

## Root Cause Analysis

### 1. How the spawn chain works

The spawn call flows through several layers:

**Layer 1 - Component**: `ConnectionModeIndicator.tsx` (lines 88-92)
- Calls `spawn()` from `useLettaCodeSpawn()` hook
- Currently missing `apiKey` in the options object

**Layer 2 - Hook**: `useLettaCodeSpawn.ts` (lines 61-98)
- The hook accepts `SpawnOptions` which includes optional `apiKey?: string` (line 27)
- Has fallback logic to read from localStorage (line 77) **BUT only when `serverUrl` is not provided**
- Since `ConnectionModeIndicator` always provides `serverUrl`, the fallback is skipped

**Layer 3 - IPC**: `main.ts` (lines 276-349)
- The IPC handler receives options and uses `opts.apiKey` (line 283)
- Falls back to `appConfig.apiKey` then empty string: `const upstreamKey = opts.apiKey ?? appConfig.apiKey ?? "";`

**Layer 4 - Manager**: `letta-code-manager.ts` (lines 37-47)
- `SpawnOptions` interface requires `apiKey: string` (line 41)
- Sets `LETTA_API_KEY` environment variable (line 123)

### 2. How other parts of the app retrieve API keys

From `SettingsPanel.tsx`:
```typescript
const API_KEY_STORAGE = 'letta_api_key';  // Line 12
const savedKey = localStorage.getItem(API_KEY_STORAGE) || '';  // Line 118
localStorage.setItem(API_KEY_STORAGE, apiKey);  // Line 134
```

From `api.ts`:
```typescript
export function getApiKey(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('letta_api_key');
    if (saved) return saved;
  }
  return import.meta.env.LETTA_API_KEY || '';
}
```

From `useLettaCodeSpawn.ts` (hook fallback):
```typescript
if (!serverUrl) {
  try {
    serverUrl = localStorage.getItem("letta_api_url") || undefined;
    apiKey = apiKey || localStorage.getItem("letta_api_key") || undefined;
  } catch { /* ignore */ }
}
```

**Key insight**: The hook's fallback only triggers when `serverUrl` is NOT provided. Since `ConnectionModeIndicator` always provides `serverUrl`, the API key is never retrieved from localStorage.

### 3. Current behavior impact

- When `apiKey` is missing and server requires authentication, the spawned CLI process fails
- The CLI receives an empty API key, causing 401/403 errors on authenticated endpoints
- No error is shown to the user in the UI since the spawn itself may succeed but subsequent API calls fail

## Proposed Fix

### Option A: Import and use `getApiKey()` from api.ts (RECOMMENDED)

This is the cleanest approach as it centralizes API key retrieval logic.

**Changes needed:**

1. **Add import** at line 11 in `ConnectionModeIndicator.tsx`:
```typescript
import { getApiKey } from "../services/api";
```

2. **Modify the spawn call** at lines 88-92:
```typescript
const result = await spawn({
  agentId,
  agentMetadataEnv,
  serverUrl: "http://localhost:8283",
  apiKey: getApiKey(),  // ADD THIS LINE
});
```

### Option B: Read directly from localStorage

If you want to avoid the import:

```typescript
const result = await spawn({
  agentId,
  agentMetadataEnv,
  serverUrl: "http://localhost:8283",
  apiKey: typeof window !== 'undefined' ? localStorage.getItem('letta_api_key') || undefined : undefined,
});
```

However, Option A is preferred because:
- It uses the centralized `getApiKey()` helper
- Handles the `window` check properly
- Includes the env variable fallback
- Maintains consistency with other parts of the codebase

### Option C: Fix the hook fallback logic

Alternatively, fix the hook in `useLettaCodeSpawn.ts` to always fall back to localStorage:

**In `useLettaCodeSpawn.ts` lines 71-79, change:**
```typescript
// Current (buggy) - only falls back when serverUrl is missing
if (!serverUrl) {
  try {
    serverUrl = localStorage.getItem("letta_api_url") || undefined;
    apiKey = apiKey || localStorage.getItem("letta_api_key") || undefined;
  } catch { /* ignore */ }
}

// Fixed - always fall back for apiKey
if (!serverUrl) {
  try {
    serverUrl = localStorage.getItem("letta_api_url") || undefined;
  } catch { /* ignore */ }
}
if (!apiKey) {
  try {
    apiKey = localStorage.getItem("letta_api_key") || undefined;
  } catch { /* ignore */ }
}
```

**Recommendation**: Implement Option A (explicit pass from component) AND Option C (fix hook fallback). This provides defense in depth.

## Exact Code Changes

### File: `/home/casey/Projects/letta-oss-ui/src/ui/components/ConnectionModeIndicator.tsx`

**Change 1 - Add import (line 11):**
```typescript
import { getApiKey } from "../services/api";
```

**Change 2 - Modify spawn call (lines 88-92):**
```typescript
const result = await spawn({
  agentId,
  agentMetadataEnv,
  serverUrl: "http://localhost:8283",
  apiKey: getApiKey(),
});
```

### File: `/home/casey/Projects/letta-oss-ui/src/ui/hooks/useLettaCodeSpawn.ts` (optional but recommended)

**Change - Fix fallback logic (lines 74-79):**
```typescript
// Before:
if (!serverUrl) {
  try {
    serverUrl = localStorage.getItem("letta_api_url") || undefined;
    apiKey = apiKey || localStorage.getItem("letta_api_key") || undefined;
  } catch { /* ignore privacy / quota errors */ }
}

// After:
if (!serverUrl) {
  try {
    serverUrl = localStorage.getItem("letta_api_url") || undefined;
  } catch { /* ignore privacy / quota errors */ }
}
if (!apiKey) {
  try {
    apiKey = localStorage.getItem("letta_api_key") || undefined;
  } catch { /* ignore privacy / quota errors */ }
}
```

## Error Handling

The current error handling in `handleSpawnToggle` (lines 94-98) is adequate:
```typescript
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[ConnectionModeIndicator] spawn failed:", err);
  setSpawnError(msg);
}
```

This will catch spawn failures and display them in the UI (lines 157-167) which renders `spawnError` with a red background.

However, consider adding a warning log when no API key is set but the server might require one:
```typescript
const apiKey = getApiKey();
if (!apiKey) {
  console.warn("[ConnectionModeIndicator] No API key set. Authentication may fail if server requires it.");
}
const result = await spawn({
  agentId,
  agentMetadataEnv,
  serverUrl: "http://localhost:8283",
  apiKey,
});
```

## Testing Approach

### Manual Testing Steps

1. **Build and run the app**: `npm run dev`
2. **Open Settings panel**: Set an API key in the settings
3. **Verify localStorage**: In browser dev tools console, run:
   ```javascript
   localStorage.getItem('letta_api_key');
   ```
   Should return the key you set.
4. **Switch to Local mode**: Click the "Local" button in ConnectionModeIndicator
5. **Click Start**: The spawn should include the API key
6. **Check logs**: In Electron main process console, look for:
   ```
   [ipc:letta-code:spawn] Spawn requested with opts: { ..., apiKey: "(set)" }
   [letta-code]   LETTA_API_KEY: (set)
   ```
   (The "(set)" indicates the key is being passed, actual value is masked for security)

### Console Verification

Add temporary debug logging in `ConnectionModeIndicator.tsx`:
```typescript
const apiKey = getApiKey();
console.log("[ConnectionModeIndicator] Spawning with apiKey:", apiKey ? "(set)" : "(unset)");
const result = await spawn({
  agentId,
  agentMetadataEnv,
  serverUrl: "http://localhost:8283",
  apiKey,
});
```

### Edge Cases to Test

1. **No API key set**: Should spawn with empty key (acceptable for localhost dev)
2. **API key with special characters**: Ensure it's properly passed through
3. **Long API keys**: Verify no truncation occurs
4. **Switching modes**: After fixing, switching from Server to Local mode should preserve the API key

## Summary

| Aspect | Details |
|--------|---------|
| **Primary Fix** | Add `apiKey: getApiKey()` to spawn() call in ConnectionModeIndicator.tsx |
| **Lines to modify** | Add import at line 11, modify lines 88-92 |
| **Secondary Fix** | Fix hook fallback in useLettaCodeSpawn.ts lines 74-79 |
| **Testing** | Verify logs show `apiKey: "(set)"` when key is configured |
| **Risk level** | Low - additive change, doesn't break existing behavior |
