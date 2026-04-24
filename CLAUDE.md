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

```typescript
interface MemoryBlock {
  id: string;
  label: string;
  value: string;  // Raw string value
  limit?: number;
}
```

Use `value` field (not `content`).

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

`/home/casey/Projects/letta-oss-ui/src/ui/services/api.ts`
- Uses `@letta-ai/letta-client` for native API
- Both `agentsApi` and `chatApi` exported
- Also legacy combined `api` export for compatibility

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
