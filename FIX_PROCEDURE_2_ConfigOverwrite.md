# Config Overwrite Bug - Fix Procedure

## Bug Analysis

**Location:** `/home/casey/Projects/letta-oss-ui/src/electron/main.ts` lines 276-288

**The Problem:**
When Local mode spawns the letta-code CLI, it unconditionally overwrites the saved `serverUrl` and `apiKey` in the config file. This wipes external server settings when a user temporarily switches to Local mode.

### Current Code (lines 276-288)

```typescript
ipcMain.handle("letta-code:spawn", async (_event, opts: { cwd?: string; serverUrl?: string; apiKey?: string; agentId?: string; agentMetadataEnv?: { ... } } = {}) => {
    console.log("[ipc:letta-code:spawn] Spawn requested with opts:", { ...opts, apiKey: opts.apiKey ? "(set)" : "(unset)" });

    // Renderer-supplied creds win — they reflect what the user actually
    // configured in the Settings panel (localStorage). Fall back to the
    // main-process appConfig file only when the renderer didn't pass any.
    const upstreamUrl = opts.serverUrl || appConfig.serverUrl || "http://localhost:8283";
    const upstreamKey = opts.apiKey ?? appConfig.apiKey ?? "";
    if (opts.serverUrl || opts.apiKey) {
        // Persist so subsequent spawns / restarts have it.
        appConfig = { ...appConfig, serverUrl: upstreamUrl, apiKey: upstreamKey };
        saveConfig(appConfig);  // <-- BUG: WIPES external server config!
    }
```

### The Bug Flow

1. User has external server configured: `serverUrl = "https://api.letta.com"`
2. User switches to Local mode in UI
3. Renderer spawns with `opts.serverUrl = "http://localhost:8283"`
4. The condition `if (opts.serverUrl || opts.apiKey)` is TRUE
5. Config gets overwritten with localhost values
6. User switches back to Server mode - their external server URL is lost!

## Root Cause

The save logic at lines 284-288 saves **any** `opts.serverUrl` or `opts.apiKey` to the config file. But `opts.serverUrl` often contains a *runtime default* (like localhost fallback) rather than an *intentional user configuration change*.

The current logic:
```typescript
const upstreamUrl = opts.serverUrl || appConfig.serverUrl || "http://localhost:8283";
// If opts.serverUrl is undefined, upstreamUrl = appConfig.serverUrl (external server)
// If opts.serverUrl is "http://localhost:8283", upstreamUrl = "http://localhost:8283"
// Then we save upstreamUrl, which overwrites external server config!
```

## The Fix

Only save to config when the provided `opts.serverUrl` is **different** from the current `appConfig.serverUrl`. This distinguishes between:
- **Intentional change:** User explicitly set a new server URL → Save it
- **Runtime fallback:** Using localhost as default for Local mode → Don't save

### Logic for Detecting Localhost vs External URLs

```typescript
function isLocalhostUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.hostname === 'localhost' ||
               parsed.hostname === '127.0.0.1' ||
               parsed.hostname.startsWith('192.168.') ||
               parsed.hostname.startsWith('10.') ||
               parsed.hostname.endsWith('.local');
    } catch {
        return false;
    }
}
```

### Code Changes Required

**File:** `/home/casey/Projects/letta-oss-ui/src/electron/main.ts`

**Step 1: Add helper function before the IPC handler (around line 270)**

```typescript
// Helper to detect if a URL is localhost/private (used for Local mode)
function isLocalhostUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.hostname === 'localhost' ||
               parsed.hostname === '127.0.0.1' ||
               parsed.hostname === '::1' ||
               parsed.hostname.startsWith('192.168.') ||
               parsed.hostname.startsWith('10.') ||
               parsed.hostname.startsWith('172.') || // covers 172.16-31.x.x
               parsed.hostname.endsWith('.local');
    } catch {
        return false;
    }
}
```

**Step 2: Modify the spawn handler (lines 276-288)**

