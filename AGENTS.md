# AGENTS.md

This file provides guidance for AI agents working with this codebase.

## Primary Documentation

All agents should first consult [CLAUDE.md](CLAUDE.md) for:

- Project overview and architecture
- Build, run, and test commands
- Key architectural patterns (streaming, SDK lifecycle, state management)
- Testing strategy and mock setup
- Module configuration
- Common modifications and known issues
- Code style guidelines

## SDK Reference

For GitHub Copilot SDK specifics, see [.github/instructions/copilot-sdk-nodejs.instructions.md](.github/instructions/copilot-sdk-nodejs.instructions.md) which covers:

- Client initialization and configuration options
- Session management (create, resume, destroy)
- Event handling patterns and event types
- Streaming response handling
- Custom tool definitions with `defineTool`
- System message customization
- File attachments
- Error handling and resource cleanup
- TypeScript-specific features and type safety

## Quick Reference

### Running the App

```bash
npm run build && npm start
```

### Running Tests

```bash
npm test
```

### Key Files

| File | Purpose |
|------|---------|
| `source/cli.tsx` | Entry point with CopilotProvider |
| `source/app.tsx` | Main UI component |
| `source/agent/copilotContext.tsx` | SDK client/session lifecycle |
| `source/agent/copilotAgent.ts` | Streaming adapter |

### Terminal Requirements

Only use proper TTY terminals (PowerShell, Windows Terminal, cmd.exe). Git Bash and WSL are not supported.
