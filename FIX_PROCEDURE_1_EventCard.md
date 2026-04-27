# Fix Procedure: EventCard.tsx Memory Leak (Module-Level Global Maps)

## Problem Summary

Two files have module-level global Maps/Sets that grow forever without cleanup:

1. `/home/casey/Projects/letta-oss-ui/src/ui/components/EventCard.tsx` (lines 17-19)
2. `/home/casey/Projects/letta-oss-ui/src/ui/components/ui/business/MessageCard.tsx` (lines 75-77)

### The Issue

```typescript
// Module-level globals - NEVER cleaned up
const toolStatusMap = new Map<string, ToolStatus>();
const toolStatusListeners = new Set<() => void>();
```

Every tool call adds an entry to `toolStatusMap` keyed by `toolCallId`. These entries are never deleted, causing unbounded memory growth during long sessions.

### Impact

- Memory grows with each tool use
- Tool call IDs and listener callbacks accumulate
- No cleanup when conversations end or components unmount

---

## Solution: Per-Conversation Tool Status Context

The fix moves tool status management from module-level globals to a React Context scoped to each conversation. When a conversation ends and its components unmount, all tool status state is garbage collected.

---

## Implementation Steps

### Step 1: Create ToolStatusContext.tsx

**File:** `/home/casey/Projects/letta-oss-ui/src/ui/contexts/ToolStatusContext.tsx`

**New file content:**

```typescript
import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';

type ToolStatus = 'pending' | 'success' | 'error';

interface ToolStatusContextValue {
  getStatus: (toolCallId: string) => ToolStatus | undefined;
  setStatus: (toolCallId: string, status: ToolStatus) => void;
  subscribe: (callback: () => void) => () => void;
}

const ToolStatusContext = createContext<ToolStatusContextValue | null>(null);

export function ToolStatusProvider({ children }: { children: React.ReactNode }) {
  const [statusMap, setStatusMap] = useState<Map<string, ToolStatus>>(() => new Map());
  const [listeners, setListeners] = useState<Set<() => void>>(() => new Set());

  const getStatus = useCallback((toolCallId: string) => {
    return statusMap.get(toolCallId);
  }, [statusMap]);

  const setStatus = useCallback((toolCallId: string, status: ToolStatus) => {
    setStatusMap(prev => {
      const next = new Map(prev);
      next.set(toolCallId, status);
      return next;
    });
    // Notify all listeners
    listeners.forEach(listener => listener());
  }, [listeners]);

  const subscribe = useCallback((callback: () => void) => {
    setListeners(prev => {
      const next = new Set(prev);
      next.add(callback);
      return next;
    });
    return () => {
      setListeners(prev => {
        const next = new Set(prev);
        next.delete(callback);
        return next;
      });
    };
  }, []);

  const value = React.useMemo(() => ({
    getStatus,
    setStatus,
    subscribe,
  }), [getStatus, setStatus, subscribe]);

  return (
    <ToolStatusContext.Provider value={value}>
      {children}
    </ToolStatusContext.Provider>
  );
}

export function useToolStatusContext() {
  const context = useContext(ToolStatusContext);
  if (!context) {
    throw new Error('useToolStatusContext must be used within ToolStatusProvider');
  }
  return context;
}

export function useToolStatus(toolCallId: string | undefined): ToolStatus | undefined {
  const context = useToolStatusContext();
  const [status, setStatus] = useState<ToolStatus | undefined>(() =>
    toolCallId ? context.getStatus(toolCallId) : undefined
  );

  useEffect(() => {
    if (!toolCallId) return;
    
    // Initial check
    setStatus(context.getStatus(toolCallId));
    
    // Subscribe to updates
    const unsubscribe = context.subscribe(() => {
      setStatus(context.getStatus(toolCallId));
    });
    
    return unsubscribe;
  }, [toolCallId, context]);

  return status;
}

export function useSetToolStatus() {
  const context = useToolStatusContext();
  return context.setStatus;
}
```

### Step 2: Create contexts/index.ts barrel export

**File:** `/home/casey/Projects/letta-oss-ui/src/ui/contexts/index.ts`

**New file content:**

```typescript
export { ToolStatusProvider, useToolStatus, useSetToolStatus } from './ToolStatusContext';
```

### Step 3: Update EventCard.tsx

**File:** `/home/casey/Projects/letta-oss-ui/src/ui/components/EventCard.tsx`

