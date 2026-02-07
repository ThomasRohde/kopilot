import {readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type {FileConfig} from './config.js';
import type {LogLevel, Logger} from './logger.js';

const USER_CONFIG_DIR = '.kopilot';
const USER_CONFIG_FILE = 'config.json';
const PROJECT_CONFIG_FILE = '.kopilot.json';

/**
 * Returns the path to the user config file (~/.kopilot/config.json).
 */
export function getUserConfigPath(): string {
	return path.join(os.homedir(), USER_CONFIG_DIR, USER_CONFIG_FILE);
}

/**
 * Returns the path to the project config file (.kopilot.json in cwd).
 */
export function getProjectConfigPath(cwd?: string): string {
	return path.join(cwd ?? process.cwd(), PROJECT_CONFIG_FILE);
}

/**
 * Validates and normalizes a log level string.
 */
function isValidLogLevel(value: unknown): value is LogLevel {
	return (
		typeof value === 'string' &&
		['debug', 'info', 'warn', 'error'].includes(value)
	);
}

/**
 * Validates a single config field and returns the validated value or undefined.
 */
function validateField(
	key: string,
	value: unknown,
	logger?: Logger,
): unknown {
	switch (key) {
		case 'model':
			if (typeof value === 'string') {
				return value;
			}

			logger?.warn(`Config: invalid type for "model", expected string`, {
				value,
			});
			return undefined;

		case 'logLevel':
			if (isValidLogLevel(value)) {
				return value;
			}

			logger?.warn(
				`Config: invalid value for "logLevel", expected debug|info|warn|error`,
				{value},
			);
			return undefined;

		case 'banner':
			if (typeof value === 'boolean') {
				return value;
			}

			logger?.warn(`Config: invalid type for "banner", expected boolean`, {
				value,
			});
			return undefined;

		case 'maxAttachmentBytes':
		case 'maxAttachmentKb':
		case 'idleTimeoutMs':
			if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
				return value;
			}

			logger?.warn(
				`Config: invalid type for "${key}", expected positive number`,
				{value},
			);
			return undefined;

		case 'models':
			if (
				Array.isArray(value) &&
				value.every((item) => typeof item === 'string')
			) {
				return value;
			}

			logger?.warn(`Config: invalid type for "models", expected string[]`, {
				value,
			});
			return undefined;

		case 'reasoningEffort':
			if (
				typeof value === 'string' &&
				['low', 'medium', 'high', 'xhigh'].includes(value)
			) {
				return value;
			}

			logger?.warn(
				`Config: invalid value for "reasoningEffort", expected low|medium|high|xhigh`,
				{value},
			);
			return undefined;

		case 'infiniteSessions':
			if (typeof value === 'boolean') {
				return value;
			}

			logger?.warn(
				`Config: invalid type for "infiniteSessions", expected boolean`,
				{value},
			);
			return undefined;

		case 'provider':
			if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
				const provider = value as Record<string, unknown>;
				if (typeof provider['baseUrl'] !== 'string') {
					logger?.warn('Config: provider must have a "baseUrl" string');
					return undefined;
				}

				// Security: reject secrets in file config
				if (provider['apiKey'] !== undefined || provider['bearerToken'] !== undefined) {
					logger?.warn(
						'Config: apiKey/bearerToken must be set via environment variables, not config files',
					);
					return undefined;
				}

				return value;
			}

			logger?.warn('Config: invalid type for "provider", expected object with baseUrl');
			return undefined;

		case 'mcpServers':
			if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
				return value;
			}

			logger?.warn('Config: invalid type for "mcpServers", expected object');
			return undefined;

		case 'customAgents':
			if (Array.isArray(value)) {
				return value;
			}

			logger?.warn('Config: invalid type for "customAgents", expected array');
			return undefined;

		default:
			// Unknown fields are silently ignored (forward compatibility)
			return undefined;
	}
}

/**
 * Parses and validates a config object from raw JSON.
 */
