import React from 'react';
import {render} from 'ink-testing-library';
// Import from source - ink-markdown is mocked in vitest.setup.ts
import App from '../source/app.js';
import {CopilotProvider} from '../source/agent/copilotContext.js';
import {runCommand} from '../source/core/commands.js';

describe('Kopilot TUI', () => {
	it('initial render shows chat interface with input prompt', () => {
		const {lastFrame} = render(
			<CopilotProvider>
				<App />
			</CopilotProvider>,
		);
		const output = lastFrame();

		// Verify input prompt is present (❯ character)
		expect(output).toContain('❯');

		// During initialization, shows "Initializing Kopilot..."
		// After ready, shows placeholder with "Type @..."
		expect(
			output.includes('Initializing Kopilot') ||
				output.includes('Type @'),
		).toBe(true);
	});

	it('renders without crashing', () => {
		const {unmount} = render(
			<CopilotProvider>
				<App />
			</CopilotProvider>,
		);
		expect(() => unmount()).not.toThrow();
	});

	it('displays all required UI elements', () => {
		const {lastFrame} = render(
			<CopilotProvider>
				<App />
			</CopilotProvider>,
		);
		const output = lastFrame();

		// Check for all key UI components:
		// - Status bar with model info
		expect(output).toContain('GPT-5 mini');

		// - Input area with prompt
		expect(output).toContain('❯');

		// - Keybindings hint
		expect(output).toContain('/help');
	});
});

describe('command handling', () => {
	it('opens model picker for /model without args', async () => {
		const outcome = await runCommand('/model', {
			client: null,
			session: null,
			currentModel: 'GPT-5 mini',
		});

		expect(outcome).toEqual({type: 'open-model-picker'});
	});

	it('sets model for /model <name>', async () => {
		const outcome = await runCommand('/model gpt-4', {
			client: null,
			session: null,
			currentModel: 'GPT-5 mini',
		});

		expect(outcome).toEqual({type: 'set-model', model: 'gpt-4'});
	});

	it('sets reasoning effort for /reasoning <level>', async () => {
		const outcome = await runCommand('/reasoning high', {
			client: null,
			session: null,
			currentModel: 'GPT-5 mini',
		});

		expect(outcome).toEqual({type: 'set-reasoning-effort', effort: 'high'});
	});

	it('rejects invalid reasoning effort', async () => {
		const outcome = await runCommand('/reasoning invalid', {
			client: null,
			session: null,
			currentModel: 'GPT-5 mini',
		});

		expect(outcome?.type).toBe('message');
		expect((outcome as any).kind).toBe('error');
	});

	it('shows usage for /reasoning without args', async () => {
		const outcome = await runCommand('/reasoning', {
			client: null,
			session: null,
			currentModel: 'GPT-5 mini',
		});

		expect(outcome?.type).toBe('message');
		expect((outcome as any).message).toContain('Usage');
	});

	it('shows hooks info for /hooks', async () => {
		const outcome = await runCommand('/hooks', {
			client: null,
			session: null,
			currentModel: 'GPT-5 mini',
		});

		expect(outcome?.type).toBe('message');
		expect((outcome as any).message).toContain('Session Hooks');
		expect((outcome as any).message).toContain('onPreToolUse');
	});

	it('shows default provider for /provider', async () => {
		const outcome = await runCommand('/provider', {
			client: null,
			session: null,
			currentModel: 'GPT-5 mini',
		});

		expect(outcome?.type).toBe('message');
		expect((outcome as any).message).toContain('default GitHub Copilot');
	});

	it('shows no MCP servers for /mcp', async () => {
		const outcome = await runCommand('/mcp', {
			client: null,
			session: null,
			currentModel: 'GPT-5 mini',
		});

		expect(outcome?.type).toBe('message');
		expect((outcome as any).message).toContain('No MCP servers');
	});

	it('shows no agents for /agent', async () => {
		const outcome = await runCommand('/agent', {
			client: null,
			session: null,
			currentModel: 'GPT-5 mini',
		});

		expect(outcome?.type).toBe('message');
		expect((outcome as any).message).toContain('No custom agents');
	});

	it('resolves /agents alias', async () => {
		const outcome = await runCommand('/agents', {
			client: null,
			session: null,
			currentModel: 'GPT-5 mini',
		});

		expect(outcome?.type).toBe('message');
		expect((outcome as any).message).toContain('No custom agents');
	});
});

// Note: Full integration tests with stdin.write() have compatibility issues
// with current versions of ink-testing-library and Ink v5.
// The app works correctly when run with `npm run dev` - test it manually:
// 1. Type a message and press Enter
// 2. Watch the spinner appear with "Thinking..."
// 3. See the assistant response stream in word-by-word
// 4. Notice markdown formatting (bullet lists, code blocks)
// 5. Input is disabled during streaming
