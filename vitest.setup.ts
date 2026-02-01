import {vi} from 'vitest';
import React from 'react';

// Mock ink-markdown to avoid ESM/CJS and top-level await issues in tests
vi.mock('ink-markdown', () => {
	return {
		default: ({children}: {children: string}) =>
			React.createElement('text', null, children),
	};
});

// Mock ink-text-input to avoid TTY/raw mode issues in tests
vi.mock('ink-text-input', () => {
	return {
		default: ({
			value,
			placeholder,
		}: {
			value?: string;
			placeholder?: string;
		}) =>
			React.createElement('text', null, value ?? placeholder ?? ''),
	};
});

// Mock GitHub Copilot SDK to allow tests to run without GitHub CLI
vi.mock('@github/copilot-sdk', () => {
	return {
		CopilotClient: class MockCopilotClient {
			private sessions = [{sessionId: 'test-session', summary: 'Test'}];

			constructor(_options?: unknown) {
				// ignore options
			}

			async start() {
				return Promise.resolve();
			}

			async stop() {
				return Promise.resolve();
			}

			async createSession() {
				return {
					sessionId: 'test-session',
					on(handler: (event: any) => void) {
						// Simulate streaming after short delay
						setTimeout(() => {
							handler({
								type: 'assistant.message.delta',
								data: {deltaContent: 'Test '},
							});
							handler({
								type: 'assistant.message.delta',
								data: {deltaContent: 'response'},
							});
							handler({
								type: 'assistant.message',
								data: {content: 'Test response'},
							});
							handler({type: 'session.idle'});
						}, 10);
						return () => {}; // unsubscribe function
					},
					async send() {
						return Promise.resolve();
					},
					async abort() {
						return Promise.resolve();
					},
					async destroy() {
						return Promise.resolve();
					},
				};
			}

			async resumeSession(_sessionId: string) {
				return this.createSession();
			}

			async listSessions() {
				return this.sessions;
			}

			async getLastSessionId() {
				return 'test-session';
			}

			async ping() {
				return {timestamp: Date.now()};
			}

			async listModels() {
				return [
					{
						id: 'GPT-5 mini',
						name: 'GPT-5 mini',
						capabilities: {
							supports: {vision: false},
							limits: {max_context_window_tokens: 128000},
						},
					},
				];
			}

			getState() {
				return 'connected';
			}
		},
	};
});
