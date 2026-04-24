# Subagent Task #009: Add WebSocket Real-Time Sync for Memory Blocks

**Parent:** Stream B (3-Pane UI) — Issue #2  
**Warning:** Concurrent work. Commit fast, no attribution.  
**Source:** Reference `letta-code` hacked app patterns + community-ade WebSocket

## Task

Add real-time synchronization for memory block changes via WebSocket.

## Problem

Currently, if memory is edited outside the UI (or in another tab), changes don't appear until refresh.

## Solution

WebSocket connection to community-ade backend for real-time block updates.

## Implementation

### 1. WebSocket Hook

Create `/home/casey/Projects/letta-oss-ui/src/ui/hooks/useMemorySync.ts`:

```typescript
export function useMemorySync(agentId: string | null) {
  useEffect(() => {
    if (!agentId) return;
    
    const ws = new WebSocket(`ws://10.10.20.19:3000/ws`);
    
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'memory:updated' && msg.agentId === agentId) {
        // Update store
        updateMemoryBlocks(agentId, msg.blocks);
      }
    };
    
    return () => ws.close();
  }, [agentId]);
}
```

### 2. Integrate in AgentDetailPanel

```typescript
// In AgentDetailPanel.tsx
useMemorySync(agentId);
```

### 3. Store Action

Add to useAppStore.ts:
```typescript
updateMemoryBlocks: (agentId, blocks) => {
  // Merge new blocks into agent state
}
```

## Reference Sources

- Hacked app: Check how it handles real-time updates
- community-ade: `/src/websocket/approval.ts` for WebSocket patterns
- letta-code-sdk: Event types

## Files

- `/home/casey/Projects/letta-oss-ui/src/ui/hooks/useMemorySync.ts` (new)
- `/home/casey/Projects/letta-oss-ui/src/ui/components/AgentDetailPanel.tsx` (integrate)
- `/home/casey/Projects/letta-oss-ui/src/ui/store/useAppStore.ts` (add action)

## Output

- WebSocket sync hook
- Integrated in detail panel
- Git commit (fast, no attribution)
