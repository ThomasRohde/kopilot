<div align="center">

# Kopilot

**A terminal-based AI assistant powered by the GitHub Copilot SDK**

[![Node.js 18+](https://img.shields.io/badge/node-18%2B-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Copilot SDK](https://img.shields.io/badge/Copilot%20SDK-0.1.22-purple)](https://github.com/github/copilot-sdk)

<img src="screenshot.png" alt="Kopilot in action" width="700">

*A streaming TUI chat client and template for building domain-specific AI assistants*

</div>

---

## Why Kopilot?

Kopilot isn't just a chat client—it's a **starting point for building your own custom copilots**. The GitHub Copilot SDK lets you create specialized AI assistants with custom tools, and Kopilot provides the foundation:

- 🔧 **Add Tools** — Define domain-specific capabilities (database queries, API calls, file operations)
- 💬 **Customize the Prompt** — Shape how your assistant behaves and what it knows
- 🖥️ **Extend the UI** — Build on the streaming TUI with your own commands
- 🌍 **Deploy Globally** — Use `npm install -g .` to install your copilot as a CLI tool
- 🤖 **Custom Agents** — Create specialized sub-agents for specific tasks
- 🔌 **MCP Integration** — Connect to external tool servers via Model Context Protocol

Whether you're building a database assistant, a DevOps helper, or a specialized coding tool, Kopilot gives you the scaffolding to get started fast.

## Quick Start

### Prerequisites

- **Node.js 18+**
- **GitHub Copilot CLI** installed and authenticated:
  ```bash
  gh copilot --version   # Verify installation
  gh auth login          # Authenticate if needed
  ```
- **TTY terminal** on Windows (PowerShell, Windows Terminal, cmd.exe—not Git Bash or WSL)

### Installation

```bash
git clone https://github.com/ThomasRohde/kopilot.git
cd kopilot
npm install
npm run build
npm start
```

### Global Installation

Install Kopilot as a global CLI command from your cloned repo:

```bash
npm install -g .
kopilot  # Run from anywhere
```

To apply changes after editing the source:

```bash
npm run build
npm install -g .
```

## Features

### Interactive Features

- **Token Usage Tracking** — See token consumption and estimated costs after each response
- **Reasoning Display** — View reasoning traces from capable models (o1, o3, etc.)
- **Interactive Permissions** — Approve/deny tool operations (shell commands, file writes, URLs)
- **User Input Prompts** — Tools can ask questions with multiple-choice or freeform input
- **Infinite Sessions** — Automatic context compaction for unlimited conversation length
- **Turn Lifecycle** — Real-time status updates ("Thinking..." → "Responding...")

### Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/model [name]` | Switch AI model (interactive picker or specify name) |
| `/reasoning [level]` | Set reasoning effort: low, medium, high, xhigh |
| `/session [action]` | Manage sessions: list, new, resume <id>, delete <id> |
| `/status` | Show SDK version, auth status, and configuration |
| `/hooks` | Show available session hook types |
| `/provider` | Show current provider configuration |
| `/mcp` | Show configured MCP servers |
| `/agent` / `/agents` | Show configured custom agents |
| `/ping` | Ping the Copilot server |
| `/clear` | Clear the screen |
| `/exit` | Exit Kopilot |

### File Attachments

Attach files to your prompt using `@path`:

```
@src/app.tsx What does this component do?
@package.json @tsconfig.json Compare these configs
@"my file.txt" Files with spaces need quotes
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Esc` | Cancel streaming response |
| `Ctrl-C` (twice) | Exit Kopilot |
| `Ctrl-D` | Exit (when not streaming) |
| `Up/Down` | Navigate command/file picker |
| `Up/Down` | Navigate input history when not in picker |
| `//` | Send literal `/` at start of message |

## CLI Options

```
kopilot [options]

Options:
  -m, --model <name>         Model name (default: GPT-5 mini)
  -s, --session <id>         Resume a specific session
  --resume-last              Resume the last session
  --no-banner                Disable startup banner
  --no-color                 Disable ANSI colors
  --log-level <level>        debug|info|warn|error (default: info)
  --cli-path <path>          Path to Copilot CLI executable
  --cli-url <url>            Connect to existing CLI server
  --port <number>            Port for spawned CLI server
  --stdio                    Use stdio transport
  --cwd <path>               Working directory for CLI
  --timeout <ms>             Idle timeout (default: 120000)
  --max-attachment-kb <kb>   Max file attachment size (default: 512)
```

## Configuration Files

Kopilot supports configuration files for persistent settings. Settings are loaded with the following priority (highest to lowest):

1. **CLI flags** (e.g., `--model gpt-4`)
2. **Environment variables** (e.g., `KOPILOT_MODEL=gpt-4`)
3. **Project config** (`.kopilot.json` in current directory)
4. **User config** (`~/.kopilot/config.json`)
5. **Defaults**

### User Configuration

Create `~/.kopilot/config.json` for personal defaults that apply to all projects:

```json
{
  "model": "gpt-4",
  "logLevel": "info",
  "banner": false,
  "maxAttachmentKb": 256,
  "reasoningEffort": "medium",
  "infiniteSessions": true
}
```

### Project Configuration

Create `.kopilot.json` in your project root for project-specific settings:

```json
{
  "model": "GPT-5 mini",
  "idleTimeoutMs": 300000,
  "models": ["GPT-5 mini", "gpt-4", "o3-mini"],
  "customAgents": [
    {
      "name": "code-reviewer",
      "displayName": "Code Reviewer",
      "description": "Reviews code for quality and best practices",
      "prompt": "You are a code reviewer. Focus on code quality, security, and best practices.",
      "tools": ["read_file", "search_code"]
    }
  ],
  "mcpServers": {
    "database": {
      "type": "http",
      "url": "http://localhost:3000",
      "tools": ["query_database", "list_tables"]
    }
  }
}
```

### Available Settings

| Setting | Type | Description |
|---------|------|-------------|
| `model` | string | Default AI model to use |
| `reasoningEffort` | `"low"` \| `"medium"` \| `"high"` \| `"xhigh"` | Reasoning level for capable models |
| `logLevel` | `"debug"` \| `"info"` \| `"warn"` \| `"error"` | Logging verbosity |
| `banner` | boolean | Show/hide startup banner |
| `maxAttachmentBytes` | number | Max file attachment size in bytes |
| `maxAttachmentKb` | number | Max file attachment size in KB (convenience alias) |
| `idleTimeoutMs` | number | Response timeout in milliseconds |
| `models` | string[] | List of available models for `/model` picker |
| `infiniteSessions` | boolean | Enable automatic context compaction (default: true) |
| `provider` | object | Custom LLM provider configuration (OpenAI, Azure, Anthropic) |
| `mcpServers` | object | MCP server configurations for external tools |
| `customAgents` | array | Custom agent definitions for specialized tasks |

### Advanced Configuration

#### Custom Provider (BYOK)

Connect to custom LLM providers:

```json
{
  "provider": {
    "type": "openai",
    "baseUrl": "http://localhost:11434/v1",
    "wireApi": "completions"
  }
}
```

**Security Note:** Never put `apiKey` or `bearerToken` in config files. Use environment variables:
```bash
export COPILOT_API_KEY="your-key-here"
```

#### MCP Servers

Connect external tool servers:

```json
{
  "mcpServers": {
    "local-tools": {
      "type": "stdio",
      "command": "node",
      "args": ["./mcp-server.js"],
      "env": {"DEBUG": "1"},
      "tools": ["custom_tool"]
    },
    "remote-api": {
      "type": "http",
      "url": "https://api.example.com/mcp",
      "headers": {"Authorization": "Bearer ${MCP_TOKEN}"},
      "tools": ["api_call"]
    }
  }
}
```

#### Custom Agents

Define specialized sub-agents:

```json
{
  "customAgents": [
    {
      "name": "test-writer",
      "displayName": "Test Writer",
      "description": "Generates comprehensive test cases",
      "prompt": "You are a test writing expert. Generate thorough unit and integration tests.",
      "tools": ["read_file", "write_file", "run_command"]
    }
  ]
}
```

---

## Building Your Custom Copilot

### Project Structure

```
source/
├── cli.tsx                 # Entry point
├── app.tsx                 # Main TUI component
├── agent/
│   ├── copilotAgent.ts     # Streaming adapter for SDK
│   ├── copilotContext.tsx  # Client/session lifecycle
│   └── tools.ts            # ⭐ ADD YOUR TOOLS HERE
├── ui/
│   ├── MessageList.tsx     # Chat message display
│   ├── PermissionPrompt.tsx # Interactive permission UI
│   └── UserInputPrompt.tsx  # User input collection
└── core/
    ├── cliConfig.ts        # CLI argument parsing
    ├── config.ts           # ⭐ CUSTOMIZE SYSTEM PROMPT HERE
    ├── configLoader.ts     # Config file loading
    ├── commands.ts         # Command registry
    ├── mentions.ts         # @file resolution
    └── logger.ts           # Structured logging
```

### Adding Custom Tools

Tools let your copilot perform actions. Define them in `source/agent/tools.ts`:

```typescript
import {defineTool} from '@github/copilot-sdk';

export const listTables = defineTool('list_tables', {
  description: 'List all tables in the database',
  parameters: {
    type: 'object',
    properties: {
      database: {type: 'string', description: 'Path to SQLite database'},
    },
    required: ['database'],
  },
  handler: async ({database}) => {
    const tables = await db.query("SELECT name FROM sqlite_master WHERE type='table'");
    return {tables};
  },
});

// Add to default tools
export const defaultTools = [listTables, /* ... */];
```

### Customizing the System Prompt

Shape your assistant's behavior in `source/core/config.ts`:

```typescript
export const DEFAULTS: RuntimeConfig = {
  sessionConfig: {
    model: 'GPT-5 mini',
    streaming: true,
    infiniteSessions: {enabled: true},
    systemMessage: {
      mode: 'append',  // Adds to default Copilot system prompt
      content: `You are a database assistant specialized in SQLite.
Available tools: list_tables, query_database, describe_table.
Always explain your queries before executing them.`,
    },
  },
};
```

### Interactive Permission Handling

Kopilot prompts for permission before executing sensitive operations:

- **Shell commands** — Shows command before execution
- **File writes** — Shows path before writing
- **URL fetches** — Shows URL before fetching
- **MCP calls** — Shows server before calling

Implement custom permission logic in `copilotContext.tsx`:

```typescript
const permissionHandler = useCallback(
  (request: PermissionRequest) => {
    // Add custom validation logic
    if (request.kind === 'shell' && isBlockedCommand(request.command)) {
      return Promise.resolve({kind: 'denied-by-system'});
    }
    // Default: prompt user
    return new Promise((resolve) => {
      setPermissionRequest({request, resolve});
    });
  },
  []
);
```

---

## Development

### Build & Test

```bash
npm run build        # Compile TypeScript
npm run dev          # Run with tsx (development)
npm test             # Run tests
npm run test:watch   # Watch mode
npm run test:full    # Lint + format + test
```

### Architecture

**Streaming Flow:**
1. User submits message → `handleSubmit` in `app.tsx`
2. `streamResponse` creates async generator from SDK events
3. Typed event handlers (`assistant.message_delta`, `assistant.usage`, etc.) emit data
4. React state updates trigger re-render with new content

**Tool Execution Flow:**
1. SDK determines tool call is needed
2. `tool.execution_start` event fires → UI shows "🔧 Calling tool: <name>"
3. Handler executes in `tools.ts` and returns result
4. SDK incorporates result into response

**Permission Flow:**
1. Tool requires permission → SDK calls `onPermissionRequest`
2. Context sets `pendingPermission` state + creates Promise
3. UI renders `PermissionPrompt` component
4. User presses Y/N → Promise resolves with result
5. SDK receives permission and proceeds/cancels

## Troubleshooting

### "Raw mode is not supported"

You're using an unsupported terminal. On Windows, use PowerShell, Windows Terminal, or cmd.exe. Git Bash and WSL are not supported.

### "Failed to initialize Copilot"

Verify GitHub Copilot CLI is installed and authenticated:

```bash
gh copilot --version
gh auth status
```

### Tools not being called

1. Check tool is exported in `defaultTools` array
2. Verify `description` clearly explains when to use the tool
3. Add tool instructions to `systemMessage` in config
4. Check permission handler isn't blocking the tool

### Tests failing with "No test suite found"

This is a Vitest v4 + `globals: true` issue. Do NOT import `describe`, `it`, `expect` from 'vitest' in test files. Only import `vi` for mocking.

---

## SDK Version

This project uses **GitHub Copilot SDK v0.1.22** with full support for:

- ✅ Typed event handlers
- ✅ Token usage tracking
- ✅ Turn lifecycle events
- ✅ Reasoning effort control
- ✅ Infinite sessions (context compaction)
- ✅ Interactive permission handling
- ✅ User input requests
- ✅ Session hooks
- ✅ Custom providers (BYOK)
- ✅ MCP server integration
- ✅ Custom agents

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
