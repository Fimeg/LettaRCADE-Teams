# Migration Plan: Remove API Wrappers → Direct SDK Usage

## Goal
Eliminate the wrapped `agentsApi`/`conversationsApi` pattern in favor of direct `@letta-ai/letta-client` SDK usage, matching the architecture of `letta-code-new`.

## Current State (Wrapped Pattern)

**File:** `src/ui/services/api.ts` exports wrapped objects:
```typescript
export const agentsApi = {
  getAgent: async (id) => { const client = getLettaClient(); return await client.agents.retrieve(id); },
  getMemoryBlocks: async (agentId) => { ... },
  createAgent: async (params) => { ... },
  // ... 20+ more methods
};

export const conversationsApi = {
  listConversations: async (agentId) => { ... },
  // ...
};
```

**Used in:**
- `src/ui/store/useAppStore.ts` - imports `agentsApi, conversationsApi`
- `src/ui/components/AgentWorkspace.tsx` - imports `agentsApi`
- `src/ui/components/AgentMemoryPanel.tsx` - imports `agentsApi`
- `src/ui/components/SettingsPanel.tsx` - imports `agentsApi`
- `src/ui/components/agents/AgentWizard.tsx` - imports `agentsApi`
- `src/ui/components/agents/wizard/ModelSelectionStep.tsx` - imports `agentsApi`
- `src/ui/components/agents/wizard/ToolAccessStep.tsx` - imports `agentsApi`
- `src/ui/hooks/useIPC.ts` - imports `agentsApi`
- `src/ui/hooks/useMessageHistory.ts` - imports `conversationsApi`
- `src/ui/hooks/useStreamingMessages.ts` - already uses direct SDK (pattern exists)
- `src/ui/services/slashCommands.ts` - imports `agentsApi`

## Target State (Direct SDK Pattern)

Per `letta-code-new` reference:
```typescript
import { getLettaClient } from '../services/api';

const client = getLettaClient();
const agent = await client.agents.retrieve(id);
const blocks = await client.agents.blocks.list(agentId);
const conversations = await client.conversations.list({ agent_id: agentId });
```

## Migration Steps

### Phase 1: Update Import Exports (1 file)
**File:** `src/ui/services/api.ts`
- Remove `agentsApi` and `conversationsApi` wrapper objects
- Keep `getLettaClient()` export (already exists)
- Keep utility functions (`getApiBase()`, `getApiKey()`)
- Keep `ExternalMemfsStatus` types (used by SettingsPanel)
- Add re-export of `Letta` type if needed by consumers

### Phase 2: Migrate Store (1 file)
**File:** `src/ui/store/useAppStore.ts`
- Change imports: remove `agentsApi, conversationsApi`, keep `getLettaClient`
- In `loadAgent()`: replace `agentsApi.getAgent()` → `client.agents.retrieve()`
- In `loadAgent()`: replace `agentsApi.getMemoryBlocks()` → `client.agents.blocks.list()` (async iterator)
- In `loadAgent()`: replace `conversationsApi.listConversations()` → `client.conversations.list()`
- In `createAgent()`: replace `agentsApi.createAgent()` → `client.agents.create()`
- In `updateAgent()`: replace `agentsApi.updateAgent()` → `client.agents.update()`
- In `deleteAgent()`: replace `agentsApi.deleteAgent()` → `client.agents.delete()`
- In `updateMemoryBlock()`: replace `agentsApi.updateMemoryBlock()` → `client.agents.blocks.update()`
- In `setAgentTools()` actions: replace `agentsApi.attachTool/detachTool` → `client.agents.tools.attach/detach`

### Phase 3: Migrate Hooks (3 files)
**File:** `src/ui/hooks/useMessageHistory.ts`
- Replace `conversationsApi.getMessages()` → `client.conversations.messages.list()`
- Replace `conversationsApi.createConversation()` → `client.conversations.create()`

**File:** `src/ui/hooks/useStreamingMessages.ts`
- Already uses direct SDK - verify consistency

**File:** `src/ui/hooks/useIPC.ts`
- Replace `agentsApi.getAgent()` → `client.agents.retrieve()`

### Phase 4: Migrate Components (6 files)
**File:** `src/ui/components/AgentWorkspace.tsx`
- Replace `agentsApi.getTools()` → `client.agents.tools.list()`
- Replace `agentsApi.listAllTools()` → `client.tools.list()`
- Replace `agentsApi.attachTool/detachTool()` → `client.agents.tools.attach/detach()`

