# Subagent Task #010: community-ade API Integration Layer

**Parent:** Stream E (Integration) — Issue #5  
**Warning:** Concurrent work. Commit fast, no attribution.  
**Source:** community-ade backend API + hacked app API patterns

## Task

Create API client layer to connect letta-oss-ui frontend to community-ade backend.

## Architecture

```
┌─────────────────┐     REST/WebSocket     ┌──────────────────┐
│  letta-oss-ui   │ ◄────────────────────► │  community-ade   │
│  (this repo)    │                        │  (0.16.7 compat) │
└─────────────────┘                        └──────────────────┘
                                                      │
                                                      ▼
                                            ┌──────────────────┐
                                            │  Letta 0.16.7    │
                                            └──────────────────┘
```

## API Client to Create

### `/home/casey/Projects/letta-oss-ui/src/ui/services/api.ts`

```typescript
const API_BASE = process.env.VITE_API_URL || 'http://10.10.20.19:3000';

export const api = {
  // Agents
  listAgents: () => fetch(`${API_BASE}/api/agents`).then(r => r.json()),
  getAgent: (id: string) => fetch(`${API_BASE}/api/agents/${id}`).then(r => r.json()),
  
  // Memory blocks
  getMemoryBlocks: (agentId: string) => 
    fetch(`${API_BASE}/api/agents/${agentId}/blocks`).then(r => r.json()),
  
  updateMemoryBlock: (agentId: string, blockId: string, value: string) =>
    fetch(`${API_BASE}/api/agents/${agentId}/blocks/${blockId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    }),
  
  // Chat streaming (replaces SDK createSession)
  sendMessage: (agentId: string, message: string) =>
    fetch(`${API_BASE}/api/agents/${agentId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    }),
};
```

## Replace SDK Calls

In useAppStore.ts, replace:
- `this.sdk.createSession()` → `api.sendMessage()`
- `session.stream()` → EventSource/SSE streaming from API
- Direct memory calls → `api.getMemoryBlocks()`, `api.updateMemoryBlock()`

## Source References

- community-ade: `/src/routes/agents.ts`, `/src/routes/chat.ts`
- HACKED_ASAR_DIFF.md: API patterns from hacked app
- letta-code-sdk: Streaming patterns to replicate

## Files

- `/home/casey/Projects/letta-oss-ui/src/ui/services/api.ts` (new)
- `/home/casey/Projects/letta-oss-ui/src/ui/store/useAppStore.ts` (replace SDK calls)
- `/home/casey/Projects/letta-oss-ui/.env.example` (add VITE_API_URL)

## Output

- API client service
- Updated store to use API instead of SDK
- Git commit (fast, no attribution)
- Document which SDK calls were replaced
