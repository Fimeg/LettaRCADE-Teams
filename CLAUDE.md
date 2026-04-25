# Letta OSS UI - Development Notes

## The 4 Official Letta Projects

We work with 4 reference projects for Letta development:

1. **Letta-Code-SDK** (version 0.1.14)
   - Package: `@letta-ai/letta-code-sdk`
   - Spawns CLI process for sessions
   - Located in `node_modules/@letta-ai/letta-code-sdk`

2. **OSS-UI/LettaCoWork** (sdk version 0.0.5)
   - This project - what Letta officially released to self-hosters
   - Location: `/home/casey/Projects/letta-oss-ui`
   - Uses legacy SDK 0.0.5 patterns in some places

3. **Hacked Letta-Code-App** (MODERN examples, newer than SDK)
   - Location: `/home/casey/Projects/letta-code-new`
   - Has working examples NEWER than the SDK
   - PRIMARY reference for modern patterns
   - Uses `@letta-ai/letta-client` package

4. **Letta-AI Server** (version 16.7)
   - The Docker server we work against
   - REST API at `http://localhost:8283`
   - Native endpoints under `/v1/`

## Correct Architecture Pattern

DO NOT build custom wrapper APIs like community-ade did. Use:

### Native Letta Client (Primary)
```typescript
import { Letta } from "@letta-ai/letta-client";

const client = new Letta({ baseURL: "http://localhost:8283" });

// Agents
const agents = await client.agents.list();
const agent = await client.agents.create({ ... });
await client.agents.delete(agent.id);

// Memory blocks
const blocks = await client.agents.blocks.list(agentId);
await client.agents.blocks.update(label, { agent_id: agentId, value: "..." });

// Archival memory (passages)
const passages = await client.agents.passages.list(agentId);
await client.agents.passages.create(agentId, { text: "..." });

// Streaming messages
const stream = await client.agents.messages.stream(agentId, {
  messages: [{ role: "user", content: "..." }],
});
for await (const chunk of stream) {
  // chunk.message_type: "assistant_message" | "reasoning_message" | "tool_call_message" | "tool_return_message" | "ping"
}
```

### SDK for CLI Sessions (Secondary)
```typescript
import { createSession, resumeSession } from "@letta-ai/letta-code-sdk";

// For slash commands and local letta-code integration
const session = createSession(undefined, { permissionMode: "bypassPermissions" });
await session.send(message);
for await (const msg of session.stream()) { ... }
```

## Gitea Issues Reference

Feature ports from community-ade:
- #6: Slash commands (/doctor, /clear, /remember, /recompile)
- #7: Curator health and sacred blocks
- #8: Archival memory management
- #9: Connection mode indicator (local/server)
- #10: Agent creation wizard

Note: These reference community-ade endpoints. Map to native Letta client:
- `/api/agents/{id}/passages` → `client.agents.passages.*`
- `/api/curator/agents/{id}/health` → Use memory blocks API
- `/api/commands/{cmd}` → Use SDK `createSession` + `session.send()`

## Message Types (SDK 0.1.14+)

Streaming yields these message types:
- `assistant_message` - Response content
- `reasoning_message` - Chain of thought
- `tool_call_message` - Tool invocation
- `tool_return_message` - Tool result
- `ping` - Keepalive

## Memory Block Format (SDK 0.1.14+)

Server responses can carry either shape. The store-level `MemoryBlock` keeps both
fields populated for backwards compat:

```typescript
interface MemoryBlock {
  id: string;
  label: string;
  value?: string;                     // legacy field (still set by store)
  content?: string | { text?: string }; // SDK 0.1.14 field
  limit?: number;                     // character limit, not tokens
}
```

When reading a block's text, prefer `content` then fall back to `value`. The
`extractBlockText` / `extractBlockValue` helpers in `useAppStore.ts` and
`utils/memoryHealth.ts` encapsulate this — use them instead of inlining the
ladder.

**`limit` is in characters**, not tokens. The pressure ratio in
`calculateMemoryHealth` uses chars for that reason. Token counts (via
`utils/tokens.ts` → `js-tiktoken` `cl100k_base`) are display-only — close enough
to Claude's tokenizer for a UI gauge, **not** for billing.

## Memfs detection (3-signal hierarchy)

`isMemfsEnabledAgent(input)` in `useAppStore.ts` checks signals in this order;
first match wins:

1. `agent.memory.git_enabled === true` — authoritative; flipped server-side by
   `/memfs enable` or a `PATCH /v1/agents/{id}` with `{"memory":{"git_enabled":true}}`.
2. `agent.tags` contains `git-memory-enabled` — legacy fallback; not reliable
   across Letta server versions.
3. Any block in `memoryBlocks` has a slash in its `label` (e.g. `system/skills/git.md`)
   — structural fallback because some SDK retrieve responses omit signal #1.

Pass `{ memory, tags, memoryBlocks }` together so all three are checked. The
old `(tags)` array shape is kept for back-compat (tag-only check).

## Development Server

```bash
npm run dev  # Starts Vite + Electron concurrently
```

Vite dev server runs at `http://localhost:5173`

## Build

