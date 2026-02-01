# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **terminal-based Copilot client** built with Ink (React for CLIs). It provides streaming responses, markdown rendering, and a command system designed to scale toward a full Copilot CLI experience. The app uses the **GitHub Copilot SDK** to provide real LLM-powered conversations with persistent conversation history.

## Commands

### Build and Run

```bash
# Build TypeScript to dist/
npm run build

# Run the compiled app (requires proper TTY terminal)
npm start

# Development mode (run directly with tsx, no watch)
npm run dev

# Development with watch mode (may have TTY issues)
npm run dev:watch
```

### Testing

```bash
# Run all tests (automatically builds first via pretest hook)
npm test

# Watch mode for test development
npm run test:watch

# Run with linting and formatting checks
npm run test:full
```

### Important Terminal Requirements

**The app ONLY works in proper TTY terminals on Windows:**

- ✅ PowerShell, Windows Terminal, cmd.exe
- ❌ Git Bash, WSL/WSL2 (will show "Raw mode is not supported" errors)

When testing locally, always use PowerShell or Windows Terminal.

## Architecture

### Component Structure

```
source/
├── cli.tsx                    - Entry point, wraps app with CopilotProvider
├── app.tsx                    - Main UI component with chat logic
├── agent/
│   ├── copilotContext.tsx     - React Context for Copilot client/session lifecycle
│   └── copilotAgent.ts        - Async generator adapter for SDK streaming
└── core/
    ├── cliConfig.ts           - CLI flag parsing
    ├── config.ts              - Runtime configuration defaults
    ├── commands.ts            - Command registry and parser
    ├── mentions.ts            - @file mention resolution
    └── logger.ts              - Structured logging
```

### Key Architectural Patterns

#### 1. Streaming with GitHub Copilot SDK

The Copilot agent in `source/agent/copilotAgent.ts` bridges SDK events to async generators:

```typescript
export async function* streamResponse(
	userMessage: string,
	session: CopilotSession,
): AsyncGenerator<string>;
```

- Subscribes to `assistant.message.delta` events from the SDK
- Yields response chunks as they arrive from Copilot
- App consumes via `for await...of` loop in `handleSubmit`
- Each chunk triggers a state update to append to message content
- Uses persistent session for conversation history

#### 2. Dynamic Markdown Loading

The `Markdown` component in `app.tsx` uses **dynamic import** to load ink-markdown:

```typescript
useEffect(() => {
	import('ink-markdown')
		.then(module => {
			// Handle CJS/ESM default export variations
			const Component = /* extract default */;
			setMarkdownComponent(() => Component);
		})
		.catch(() => setMarkdownComponent(() => Text));
}, []);
```

**Why dynamic import?**

- Avoids top-level `await` issues with ESM modules
- Handles ink-markdown's CJS/ESM hybrid export structure
- Provides graceful fallback to plain Text on import failure
- Shows dimmed placeholder during ~10-50ms initial load

#### 3. Copilot Client Lifecycle

The `CopilotProvider` in `source/agent/copilotContext.tsx` manages SDK lifecycle:

```typescript
type CopilotContextType = {
	client: CopilotClient | null;
	session: CopilotSession | null;
	status: 'starting' | 'ready' | 'error' | 'stopped';
	error: Error | null;
	config: RuntimeConfig;
	actions: { createSession: (...), resumeSession: (...), stop: (...) };
};
```

- Initializes client on mount with `client.start()`
- Creates persistent session for conversation history
- Exposes state via React Context (`useCopilot` hook)
- Cleans up session and client on unmount
- Uses refs to prevent cleanup race conditions

#### 4. Message State Model

```typescript
type Message = {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	isStreaming?: boolean;
};
```

- Messages array contains full chat history
- `isStreaming` flag controls spinner visibility
- Input disabled while `isStreaming === true` or `!isReady` (conditional rendering)
- Shows "Initializing Copilot..." during SDK startup

#### 5. Entry Point Pattern

`source/cli.tsx` wraps everything in async `main()` function and CopilotProvider:

```typescript
async function main() {
	const {waitUntilExit, clear} = render(
		<CopilotProvider>
			<App />
		</CopilotProvider>
	);
	// Signal handlers for SIGINT/SIGTERM
	await waitUntilExit();
}
main().catch(error => {
	console.error('Fatal error:', error);
	process.exit(1);
});
```

This avoids top-level `await` which causes module loading issues. The CopilotProvider initializes the SDK and provides context to the app.

