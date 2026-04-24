# Subagent Task #011: Agent Teleport — Channel Deployment UI

**Parent:** Stream C (Agent Teleport) — Issue #3  
**Warning:** Concurrent work. Commit fast, no attribution.  
**Source:** Hacked app teleport patterns + letta-code channel adapters

## Task

Build the "Deploy Agent" feature — click button, choose channel (Matrix/Telegram/CLI), agent appears there.

## UI Components

### 1. Deploy Button in AgentDetailPanel

Add to `/home/casey/Projects/letta-oss-ui/src/ui/components/AgentDetailPanel.tsx`:

```tsx
<button onClick={() => setShowDeployModal(true)}>
  🚀 Deploy Agent
</button>
```

### 2. Channel Selector Modal

Create `/home/casey/Projects/letta-oss-ui/src/ui/components/DeployModal.tsx`:

```
┌─────────────────────────┐
│    Deploy Agent         │
├─────────────────────────┤
│  Select channel(s):     │
│                         │
│  ☐ Matrix               │
│    └─ Room: [#general ▼]│
│                         │
│  ☐ Telegram             │
│    └─ Chat: [#dev ▼]    │
│                         │
│  ☐ CLI                  │
│    └─ CWD: [/home/ani]  │
│                         │
│  [Deploy] [Cancel]      │
└─────────────────────────┘
```

### 3. Channel Status Indicator

Show deployed channels as badges in AgentDetailPanel:
- 🟢 Matrix (active)
- 🟡 Telegram (connecting)
- 🔴 CLI (disconnected)

## API Integration

Use community-ade API (from Task #010):

```typescript
api.deployAgent(agentId, {
  channels: ['matrix', 'cli'],
  matrixRoom: '!abc:matrix.org',
  cliCwd: '/home/ani'
});
```

## Source: Hacked App

From HACKED_ASAR_DIFF.md:
- Proxy pattern for channel routing
- Multi-channel deployment concept
- Channel health monitoring

## Files

- `/home/casey/Projects/letta-oss-ui/src/ui/components/DeployModal.tsx` (new)
- `/home/casey/Projects/letta-oss-ui/src/ui/components/ChannelStatus.tsx` (new)
- `/home/casey/Projects/letta-oss-ui/src/ui/components/AgentDetailPanel.tsx` (add button)
- `/home/casey/Projects/letta-oss-ui/src/ui/services/api.ts` (add deploy endpoint)

## Output

- Deploy modal component
- Channel status component
- Integrated in detail panel
- Git commit (fast, no attribution)
