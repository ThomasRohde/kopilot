import {vi} from 'vitest';
import path from 'node:path';
import os from 'node:os';
import {
	getUserConfigPath,
	getProjectConfigPath,
	loadConfigFile,
	loadAllConfigs,
	mergeFileConfigs,
} from '../source/core/configLoader.js';

// Mock fs/promises for file loading tests
vi.mock('node:fs/promises', () => ({
	readFile: vi.fn(),
}));

import {readFile} from 'node:fs/promises';
const mockReadFile = vi.mocked(readFile);

describe('configLoader', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('getUserConfigPath', () => {
		it('returns path in home directory', () => {
			const result = getUserConfigPath();
			expect(result).toBe(
				path.join(os.homedir(), '.kopilot', 'config.json'),
			);
		});
	});

	describe('getProjectConfigPath', () => {
		it('uses provided cwd', () => {
			const result = getProjectConfigPath('/my/project');
			expect(result).toBe(path.join('/my/project', '.kopilot.json'));
		});

		it('uses process.cwd when cwd not provided', () => {
			const result = getProjectConfigPath();
			expect(result).toBe(path.join(process.cwd(), '.kopilot.json'));
		});
	});

	describe('loadConfigFile', () => {
		it('returns empty object when file does not exist', async () => {
			const error = new Error('File not found') as NodeJS.ErrnoException;
			error.code = 'ENOENT';
			mockReadFile.mockRejectedValue(error);

			const result = await loadConfigFile('/nonexistent/config.json');
			expect(result).toEqual({});
		});

		it('parses valid JSON config', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify({
					model: 'gpt-4',
					logLevel: 'debug',
					banner: false,
				}),
			);

			const result = await loadConfigFile('/valid/config.json');
			expect(result).toEqual({
				model: 'gpt-4',
				logLevel: 'debug',
				banner: false,
			});
		});

		it('warns on invalid JSON and returns empty object', async () => {
			mockReadFile.mockResolvedValue('{ invalid json }');
			const mockLogger = {
				level: 'warn' as const,
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};

			const result = await loadConfigFile('/invalid/config.json', mockLogger);
			expect(result).toEqual({});
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining('invalid JSON'),
				expect.any(Object),
			);
		});

		it('validates field types and skips invalid ones', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify({
					model: 123, // invalid: should be string
					logLevel: 'debug', // valid
					banner: 'yes', // invalid: should be boolean
					idleTimeoutMs: 5000, // valid
				}),
			);
			const mockLogger = {
				level: 'warn' as const,
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};

			const result = await loadConfigFile('/mixed/config.json', mockLogger);
			expect(result).toEqual({
				logLevel: 'debug',
				idleTimeoutMs: 5000,
			});
			expect(mockLogger.warn).toHaveBeenCalledTimes(2);
		});

		it('validates logLevel values', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify({
					logLevel: 'verbose', // invalid value
				}),
			);
			const mockLogger = {
				level: 'warn' as const,
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};

			const result = await loadConfigFile('/invalid-level/config.json', mockLogger);
			expect(result).toEqual({});
			expect(mockLogger.warn).toHaveBeenCalled();
		});

		it('parses models array correctly', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify({
					models: ['gpt-4', 'gpt-3.5-turbo'],
				}),
			);

			const result = await loadConfigFile('/models/config.json');
			expect(result).toEqual({
				models: ['gpt-4', 'gpt-3.5-turbo'],
			});
		});

		it('rejects invalid models array', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify({
					models: [1, 2, 3], // invalid: should be strings
				}),
			);
			const mockLogger = {
				level: 'warn' as const,
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};

			const result = await loadConfigFile('/invalid-models/config.json', mockLogger);
			expect(result).toEqual({});
			expect(mockLogger.warn).toHaveBeenCalled();
		});

		it('ignores unknown fields silently', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify({
					model: 'gpt-4',
					futureField: 'value',
					anotherUnknown: 123,
				}),
			);
			const mockLogger = {
				level: 'warn' as const,
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};

			const result = await loadConfigFile('/unknown-fields/config.json', mockLogger);
			expect(result).toEqual({model: 'gpt-4'});
			expect(mockLogger.warn).not.toHaveBeenCalled();
		});

		it('handles permission errors', async () => {
			const error = new Error('Permission denied') as NodeJS.ErrnoException;
			error.code = 'EACCES';
			mockReadFile.mockRejectedValue(error);
			const mockLogger = {
				level: 'warn' as const,
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};

			const result = await loadConfigFile('/protected/config.json', mockLogger);
			expect(result).toEqual({});
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining('failed to read'),
				expect.any(Object),
			);
		});
	});

	describe('loadAllConfigs', () => {
		it('loads both user and project configs', async () => {
			mockReadFile.mockImplementation((filePath: any) => {
				if (filePath.includes('.kopilot.json')) {
					return Promise.resolve(JSON.stringify({model: 'project-model'}));
				}

				if (filePath.includes('config.json')) {
					return Promise.resolve(JSON.stringify({model: 'user-model'}));
				}

				const error = new Error('File not found') as NodeJS.ErrnoException;
				error.code = 'ENOENT';
				return Promise.reject(error);
			});

			const result = await loadAllConfigs('/my/project');
			expect(result.user).toEqual({model: 'user-model'});
			expect(result.project).toEqual({model: 'project-model'});
		});
	});

	describe('mergeFileConfigs', () => {
		it('returns empty object when both configs are empty', () => {
			const result = mergeFileConfigs({}, {});
			expect(result).toEqual({});
		});

		it('applies project config over user config', () => {
			const user = {model: 'user-model', logLevel: 'info' as const};
			const project = {model: 'project-model'};

			const result = mergeFileConfigs(user, project);
			expect(result.sessionConfig?.model).toBe('project-model');
			expect(result.logLevel).toBe('info');
		});

		it('converts maxAttachmentKb to bytes', () => {
			const user = {maxAttachmentKb: 256};
			const result = mergeFileConfigs(user, {});
			expect(result.limits?.maxAttachmentBytes).toBe(256 * 1024);
		});

		it('prefers maxAttachmentBytes over maxAttachmentKb', () => {
			const user = {
				maxAttachmentBytes: 100000,
				maxAttachmentKb: 256, // should be ignored
			};
			const result = mergeFileConfigs(user, {});
			expect(result.limits?.maxAttachmentBytes).toBe(100000);
		});

		it('maps all fields correctly', () => {
			const config = {
				model: 'gpt-4',
				logLevel: 'debug' as const,
				banner: false,
				idleTimeoutMs: 60000,
				models: ['gpt-4', 'gpt-3.5-turbo'],
			};

			const result = mergeFileConfigs(config, {});
			expect(result).toEqual({
				logLevel: 'debug',
				models: ['gpt-4', 'gpt-3.5-turbo'],
				sessionConfig: {model: 'gpt-4'},
				ui: {banner: false},
				limits: {idleTimeoutMs: 60000},
			});
		});

		it('passes reasoningEffort to sessionConfig', () => {
			const result = mergeFileConfigs({reasoningEffort: 'high'}, {});
			expect(result.sessionConfig).toEqual({reasoningEffort: 'high'});
		});

		it('passes infiniteSessions to sessionConfig', () => {
			const result = mergeFileConfigs({infiniteSessions: true}, {});
			expect(result.sessionConfig).toEqual({infiniteSessions: {enabled: true}});
		});

		it('passes provider to sessionConfig', () => {
			const provider = {baseUrl: 'http://localhost:8080'};
			const result = mergeFileConfigs({provider}, {});
			expect(result.sessionConfig).toEqual({provider});
		});

		it('passes mcpServers to sessionConfig', () => {
			const mcpServers = {myServer: {type: 'http', url: 'http://localhost:3000', tools: ['search']}};
			const result = mergeFileConfigs({mcpServers: mcpServers as any}, {});
			expect(result.sessionConfig).toEqual({mcpServers});
		});

		it('passes customAgents to sessionConfig', () => {
			const customAgents = [{name: 'test-agent', prompt: 'Be helpful'}];
			const result = mergeFileConfigs({customAgents: customAgents as any}, {});
			expect(result.sessionConfig).toEqual({customAgents});
		});
	});

	describe('loadConfigFile - Phase 2/3 fields', () => {
		it('validates reasoningEffort values', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify({reasoningEffort: 'high'}),
			);

			const result = await loadConfigFile('/re/config.json');
			expect(result).toEqual({reasoningEffort: 'high'});
		});

		it('rejects invalid reasoningEffort', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify({reasoningEffort: 'turbo'}),
			);
			const mockLogger = {
				level: 'warn' as const,
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};

			const result = await loadConfigFile('/re/config.json', mockLogger);
			expect(result).toEqual({});
			expect(mockLogger.warn).toHaveBeenCalled();
		});

		it('validates infiniteSessions as boolean', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify({infiniteSessions: true}),
			);

			const result = await loadConfigFile('/is/config.json');
			expect(result).toEqual({infiniteSessions: true});
		});

		it('validates provider with baseUrl', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify({provider: {baseUrl: 'http://localhost:8080', type: 'openai'}}),
			);

			const result = await loadConfigFile('/prov/config.json');
			expect(result.provider).toBeDefined();
		});

		it('rejects provider with apiKey in file config', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify({provider: {baseUrl: 'http://localhost:8080', apiKey: 'secret'}}),
			);
			const mockLogger = {
				level: 'warn' as const,
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};

			const result = await loadConfigFile('/prov/config.json', mockLogger);
			expect(result.provider).toBeUndefined();
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining('environment variables'),
			);
		});

		it('validates mcpServers as object', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify({mcpServers: {test: {type: 'http', url: 'http://localhost:3000', tools: []}}}),
			);

			const result = await loadConfigFile('/mcp/config.json');
			expect(result.mcpServers).toBeDefined();
		});

		it('validates customAgents as array', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify({customAgents: [{name: 'agent1', prompt: 'Help'}]}),
			);

			const result = await loadConfigFile('/agents/config.json');
			expect(result.customAgents).toBeDefined();
		});

		it('rejects customAgents as non-array', async () => {
			mockReadFile.mockResolvedValue(
				JSON.stringify({customAgents: 'not-an-array'}),
			);
			const mockLogger = {
				level: 'warn' as const,
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};

			const result = await loadConfigFile('/agents/config.json', mockLogger);
			expect(result.customAgents).toBeUndefined();
			expect(mockLogger.warn).toHaveBeenCalled();
		});
	});
});