## Testing Strategy

### Test Environment Setup

- **Test runner**: Vitest (v4)
- **Mocking**: `vitest.setup.ts` mocks both ink-markdown and @github/copilot-sdk
- **Setup file**: Configured in `vitest.config.ts` with `setupFiles: ['./vitest.setup.ts']`

### Why Mock Dependencies in Tests?

**ink-markdown:**
1. Has top-level await in its dependency chain
2. Vitest's ESM loader conflicts with CJS require()
3. Mocking avoids stderr warnings about module loading

**@github/copilot-sdk:**
1. Requires GitHub CLI to be installed and authenticated
2. Tests need to run in CI/CD without GitHub credentials
3. Mock simulates streaming behavior for consistent tests

The mocks in `vitest.setup.ts`:

```typescript
// Mock ink-markdown
vi.mock('ink-markdown', () => {
	return {
		default: ({children}: {children: string}) =>
			React.createElement('text', null, children),
	};
});

// Mock Copilot SDK
vi.mock('@github/copilot-sdk', () => {
	return {
		CopilotClient: class MockCopilotClient {
			async start() { return Promise.resolve(); }
			async stop() { return Promise.resolve(); }
			async createSession() {
				return {
					sessionId: 'test-session',
					on(handler: (event: any) => void) {
						// Simulates streaming events
						setTimeout(() => {
							handler({ type: 'assistant.message.delta', data: { deltaContent: 'Test ' } });
							handler({ type: 'assistant.message.delta', data: { deltaContent: 'response' } });
							handler({ type: 'session.idle' });
						}, 10);
						return () => {}; // unsubscribe
					},
					async send() { return Promise.resolve(); },
					async destroy() { return Promise.resolve(); },
				};
			}
		},
	};
});
```

### Running Single Test

```bash
# Run specific test file
npx vitest run test.spec.tsx

# Run with file pattern
npx vitest run --grep "initial render"
```

## Module Configuration

- **Type**: ESM (`"type": "module"` in package.json)
- **Module resolution**: node16 (inherited from @sindresorhus/tsconfig)
- **Target**: ES2020
- **Output**: dist/ with .js extensions (ESM)

## Common Modifications

### Prerequisites for Running the App

The app requires **GitHub Copilot CLI** to be installed and authenticated:

```bash
# Verify GitHub CLI is installed
gh --version

# Check Copilot extension
gh copilot --version

# Authenticate if needed
gh auth login
```

Without GitHub Copilot access, the app will show an initialization error.

### Changing Copilot Model

Edit `source/agent/copilotContext.tsx` and modify the session configuration:

```typescript
const copilotSession = await copilotClient.createSession({
	streaming: true,
	model: 'GPT-5 mini', // <-- Change model here (e.g., 'gpt-4', 'gpt-3.5-turbo')
});
```

### Changing UI Layout

Main UI structure is in `source/app.tsx` return statement:

- **Header**: Lines 118-130 (title + spinner)
- **Transcript**: Lines 132-152 (message list)
- **Input**: Lines 154-176 (prompt + TextInput with initialization states)

### Disabling Markdown Rendering

To temporarily disable markdown (e.g., for debugging), change the `Markdown` component to always return `<Text>{children}</Text>`.

## Known Issues and Workarounds

### TTY Requirement

Ink requires raw mode for input, which Git Bash doesn't provide. No workaround - use proper terminals only.

### ink-markdown Type Errors

If you see TypeScript errors about ink-markdown types, use type assertions:

```typescript
const Component = InkMarkdown as unknown as React.ComponentType<{
	children: string;
}>;
```

The library has mixed CJS/ESM exports that confuse TypeScript but work at runtime.

### Test Warnings About TextInput

stderr warnings about TextInput's `stdin.ref` are expected in tests due to ink-testing-library compatibility with Ink v5. Tests still pass. Ignore these warnings.

## Code Style

- Formatting: Prettier (config from @vdemedes/prettier-config)
- Linting: xo with xo-react (configured in package.json)
- Semicolons: Required (explicit in xo config)
- Tabs: Used for indentation

## Additional References

- **GitHub Copilot SDK Guide**: See [.github/instructions/copilot-sdk-nodejs.instructions.md](.github/instructions/copilot-sdk-nodejs.instructions.md) for comprehensive SDK documentation including client initialization, session management, event handling, streaming, custom tools, and best practices.
