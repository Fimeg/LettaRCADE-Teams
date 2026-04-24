# Subagent Task #004: Update EventCard.tsx Block Rendering

**Parent:** Stream A (SDK Migration) — Issue #1  
**Warning:** Multiple agents working concurrently. Commit fast, no attribution.

## Task

Update `/home/casey/Projects/letta-oss-ui/src/ui/components/EventCard.tsx` to render memory blocks with SDK 0.1.14 format.

## Current vs New

```typescript
// OLD (0.0.5)
block.value: string

// NEW (0.1.14)
block.content: { text?: string } | string
```

## What to Update

1. **Block text extraction** — Use `extractBlockText()` pattern from useAppStore.ts
2. **Block display** — Handle both `content` object and legacy `value` string
3. **Message rendering** — Update any message content handling for new format

## Code Pattern to Follow

```typescript
// From useAppStore.ts — use same pattern
function extractBlockText(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (typeof content === 'object' && content !== null) {
    return (content as { text?: string }).text || '';
  }
  return '';
}
```

## Files

- `/home/casey/Projects/letta-oss-ui/src/ui/components/EventCard.tsx`
- Reference: `/home/casey/Projects/letta-oss-ui/src/ui/store/useAppStore.ts` (extractBlockText)

## Output

- Modified EventCard.tsx
- Git commit (fast, no attribution)
- Status report
