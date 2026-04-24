# Subagent Task #001: Update runner.ts Streaming

**Parent:** Stream A (SDK Migration)  
**Issue:** Gitea #1  
**Assignee:** You (Opus/Sonnet subagent)  
**Estimated:** 4-5 days  

## Task

Update `/home/casey/Projects/letta-oss-ui/src/electron/runner.ts` to use SDK 0.1.14 streaming API.

## Current Code (0.0.5 pattern)
```typescript
// OLD - needs changing
const session = await this.sdk.createSession({...});
for await (const chunk of session.stream(message)) {
  // handle chunk
}
```

## New Pattern (0.1.14)
```typescript
// NEW - target
const stream = await this.client.agents.messages.createStream(agentId, {
  messages: [{ role: "user", content: [{ type: "text", text: message }] }],
});
for await (const chunk of stream) {
  // handle chunk
}
```

## Requirements

1. Read current `runner.ts` — understand all streaming locations
2. Update to `agents.messages.createStream()` pattern
3. Handle new message chunk types (see OSS_UI_STRUCTURE.md)
4. Maintain IPC event compatibility (server events must still work)
5. Add error handling for new SDK errors
6. Run typecheck — must pass

## Output

- Modified `runner.ts` with clear git commit
- Brief report on what changed
- List of any breaking changes in IPC events

## Context Files

- `/home/casey/Projects/letta-oss-ui/src/electron/runner.ts`
- `/home/casey/Projects/letta-oss-ui/OSS_UI_STRUCTURE.md` (streaming section)
- `/home/casey/Projects/letta-oss-ui/package.json` (SDK versions)

**Do NOT change other files.** Focus only on runner.ts streaming.