```bash
npm run build  # TypeScript check + Vite build
npm run transpile:electron  # Compile Electron code
```

## API Service Location

`src/ui/services/api.ts` is intentionally thin after the 2026-04-25 migration:

- **`getLettaClient()`** — singleton SDK client, the primary export. Use this
  directly; do not write wrapper objects on top of it.
- **`getApiBase()` / `getApiKey()` / `resetClient()`** — client lifecycle helpers
  for the settings panel.
- **Type re-exports** — `AgentState`, `BlockResponse`, `Tool`, `Passage`,
  message types, `Conversation`.
- **`listLLMModels()` / `listEmbeddingModels()`** — free helpers that wrap
  `client.models.list()` / `client.models.embeddings.list()` and normalize the
  raw shape into `{id, name, provider, contextWindow}`. Three call sites need
  this same normalization (settings panel, model wizard step, `ModelsView`),
  so it's worth a helper. **Not** a wrapper — just shared shape mapping.
- **`systemApi`** — custom probes that aren't in the SDK (external-memfs
  detection via `/openapi.json`, `checkServerHealth`).
- **`deployApi`** — mock-only deploy stubs.

The legacy `agentsApi`, `conversationsApi`, and combined `api` exports are
**gone**. If you find yourself wanting to add one, instead:
- Inline the SDK call at the consumer (1–2 sites)
- OR add a small free function in `api.ts` (3+ consumers needing identical
  shape normalization)
- Async iterators (`for await`) get inlined at the call site too — don't add
  helper objects just to convert iterator → array.

## Engineering patterns established

Patterns that recur in this codebase. Follow these before inventing new ones.

**Direct SDK, no wrappers.** See "API Service Location" above. The migration
migration that landed in 2026-04-25 (the wrapper layer we ripped out is the
relevant rationale).

**`agent.raw` carries the full server object.** `useAppStore.loadAgent` stashes
the SDK's `AgentState` response under `agent.raw`. Downstream consumers
(`AgentWorkspace`, `AgentMemoryPanel`) cast it with a narrow shape and read
fields directly — there's no flattened mirror, just `raw.llm_config`,
`raw.memory.git_enabled`, `raw.tags`, etc. Don't introduce parallel typed fields.

**localStorage as a cross-component coordination seam.** When a control on
surface A needs to influence behavior on surface B without prop-drilling, write
a per-agent localStorage key from A and read it in B's `useState` initializer
+ a `useEffect` keyed on agent id (so re-navigation re-syncs). Examples:
- `letta:focus-mode:{agentId}` — Home dashboard's Chat button writes `'true'`,
  `AgentWorkspace` reads it.
- `letta-community-ade:favorite-agent` — `useAppStore` reads it on init,
  writes via `setFavoriteAgentId`.
- `letta_default_llm` / `letta_default_embedding` — settings panel writes,
  agent wizard reads.

**Conditional `<PanelGroup>` children + a `key` swap.** When toggling between
layouts using `react-resizable-panels` (e.g. Focus Mode collapsing 3 panes
to 1), conditionally render the side panels and **swap the `PanelGroup`'s
`key`** between modes. Without the key, leftover panel sizes bleed across.

**Navigation contract: same destination, different intent.** When one helper
opens the same surface for several semantically distinct user actions, take a
mode arg. Example: `openFavoriteAgent(id, mode: 'focus' | 'full')` — Chat sends
`'focus'`, Memory/Settings send `'full'`. Don't create three separate handlers
that diverge only in side effects; one handler with intent is clearer.

**Limit semantics: server unit for math, display unit for UI.** Memory block
`limit` is in characters server-side, so the pressure ratio uses chars. Token
counts (cl100k_base via tiktoken) are *display only* and are computed once in
`calculateMemoryHealth` so the gauge can show real numbers without re-encoding
elsewhere.

**Defensive fallbacks belong in the detection function, not call sites.** The
3-signal memfs hierarchy (see above) lives entirely in `isMemfsEnabledAgent`.
Call sites just pass `{memory, tags, memoryBlocks}` and trust the result.

---

## Additional Reference (from memory)

### The 4 Projects Breakdown

1. **Letta-Code-SDK** (version 0.1.14)
   - Location: `node_modules/@letta-ai/letta-code-sdk` or reference projects using it
   - The official SDK package for Letta integration

2. **OSS-UI/LettaCoWork** (sdk version 0.0.5)
   - Location: `/home/casey/Projects/letta-oss-ui`
   - What Letta officially released to self-hosters
   - Uses legacy SDK 0.0.5 patterns

3. **Hacked Letta-Code-App** (MODERN examples, newer than SDK)
   - Location: `/home/casey/Projects/letta-code-new`
   - Has working examples NEWER than the SDK
   - This is the PRIMARY reference for modern patterns

4. **Letta-AI Server** (version 16.7)
   - The server we work against
   - REST API endpoints at `/v1/agents`, `/v1/blocks`, etc.

### Architecture Principle

- DO NOT build custom wrapper APIs like community-ade did
- Use the patterns from the hacked app (letta-code-new)
- Use native Letta REST API directly where needed
- Use SDK 0.1.14 patterns from the hacked app examples
- The hacked app has the most up-to-date working examples
