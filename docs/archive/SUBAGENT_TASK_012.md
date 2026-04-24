# Subagent Task #012: Electron Security & Config Overhaul

**Parent:** Stream D (Electron) — Issue #4  
**Warning:** Concurrent work. Commit fast, no attribution.  
**Source:** ELECTRON_ANALYSIS.md + industry best practices

## Task

Harden Electron app: security, configuration, persistence.

## Current State (from ELECTRON_ANALYSIS.md)

- No CSP
- Hardcoded values everywhere
- In-memory only (no persistence)
- Generic error handling

## Changes

### 1. Security Hardening

`/home/casey/Projects/letta-oss-ui/src/electron/main.ts`:

```typescript
// Add CSP
mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'; " +
        "connect-src 'self' http://localhost:* https://api.letta.com; " +
        "script-src 'self'; " +
        "style-src 'self' 'unsafe-inline'"
      ]
    }
  });
});

// IPC validation
ipcMain.handle('server-event', (event, data) => {
  // Validate data shape before processing
  if (!validateServerEvent(data)) {
    throw new Error('Invalid server event');
  }
  // ... process
});
```

### 2. Configuration System

Create `/home/casey/Projects/letta-oss-ui/src/electron/config.ts`:

```typescript
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

export interface Config {
  serverUrl: string;
  apiKey?: string;
  permissionMode: 'strict' | 'bypass';
  windowWidth: number;
  windowHeight: number;
  theme: 'light' | 'dark';
}

export const defaultConfig: Config = {
  serverUrl: 'http://10.10.20.19:8283',
  permissionMode: 'bypass',
  windowWidth: 1400,
  windowHeight: 900,
  theme: 'dark'
};

export function loadConfig(): Config {
  if (fs.existsSync(CONFIG_PATH)) {
    return { ...defaultConfig, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
  }
  return defaultConfig;
}

export function saveConfig(config: Config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
```

### 3. Session Persistence (SQLite)

Use `better-sqlite3` (already in deps):

```typescript
// src/electron/db.ts
import Database from 'better-sqlite3';

const db = new Database(path.join(app.getPath('userData'), 'sessions.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    title TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    metadata TEXT
  );
`);
```

### 4. Replace Hardcoded Values

In `/home/casey/Projects/letta-oss-ui/src/electron/runner.ts`:

```typescript
// OLD
const POLLING_INTERVAL = 5000;

// NEW
const config = loadConfig();
const POLLING_INTERVAL = config.pollingInterval || 5000;
```

## Files

- `/home/casey/Projects/letta-oss-ui/src/electron/main.ts` (CSP, validation)
- `/home/casey/Projects/letta-oss-ui/src/electron/config.ts` (new)
- `/home/casey/Projects/letta-oss-ui/src/electron/db.ts` (new)
- `/home/casey/Projects/letta-oss-ui/src/electron/runner.ts` (use config)
- `/home/casey/Projects/letta-oss-ui/src/electron/preload.ts` (expose config API)

## Output

- Security hardening (CSP, IPC validation)
- Config system with defaults
- SQLite persistence
- All hardcoded values removed
- Git commit (fast, no attribution)
