# Subagent Task #002: Update useAppStore.ts Memory Blocks

**Parent:** Stream A (SDK Migration)  
**Issue:** Gitea #1  
**Assignee:** You (Opus/Sonnet subagent)  
**Estimated:** 3-4 days  

## Task

Update `/home/casey/Projects/letta-oss-ui/src/ui/store/useAppStore.ts` for SDK 0.1.14 memory block handling.

## Current Problem

SDK 0.1.14 changed memory blocks:
- Old: `value: string`
- New: `content: { text?: string, ... } | string`

## What to Update

1. **SessionView type** — Update messages to handle new block format
2. **handleServerEvent** — Update `session.history` case to map new block structure
3. **Message streaming** — Update delta accumulation for new chunk types
4. **Helper functions** — Add `extractBlockText()` utility

## Key Changes

```typescript
// OLD
memoryBlocks: (a.memory?.blocks || []).map((b: any) => ({
  value: b.value || '',
}));

// NEW
memoryBlocks: (a.memory?.blocks || []).map((b: any) => ({
  content: b.content || { text: b.value || '' },
  // Handle both old and new for compatibility
}));
```

## Requirements

1. Read current `useAppStore.ts`
2. Update all memory block handling
3. Maintain backward compatibility (handle both `value` and `content`)
4. Update message streaming logic for new delta types
5. Run typecheck

## Output

- Modified `useAppStore.ts`
- Git commit
- Brief report on store changes

## Context

- `/home/casey/Projects/letta-oss-ui/src/ui/store/useAppStore.ts`
- `/home/casey/Projects/community-ade/0167_COMPATIBILITY_REPORT.md` (memory block section)