**Changes to make:**

#### Line 1: Add import for the new hook

**Replace:**
```typescript
import { useEffect, useRef, useState } from "react";
```

**With:**
```typescript
import { useEffect, useRef, useState } from "react";
import { useToolStatus, useSetToolStatus } from "../contexts";
```

#### Lines 17-19: Remove module-level globals

**Delete these lines:**
```typescript
type ToolStatus = "pending" | "success" | "error";
const toolStatusMap = new Map<string, ToolStatus>();
const toolStatusListeners = new Set<() => void>();
```

#### Lines 39-43: Remove module-level setToolStatus function

**Delete this function:**
```typescript
const setToolStatus = (toolCallId: string | undefined, status: ToolStatus) => {
  if (!toolCallId) return;
  toolStatusMap.set(toolCallId, status);
  toolStatusListeners.forEach((listener) => listener());
};
```

#### Lines 45-56: Remove module-level useToolStatus hook

**Delete this entire hook:**
```typescript
const useToolStatus = (toolCallId: string | undefined) => {
  const [status, setStatus] = useState<ToolStatus | undefined>(() =>
    toolCallId ? toolStatusMap.get(toolCallId) : undefined
  );
  useEffect(() => {
    if (!toolCallId) return;
    const handleUpdate = () => setStatus(toolStatusMap.get(toolCallId));
    toolStatusListeners.add(handleUpdate);
    return () => { toolStatusListeners.delete(handleUpdate); };
  }, [toolCallId]);
  return status;
};
```

#### Line 104: Update setToolStatus call in ToolResultCard

**Current code context:**
```typescript
useEffect(() => { setToolStatus(message.toolCallId, isError ? "error" : "success"); }, [message.toolCallId, isError]);
```

**Replace with:**
```typescript
const setToolStatus = useSetToolStatus();
useEffect(() => { 
  if (message.toolCallId) {
    setToolStatus(message.toolCallId, isError ? "error" : "success"); 
  }
}, [message.toolCallId, isError, setToolStatus]);
```

**Note:** Add `const setToolStatus = useSetToolStatus();` near the top of the `ToolResultCard` function (around line 86, after other useRef declarations).

#### Lines 169 and 175-176: Update ToolCallCard

**Current code at line 169:**
```typescript
const toolStatus = useToolStatus(message.toolCallId);
```

**Keep as-is** - it will now use the imported hook from contexts.

**Current code at lines 174-178:**
```typescript
useEffect(() => {
  if (message.toolCallId && !toolStatusMap.has(message.toolCallId)) {
    setToolStatus(message.toolCallId, "pending");
  }
}, [message.toolCallId]);
```

**Replace with:**
```typescript
const setToolStatus = useSetToolStatus();
useEffect(() => {
  if (message.toolCallId) {
    setToolStatus(message.toolCallId, "pending");
  }
}, [message.toolCallId, setToolStatus]);
```

**Note:** Add `const setToolStatus = useSetToolStatus();` near the top of `ToolCallCard` (around line 168).

### Step 4: Update MessageCard.tsx

**File:** `/home/casey/Projects/letta-oss-ui/src/ui/components/ui/business/MessageCard.tsx`

**Changes to make:**

#### Line 1-2: Add import

**After existing imports, add:**
```typescript
import { useToolStatus, useSetToolStatus } from '../../../contexts';
```

#### Lines 75-77: Remove module-level globals

**Delete these lines:**
```typescript
type ToolStatus = 'pending' | 'success' | 'error';
const toolStatusMap = new Map<string, ToolStatus>();
const toolStatusListeners = new Set<() => void>();
```

#### Lines 79-83: Remove setToolStatus function

**Delete:**
```typescript
const setToolStatus = (toolCallId: string | undefined, status: ToolStatus) => {
  if (!toolCallId) return;
  toolStatusMap.set(toolCallId, status);
  toolStatusListeners.forEach((listener) => listener());
};
```

#### Lines 85-98: Remove useToolStatus hook

**Delete the entire hook function.**

#### Line 250 and 255-256: Update ToolCallCard component

Similar to EventCard.tsx, add `const setToolStatus = useSetToolStatus();` near the top of the function and update the useEffect dependency arrays to include `setToolStatus`.

#### Lines 326-327: Update ToolResultCard component