**Before:**
```typescript
ipcMain.handle("letta-code:spawn", async (_event, opts: { cwd?: string; serverUrl?: string; apiKey?: string; agentId?: string; agentMetadataEnv?: { letta_memfs_git_url?: string; letta_memfs_local?: string } } = {}) => {
    console.log("[ipc:letta-code:spawn] Spawn requested with opts:", { ...opts, apiKey: opts.apiKey ? "(set)" : "(unset)" });

    // Renderer-supplied creds win — they reflect what the user actually
    // configured in the Settings panel (localStorage). Fall back to the
    // main-process appConfig file only when the renderer didn't pass any.
    const upstreamUrl = opts.serverUrl || appConfig.serverUrl || "http://localhost:8283";
    const upstreamKey = opts.apiKey ?? appConfig.apiKey ?? "";
    if (opts.serverUrl || opts.apiKey) {
        // Persist so subsequent spawns / restarts have it.
        appConfig = { ...appConfig, serverUrl: upstreamUrl, apiKey: upstreamKey };
        saveConfig(appConfig);
    }
```

**After:**
```typescript
ipcMain.handle("letta-code:spawn", async (_event, opts: { cwd?: string; serverUrl?: string; apiKey?: string; agentId?: string; agentMetadataEnv?: { letta_memfs_git_url?: string; letta_memfs_local?: string } } = {}) => {
    console.log("[ipc:letta-code:spawn] Spawn requested with opts:", { ...opts, apiKey: opts.apiKey ? "(set)" : "(unset)" });

    // Renderer-supplied creds win — they reflect what the user actually
    // configured in the Settings panel (localStorage). Fall back to the
    // main-process appConfig file only when the renderer didn't pass any.
    const upstreamUrl = opts.serverUrl || appConfig.serverUrl || "http://localhost:8283";
    const upstreamKey = opts.apiKey ?? appConfig.apiKey ?? "";

    // Only save config when the user explicitly changed settings (not for Local mode defaults)
    // This preserves external server config when temporarily switching to Local mode
    const explicitServerChange = opts.serverUrl && opts.serverUrl !== appConfig.serverUrl;
    const explicitKeyChange = opts.apiKey !== undefined && opts.apiKey !== appConfig.apiKey;
    const isExternalUrl = !isLocalhostUrl(upstreamUrl);

    if ((explicitServerChange || explicitKeyChange) && isExternalUrl) {
        // Persist external server config only. Local mode uses runtime defaults
        // without overwriting the saved external server configuration.
        appConfig = { ...appConfig, serverUrl: upstreamUrl, apiKey: upstreamKey };
        saveConfig(appConfig);
        console.log("[ipc:letta-code:spawn] Saved external server config:", upstreamUrl);
    } else if (explicitServerChange || explicitKeyChange) {
        console.log("[ipc:letta-code:spawn] Skipped saving localhost config to preserve external server settings");
    }
```

## Alternative Simpler Fix

If the `isLocalhostUrl` check feels too complex, a simpler approach is to **only save when opts.serverUrl is explicitly different from appConfig.serverUrl**:

```typescript
// Only save config when the user explicitly changed the server or key
const serverChanged = opts.serverUrl && opts.serverUrl !== appConfig.serverUrl;
const keyChanged = opts.apiKey !== undefined && opts.apiKey !== appConfig.apiKey;

if (serverChanged || keyChanged) {
    appConfig = { ...appConfig, serverUrl: upstreamUrl, apiKey: upstreamKey };
    saveConfig(appConfig);
}
```

**However**, this simpler fix has a problem: if user switches from external server to Local mode, then wants to switch back, they lose their external URL. We need the localhost detection to preserve external URLs.

## Recommended Fix: Combined Approach

The best fix combines both approaches:

