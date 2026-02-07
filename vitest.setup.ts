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

			async createSession(_config?: unknown) {
				return {
					sessionId: 'test-session',
					on(handlerOrEventType: unknown, handler?: unknown) {
						// Support both typed and generic event handlers
						const callback =
							typeof handlerOrEventType === 'function'
								? (handlerOrEventType as (event: any) => void)
								: (handler as (event: any) => void);

						if (!callback) {
							return () => {};
						}

						const eventType =
							typeof handlerOrEventType === 'string'
								? handlerOrEventType
								: null;

						// Simulate streaming after short delay
						setTimeout(() => {
							const events = [
								{
									id: '1',
									timestamp: new Date().toISOString(),
									parentId: null,
									type: 'assistant.turn_start',
									data: {turnId: 'turn-1'},
								},
								{
									id: '2',
									timestamp: new Date().toISOString(),
									parentId: null,
									ephemeral: true,
									type: 'assistant.message_delta',
									data: {messageId: 'msg-1', deltaContent: 'Test '},
								},
								{
									id: '3',
									timestamp: new Date().toISOString(),
									parentId: null,
									ephemeral: true,
									type: 'assistant.message_delta',
									data: {messageId: 'msg-1', deltaContent: 'response'},
								},
								{
									id: '4',
									timestamp: new Date().toISOString(),
									parentId: null,
									type: 'assistant.message',
									data: {messageId: 'msg-1', content: 'Test response'},
								},
								{
									id: '5',
									timestamp: new Date().toISOString(),
									parentId: null,
									ephemeral: true,
									type: 'assistant.usage',
									data: {
										model: 'GPT-5 mini',
										inputTokens: 50,
										outputTokens: 10,
										cost: 0.0001,
										duration: 500,
									},
								},
								{
									id: '6',
									timestamp: new Date().toISOString(),
									parentId: null,
									type: 'assistant.turn_end',
									data: {turnId: 'turn-1'},
								},
								{
									id: '7',
									timestamp: new Date().toISOString(),
									parentId: null,
									ephemeral: true,
									type: 'session.idle',
									data: {},
								},
							];

							for (const event of events) {
								if (eventType === null || event.type === eventType) {
									callback(event);
								}
							}
						}, 10);
						return () => {}; // unsubscribe function
					},
					async send() {
						return Promise.resolve('msg-1');
					},
					async sendAndWait() {
						return {
							id: 'msg-1',
							timestamp: new Date().toISOString(),
							parentId: null,
							type: 'assistant.message',
							data: {messageId: 'msg-1', content: 'Test response'},
						};
					},
					async abort() {
						return Promise.resolve();
					},
					async destroy() {
						return Promise.resolve();
					},
					async getMessages() {
						return [];
					},
					registerTools() {},
					registerPermissionHandler() {},
					registerUserInputHandler() {},
					registerHooks() {},
					getToolHandler() {
						return undefined;
					},
				};
			}

			async resumeSession(_sessionId: string, _config?: unknown) {
				return this.createSession();
			}

			async listSessions() {
				return this.sessions;
			}

			async getLastSessionId() {
				return 'test-session';
			}

			async deleteSession(_sessionId: string) {
				return Promise.resolve();
			}

			async ping() {
				return {message: 'kopilot', timestamp: Date.now()};
			}

			async getStatus() {
				return {version: '0.1.22', protocolVersion: 2};
			}

			async getAuthStatus() {
				return {
					isAuthenticated: true,
					authType: 'gh-cli' as const,
					login: 'test-user',
					host: 'github.com',
				};
			}

			async listModels() {
				return [
					{
						id: 'GPT-5 mini',
						name: 'GPT-5 mini',
						capabilities: {
							supports: {vision: false, reasoningEffort: false},
							limits: {max_context_window_tokens: 128000},
						},
					},
					{
						id: 'o3-mini',
						name: 'o3-mini',
						capabilities: {
							supports: {vision: false, reasoningEffort: true},
							limits: {max_context_window_tokens: 200000},
						},
						supportedReasoningEfforts: ['low', 'medium', 'high'],
						defaultReasoningEffort: 'medium',
					},
				];
			}

			getState() {
				return 'connected';
			}

			async getForegroundSessionId() {
				return 'test-session';
			}

			async setForegroundSessionId(_sessionId: string) {
				return Promise.resolve();
			}

			async forceStop() {
				return Promise.resolve();
			}

			on(_handlerOrEventType: unknown, _handler?: unknown) {
				return () => {};
			}
		},
		defineTool(name: string, config: {description?: string; parameters?: unknown; handler: unknown}) {
			return {name, ...config};
		},
	};
});