Add `const setToolStatus = useSetToolStatus();` and update the useEffect that calls setToolStatus.

### Step 5: Wrap Conversation Components with Provider

Find where conversation components are rendered. This is likely in a component that shows the message stream.

**File to find:** Look for where `MessageCard` or `EventCard` components are used together in a list. Common locations:
- `/home/casey/Projects/letta-oss-ui/src/ui/components/AgentDetailPanel.tsx`
- `/home/casey/Projects/letta-oss-ui/src/ui/components/SessionPanel.tsx` (if exists)
- `/home/casey/Projects/letta-oss-ui/src/ui/App.tsx`

**Pattern to wrap:**

```typescript
import { ToolStatusProvider } from '../contexts';

// In the component that renders the message list:
<ToolStatusProvider>
  {messages.map(message => (
    <EventCard key={message.id} message={message} ... />
  ))}
</ToolStatusProvider>
```

To find the exact location:

```bash
grep -rn "EventCard\|MessageCard" /home/casey/Projects/letta-oss-ui/src/ui --include="*.tsx" | grep -v "^.*:.*import\|^.*:.*export"
```

### Step 6: Create contexts directory

```bash
mkdir -p /home/casey/Projects/letta-oss-ui/src/ui/contexts
```

---

## Alternative Simpler Fix (If Context Pattern Is Too Complex)

If adding a Context is too invasive, an alternative is to add cleanup to the existing pattern:

### Option B: Per-Component State (No Context)

Instead of module-level state, each `ToolCallCard` and `ToolResultCard` pair can coordinate via props or a shared hook instance. However, this requires more refactoring of the parent component.

### Option C: Add Cleanup to Existing Globals

Add a cleanup mechanism to the existing globals by tracking which toolCallIds are currently being rendered:

**In EventCard.tsx:**

1. Keep the module-level maps but add reference counting
2. Add a `cleanupToolStatus(toolCallId)` function
3. Call cleanup when components unmount and the tool is complete

This is less clean but requires fewer architectural changes.

---

## Recommended Approach

**Use the Context pattern (Steps 1-5)** because:

1. **Proper scoping**: Tool status is scoped to a conversation, not the entire app
2. **Automatic cleanup**: When the conversation component unmounts, all state is garbage collected
3. **React idiomatic**: Uses standard React patterns (Context, Hooks)
4. **Testable**: Easy to test in isolation
5. **Matches existing patterns**: The codebase already uses zustand for global state; this is a lighter per-conversation state

---

## Testing Approach

1. **Memory profiling**:
   - Open Chrome DevTools > Memory tab
   - Take heap snapshot before starting a conversation
   - Run a conversation with many tool calls (20+)
   - Close/end the conversation
   - Take another heap snapshot
   - Verify no toolCallId strings or status objects remain

2. **Functional testing**:
   - Start a new conversation
   - Trigger a tool use
   - Verify tool status indicator shows "pending" then "success"/"error"
   - Verify the status dot changes color appropriately
   - Start a second conversation
   - Verify first conversation's tool status doesn't affect second

3. **Edge cases**:
   - Rapid tool calls (multiple pending)
   - Tool errors (error status propagation)
   - Component unmount during pending tool call
   - Multiple conversations open simultaneously

---

## Summary of Files Modified

| File | Action |
|------|--------|
| `/home/casey/Projects/letta-oss-ui/src/ui/contexts/ToolStatusContext.tsx` | Create new |
| `/home/casey/Projects/letta-oss-ui/src/ui/contexts/index.ts` | Create new |
| `/home/casey/Projects/letta-oss-ui/src/ui/components/EventCard.tsx` | Modify |
| `/home/casey/Projects/letta-oss-ui/src/ui/components/ui/business/MessageCard.tsx` | Modify |
| Message stream parent component | Add ToolStatusProvider wrapper |

---

## Verification Commands

```bash
# Verify the globals are removed
grep -n "toolStatusMap\|toolStatusListeners" /home/casey/Projects/letta-oss-ui/src/ui/components/EventCard.tsx
grep -n "toolStatusMap\|toolStatusListeners" /home/casey/Projects/letta-oss-ui/src/ui/components/ui/business/MessageCard.tsx

# Should return no results (or only in comments if you add migration notes)

# Verify the new context exists
ls -la /home/casey/Projects/letta-oss-ui/src/ui/contexts/

# Build to check for TypeScript errors
npm run build
```
