# Subagent Task #005: Update Sidebar.tsx Agent Management

**Parent:** Stream A (SDK Migration) — Issue #1  
**Warning:** Multiple agents working concurrently. Commit fast, no attribution.

## Task

Update `/home/casey/Projects/letta-oss-ui/src/ui/components/Sidebar.tsx` for SDK 0.1.14 agent management.

## Current State

Sidebar manages sessions. For 0.16.7 + 3-pane, it needs:
1. Click session → select agent (for detail panel)
2. Agent-aware session grouping
3. Update to new SDK types

## Changes Needed

1. **Add agent selection on click**:
```typescript
// When clicking a session, also select its agent
setSelectedAgentId(session.agentId);
```

2. **Update types** — Use `SessionView` from store (already has agentId)

3. **Session grouping** — Optional: Group sessions by agent

## Files

- `/home/casey/Projects/letta-oss-ui/src/ui/components/Sidebar.tsx`
- Reference: `/home/casey/Projects/letta-oss-ui/src/ui/store/useAppStore.ts` (selectedAgentId)

## Integration with 3-Pane

When user clicks session in sidebar:
1. Set active session (existing)
2. Set selected agent (NEW — for detail panel)

## Output

- Modified Sidebar.tsx
- Git commit (fast, no attribution)
- Status report