```typescript
// Helper to detect localhost/private URLs
function isLocalhostUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname;
        return hostname === 'localhost' ||
               hostname === '127.0.0.1' ||
               hostname === '::1' ||
               hostname.startsWith('192.168.') ||
               hostname.startsWith('10.') ||
               /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) || // 172.16-31.x.x
               hostname.endsWith('.local');
    } catch {
        return false;
    }
}

// In spawn handler:
const upstreamUrl = opts.serverUrl || appConfig.serverUrl || "http://localhost:8283";
const upstreamKey = opts.apiKey ?? appConfig.apiKey ?? "";

// Only persist when explicitly changing to an external URL, OR
// when explicitly changing from localhost to another localhost
const explicitServerChange = opts.serverUrl && opts.serverUrl !== appConfig.serverUrl;
const explicitKeyChange = opts.apiKey !== undefined && opts.apiKey !== appConfig.apiKey;

if (explicitServerChange || explicitKeyChange) {
    // Save if: changing to external URL, or current config is also localhost
    // (meaning user is switching between localhost modes, not local<->external)
    const savingExternal = !isLocalhostUrl(upstreamUrl);
    const wasLocalhost = isLocalhostUrl(appConfig.serverUrl);

    if (savingExternal || wasLocalhost) {
        appConfig = { ...appConfig, serverUrl: upstreamUrl, apiKey: upstreamKey };
        saveConfig(appConfig);
        console.log("[ipc:letta-code:spawn] Saved config:", savingExternal ? "external server" : "localhost");
    } else {
        console.log("[ipc:letta-code:spawn] Preserving external server config, not saving localhost");
    }
}
```

## Testing Approach

### Test Case 1: Local mode doesn't overwrite external config
1. Set config to external server: `serverUrl: "https://api.letta.com"`
2. Switch to Local mode in UI
3. Verify letta-code spawns with localhost
4. Check config file - `serverUrl` should still be `"https://api.letta.com"`
5. Switch back to Server mode - should connect to external server

### Test Case 2: Explicit server change is saved
1. Set config to external server A: `"https://server-a.com"`
2. Change settings to external server B: `"https://server-b.com"`
3. Verify config file updated to server B

### Test Case 3: API key changes are handled properly
1. Set config with API key for external server
2. Switch to Local mode (no API key needed)
3. Verify external API key is preserved in config
4. Switch back to Server mode - should use saved API key

### Test Case 4: localhost-to-localhost changes
1. Config is `http://localhost:8283`
2. Change to `http://127.0.0.1:8283`
3. Should save the new localhost URL (both are local)

## Line Numbers Summary

| Change | File | Line Range | Description |
|--------|------|------------|-------------|
| Add helper | `main.ts` | Before line 276 | Add `isLocalhostUrl()` function |
| Modify condition | `main.ts` | 284-288 | Replace simple `if` with smart save logic |
| Add logging | `main.ts` | After line 288 | Add console.log for debugging |

## Final Implementation

```typescript
// Add this helper function (around line 273, before the ipcMain.handle)
function isLocalhostUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname;
        return hostname === 'localhost' ||
               hostname === '127.0.0.1' ||
               hostname === '::1' ||
               hostname.startsWith('192.168.') ||
               hostname.startsWith('10.') ||
               /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
               hostname.endsWith('.local');
    } catch {
        return false;
    }
}

// Modified spawn handler logic (lines 284-288 become):
const upstreamUrl = opts.serverUrl || appConfig.serverUrl || "http://localhost:8283";
const upstreamKey = opts.apiKey ?? appConfig.apiKey ?? "";

// Determine if this is an explicit config change
const explicitServerChange = opts.serverUrl && opts.serverUrl !== appConfig.serverUrl;
const explicitKeyChange = opts.apiKey !== undefined && opts.apiKey !== appConfig.apiKey;

if (explicitServerChange || explicitKeyChange) {
    // Save config when:
    // 1. Switching TO an external URL (preserve the new external config)
    // 2. Switching FROM localhost TO localhost (user managing local servers)
    // Don't save when switching FROM external TO localhost (temporary Local mode)
    const targetIsExternal = !isLocalhostUrl(upstreamUrl);
    const sourceWasExternal = !isLocalhostUrl(appConfig.serverUrl);

    if (targetIsExternal || !sourceWasExternal) {
        appConfig = { ...appConfig, serverUrl: upstreamUrl, apiKey: upstreamKey };
        saveConfig(appConfig);
        console.log("[ipc:letta-code:spawn] Saved config:", upstreamUrl);
    } else {
        console.log("[ipc:letta-code:spawn] Skipped config save - preserving external server settings for Local mode");
    }
}
```
