# Subagent Task #008: Update types.ts for SDK 0.1.14

**Parent:** Stream A (SDK Migration) — Issue #1  
**Warning:** Concurrent work. Commit fast, no attribution.  
**Source:** Reference `letta-code-sdk` package types

## Task

Update `/home/casey/Projects/letta-oss-ui/src/ui/types.ts` to re-export and extend SDK 0.1.14 types.

## Current State

Types are hand-rolled for 0.0.5. Need to:
1. Import from `@letta-ai/letta-code-sdk` where possible
2. Re-export with UI-specific extensions
3. Remove duplicate/incompatible definitions

## Changes Needed

```typescript
// Import SDK types
import type {
  StreamMessage,
  SessionStatus,
  // etc
} from '@letta-ai/letta-code-sdk';

// Re-export
export type { StreamMessage, SessionStatus };

// UI-specific extensions
export interface ExtendedStreamMessage extends StreamMessage {
  // Add UI-only fields if needed
}
```

## Key Type Mappings

| UI Type | SDK Type | Status |
|---------|----------|--------|
| `StreamMessage` | `StreamMessage` | Re-export |
| `SessionStatus` | `SessionStatus` | Re-export |
| `ServerEvent` | Custom (keep) | UI protocol |
| `PermissionRequest` | Custom (keep) | UI-specific |

## Files

- `/home/casey/Projects/letta-oss-ui/src/ui/types.ts`
- Reference: `node_modules/@letta-ai/letta-code-sdk/dist/types.d.ts`

## Output

- Updated types.ts
- Git commit (fast, no attribution)
- List of breaking type changes