**File:** `src/ui/components/AgentMemoryPanel.tsx`
- Replace `agentsApi.createAgentBlock()` → `client.blocks.create()` + `client.agents.blocks.attach()`
- Replace `agentsApi.detachAgentBlock()` → `client.agents.blocks.detach()`
- Replace `agentsApi.getPassages()` → `client.agents.passages.list()`
- Replace `agentsApi.createPassage()` → `client.agents.passages.create()`
- Replace `agentsApi.deletePassage()` → `client.agents.passages.delete()`

**File:** `src/ui/components/SettingsPanel.tsx`
- Replace `systemApi.detectExternalMemfs()` - keep this utility (it's custom probing logic)

**File:** `src/ui/components/agents/AgentWizard.tsx`
- Replace `agentsApi.createAgent()` → `client.agents.create()`
- Replace `agentsApi.attachTool()` → `client.agents.tools.attach()`

**File:** `src/ui/components/agents/wizard/ModelSelectionStep.tsx`
- Replace `agentsApi.listAllModels()` → `client.models.list()`

**File:** `src/ui/components/agents/wizard/ToolAccessStep.tsx`
- Replace `agentsApi.listAllTools()` → `client.tools.list()`

### Phase 5: Migrate Services (1 file)
**File:** `src/ui/services/slashCommands.ts`
- Replace `agentsApi.sendSlashCommand()` - this is a custom wrapper for SDK sessions
- Keep the slash command logic but use direct SDK `createSession` from `@letta-ai/letta-code-sdk`

## File Change Summary

| Phase | Files | Lines Changed (est) |
|-------|-------|---------------------|
| 1 | `src/ui/services/api.ts` | -150 (removing wrappers) |
| 2 | `src/ui/store/useAppStore.ts` | ~40 imports + ~20 call sites |
| 3 | `src/ui/hooks/*.ts` (3 files) | ~10 call sites |
| 4 | `src/ui/components/*.tsx` (6 files) | ~30 call sites |
| 5 | `src/ui/services/slashCommands.ts` | ~5 call sites |
| **Total** | **11 files** | **~75 call sites** |

## SDK Method Mapping Reference

| Current (Wrapped) | Target (Direct SDK) |
|-------------------|----------------------|
| `agentsApi.getAgent(id)` | `client.agents.retrieve(id)` |
| `agentsApi.getMemoryBlocks(agentId)` | `client.agents.blocks.list(agentId)` (async iter) |
| `agentsApi.createAgent(params)` | `client.agents.create({...params})` |
| `agentsApi.updateAgent(id, updates)` | `client.agents.update(id, updates)` |
| `agentsApi.deleteAgent(id)` | `client.agents.delete(id)` |
| `agentsApi.updateMemoryBlock(agentId, label, value)` | `client.agents.blocks.update(label, {agent_id: agentId, value})` |
| `agentsApi.createAgentBlock(agentId, label, value)` | `client.blocks.create({label, value})` then `client.agents.blocks.attach(blockId, {agent_id: agentId})` |
| `agentsApi.detachAgentBlock(agentId, blockId)` | `client.agents.blocks.detach(blockId, {agent_id: agentId})` |
| `agentsApi.getTools(agentId)` | `client.agents.tools.list(agentId)` |
| `agentsApi.listAllTools()` | `client.tools.list()` |
| `agentsApi.attachTool(agentId, toolId)` | `client.agents.tools.attach(toolId, {agent_id: agentId})` |
| `agentsApi.detachTool(agentId, toolId)` | `client.agents.tools.detach(toolId, {agent_id: agentId})` |
| `agentsApi.getPassages(agentId, query, limit)` | `client.agents.passages.list(agentId, {query, limit})` |
| `agentsApi.createPassage(agentId, text)` | `client.agents.passages.create(agentId, {text})` |
| `agentsApi.deletePassage(agentId, passageId)` | `client.agents.passages.delete(passageId, {agent_id: agentId})` |
| `agentsApi.listAllModels()` | `client.models.list()` |
| `agentsApi.listEmbeddingModels()` | `client.models.embeddings.list()` |
| `conversationsApi.listConversations(agentId)` | `client.conversations.list({agent_id: agentId})` |
| `conversationsApi.getMessages(convId, limit)` | `client.conversations.messages.list(convId, {limit})` (async iter) |
| `conversationsApi.createConversation(agentId)` | `client.conversations.create({agent_id: agentId})` |

## Special Cases

### Async Iterators
SDK returns async iterators for list operations. Current wrappers convert to arrays:
```typescript
// Current wrapper
const blocks: Letta.BlockResponse[] = [];
for await (const block of client.agents.blocks.list(agentId)) {
  blocks.push(block);
}
return blocks;

// Direct usage in component/store - handle iterator
const blocks: Letta.BlockResponse[] = [];
for await (const block of client.agents.blocks.list(agentId)) {
  blocks.push(block);
}
```

### Error Handling
Current wrappers have try/catch that logs and re-throws. Direct SDK usage should follow same pattern:
```typescript
const client = getLettaClient();
try {
  return await client.agents.retrieve(id);
} catch (err) {
  console.error('[Component] Failed to load agent:', err);
  throw err;
}
```

### Session/Streaming
Slash commands use SDK sessions. Keep `createSession` from `@letta-ai/letta-code-sdk`:
```typescript
import { createSession } from '@letta-ai/letta-code-sdk';
const session = createSession(undefined, { permissionMode: 'bypassPermissions' });
```

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking changes during migration | Do Phase 1+2 together (store is foundation) |
| Type errors from SDK shape differences | Verify `Letta.BlockResponse` vs our `MemoryBlock` type |
| Async iterator handling | Test each list operation (blocks, messages, conversations) |
| Error handling inconsistencies | Add consistent error logging at each call site |
| Testing overhead | Build after each phase, test agent load/save/memory operations |

## Recommended Execution Order

1. **Phase 1+2 together** (api.ts + useAppStore.ts) - core foundation
2. **Phase 3** (hooks) - message/streaming functionality
3. **Phase 4** (components) - UI functionality
4. **Phase 5** (slash commands) - edge case functionality
5. **Full test** - agent load, memory blocks, file tree, conversations, messages

## Success Criteria

- [x] `src/ui/services/api.ts` has no `agentsApi`/`conversationsApi` exports
- [x] All imports of `agentsApi`/`conversationsApi` removed from codebase
- [x] `npx tsc --noEmit` passes with zero errors
- [ ] Agent loads with memory blocks visible (manual verify)
- [ ] Memfs file tree populates (manual verify)
- [ ] Memory pressure gauge shows non-zero values (see follow-up: switch to tiktoken)
- [ ] Conversations load and messages send (manual verify)
- [ ] Settings save with diff preview (manual verify)

## Execution log (2026-04-25)

- **Phase 1+2 done.** `api.ts` no longer exports `agentsApi`/`conversationsApi`/`api`.
  Kept: `getLettaClient`, `getApiBase`, `getApiKey`, `resetClient`, type re-exports,
  `systemApi` (custom server probes), `deployApi` (mock), and two free helpers
  `listLLMModels()`/`listEmbeddingModels()` for normalized model shapes used by
  three views. `useAppStore.ts` now calls SDK directly; async block iteration is
  inlined at call sites.
- **Phase 3 done.** `useIPC.ts` uses `getLettaClient()` directly (browser fallback
  path). `useMessageHistory.ts` already used direct SDK before this work.
- **Phase 4 done.** `AgentWorkspace`, `AgentMemoryPanel`, `SettingsPanel`,
  `AgentWizard`, `ModelSelectionStep`, `ToolAccessStep`, `ModelsView` all migrated.
  In `AgentMemoryPanel` the "create block + attach" two-step is factored into a
  local `createAndAttachBlock(label, value)` closure (3 call sites).
- **Phase 5 done.** `slashCommands.ts` uses direct SDK; a small `listAgentBlocks()`
  helper keeps the iterator-to-array boilerplate out of the command bodies.

## Follow-ups discovered during migration

- **Memory pressure gauge uses chars/4 approximation.** Should use `js-tiktoken`
  for accurate counts. Tracked separately.
- **Memfs detection occasionally false-negative.** `isMemfsEnabledAgent()` reads
  `agent.raw.memory.git_enabled` and the `git-memory-enabled` tag, but the
  Enable-memfs button still appears on some already-enabled agents. Needs
  investigation — likely the SDK retrieve response shape differs between
  server builds. Tracked separately.

---
*Plan created: 2026-04-25*
*Migration completed: 2026-04-25*
