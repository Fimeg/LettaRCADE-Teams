<div align="center">

# Letta Community ADE

[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)](https://github.com/Fimeg/letta-oss-ui/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A desktop application for running Letta agents with a visual interface. Built with ❤️ by [Casey Tunturi](https://github.com/Fimeg) and [Annie Tunturi](https://github.com/AniTunturi).

</div>

## Demo

<!-- Replace this with your uploaded video URL -->
<!-- To add your video: drag and drop /home/casey/Videos/recording_2026-04-25_08.47.31.mp4 into a GitHub issue or PR, then copy the generated URL here -->

https://github.com/user-attachments/assets/PLACEHOLDER_UPLOAD_VIDEO_HERE

## What is Letta Community ADE?

**ADE** = Agent Development Environment

Letta Community ADE is a fully-featured desktop application for managing, chatting with, and deploying Letta AI agents. It provides:

- 💬 **Conversational Interface** - Chat with agents using streaming messages
- 🧠 **Memory Management** - View and edit agent memory blocks in real-time
- 🔧 **Agent Configuration** - Manage agent settings, tools, and providers
- 🌐 **Multi-Mode Support** - Connect to local letta-code or remote Letta servers
- 🚀 **Cross-Platform** - macOS, Linux, and Windows builds

Originally forked from [Claude-Cowork](https://github.com/DevAgentForge/Claude-Cowork), this project has evolved into a comprehensive Letta agent management platform using the official [`@letta-ai/letta-client`](https://www.npmjs.com/package/@letta-ai/letta-client) SDK.

## Features

### Agent Management
- Create, edit, and delete agents through an intuitive wizard
- View agent health metrics and memory pressure
- Configure tools, models, and inference settings
- Set favorite agents for quick access

### Memory & Tools
- Browse and edit core memory blocks
- Manage archival memory (passages)
- View tool configurations
- Sacred/protected memory block support

### Connection Modes
- **Server Mode**: Connect to a running Letta server (localhost or remote)
- **Local Mode**: Spawn letta-code CLI directly (with memfs support)

### Slash Commands
- `/doctor` - Diagnose agent health
- `/clear` - Clear conversation history
- `/remember` - Store facts to archival memory
- `/recompile` - Refresh agent configuration
- `/wrapup` - Summarize and close stale conversations

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) or Node.js 22+
- Letta server running locally (default: `http://localhost:8283`) OR
- Letta API key from [app.letta.com/settings](https://app.letta.com/settings)

### Installation

```bash
# Clone the repository
git clone https://github.com/Fimeg/letta-oss-ui.git
cd letta-oss-ui

# Install dependencies
bun install

# Copy environment template
cp .env.example .env
```

### Configuration

Edit `.env`:

```bash
# For local Letta server (default)
LETTA_BASE_URL=http://localhost:8283
LETTA_API_KEY=local-dev-key  # Local server doesn't validate

# OR for Letta Cloud
# LETTA_BASE_URL=https://api.letta.com
# LETTA_API_KEY=your-api-key-here
```

### Running

```bash
# Development mode
bun run dev

# Build for production
bun run build
bun run transpile:electron

# Create distribution packages
bun run dist:mac-arm64  # macOS Apple Silicon
bun run dist:mac-x64    # macOS Intel
bun run dist:win        # Windows
bun run dist:linux      # Linux
```

## Architecture

Letta Community ADE uses the official Letta client SDK for all agent operations:

```typescript
import { Letta } from "@letta-ai/letta-client";

const client = new Letta({ baseURL: "http://localhost:8283" });

// List agents
const agents = await client.agents.list();

// Stream messages
const stream = await client.agents.messages.stream(agentId, {
  messages: [{ role: "user", content: "Hello!" }],
});
```

### Key Components

- **AgentWorkspace** - 3-pane interface (sidebar | chat | details)
- **AgentWizard** - 5-step agent creation flow
- **AgentMemoryPanel** - Memory block management with memfs support
- **ConnectionModeIndicator** - Toggle between local/server modes

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Development notes and architecture
- [CROSS_PLATFORM_BUILD_STATUS.md](./docs/CROSS_PLATFORM_BUILD_STATUS.md) - Build configuration
- [PLAN.md](./docs/PLAN.md) - Active development roadmap

## Contributing

Contributions welcome! Please see our documentation for:
- Engineering patterns in `CLAUDE.md`
- SDK migration notes in `docs/plans/MIGRATE_TO_DIRECT_SDK.md`

## Credits

- **Casey Tunturi** - Primary development
- **Annie Tunturi** - Co-author and collaborator
- [Letta](https://letta.com/) - The agent framework that powers this app
- Original [Claude-Cowork](https://github.com/DevAgentForge/Claude-Cowork) - Base template

## License

MIT License - see LICENSE file for details.

---

<div align="center">

Built with ❤️ for the Letta community

</div>