function parseConfig(raw: unknown, logger?: Logger): FileConfig {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		logger?.warn('Config: expected object at root level');
		return {};
	}

	const result: FileConfig = {};
	const record = raw as Record<string, unknown>;

	for (const key of Object.keys(record)) {
		const validated = validateField(key, record[key], logger);
		if (validated !== undefined) {
			(result as Record<string, unknown>)[key] = validated;
		}
	}

	return result;
}

/**
 * Loads and parses a config file from disk.
 * Returns empty object if file doesn't exist or is invalid.
 */
export async function loadConfigFile(
	filePath: string,
	logger?: Logger,
): Promise<FileConfig> {
	try {
		const content = await readFile(filePath, 'utf8');
		const parsed: unknown = JSON.parse(content);
		return parseConfig(parsed, logger);
	} catch (error) {
		if (
			error instanceof Error &&
			'code' in error &&
			error.code === 'ENOENT'
		) {
			// File not found is expected and silent
			return {};
		}

		if (error instanceof SyntaxError) {
			logger?.warn(`Config: invalid JSON in ${filePath}`, {
				error: error.message,
			});
			return {};
		}

		// Other errors (permissions, etc.)
		logger?.warn(`Config: failed to read ${filePath}`, {
			error: error instanceof Error ? error.message : String(error),
		});
		return {};
	}
}

export type LoadedConfigs = {
	user: FileConfig;
	project: FileConfig;
};

/**
 * Loads both user and project config files in parallel.
 */
export async function loadAllConfigs(
	cwd?: string,
	logger?: Logger,
): Promise<LoadedConfigs> {
	const [user, project] = await Promise.all([
		loadConfigFile(getUserConfigPath(), logger),
		loadConfigFile(getProjectConfigPath(cwd), logger),
	]);

	return {user, project};
}

/**
 * Merges user and project configs into a partial RuntimeConfig.
 * Priority: project > user (project overrides user).
 * Converts maxAttachmentKb to maxAttachmentBytes if present.
 */
export function mergeFileConfigs(
	user: FileConfig,
	project: FileConfig,
): Partial<{
	logLevel: LogLevel;
	models: string[];
	sessionConfig: Record<string, unknown>;
	ui: {banner: boolean};
	limits: {maxAttachmentBytes?: number; idleTimeoutMs?: number};
}> {
	const merged = {...user, ...project};
	const result: ReturnType<typeof mergeFileConfigs> = {};

	if (merged.logLevel !== undefined) {
		result.logLevel = merged.logLevel;
	}

	if (merged.models !== undefined) {
		result.models = merged.models;
	}

	const sessionConfig: Record<string, unknown> = {};
	if (merged.model !== undefined) {
		sessionConfig['model'] = merged.model;
	}

	if (merged.reasoningEffort !== undefined) {
		sessionConfig['reasoningEffort'] = merged.reasoningEffort;
	}

	if (merged.infiniteSessions !== undefined) {
		sessionConfig['infiniteSessions'] = {enabled: merged.infiniteSessions};
	}

	if (merged.provider !== undefined) {
		sessionConfig['provider'] = merged.provider;
	}

	if (merged.mcpServers !== undefined) {
		sessionConfig['mcpServers'] = merged.mcpServers;
	}

	if (merged.customAgents !== undefined) {
		sessionConfig['customAgents'] = merged.customAgents;
	}

	if (Object.keys(sessionConfig).length > 0) {
		result.sessionConfig = sessionConfig;
	}

	if (merged.banner !== undefined) {
		result.ui = {banner: merged.banner};
	}

	// Handle limits
	const limits: {maxAttachmentBytes?: number; idleTimeoutMs?: number} = {};

	if (merged.maxAttachmentBytes !== undefined) {
		limits.maxAttachmentBytes = merged.maxAttachmentBytes;
	} else if (merged.maxAttachmentKb !== undefined) {
		// Convert KB to bytes
		limits.maxAttachmentBytes = merged.maxAttachmentKb * 1024;
	}

	if (merged.idleTimeoutMs !== undefined) {
		limits.idleTimeoutMs = merged.idleTimeoutMs;
	}

	if (Object.keys(limits).length > 0) {
		result.limits = limits;
	}

	return result;
}
