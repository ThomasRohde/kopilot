import type {CopilotClientOptions, SessionConfig, Tool} from '@github/copilot-sdk';
import type {LogLevel} from './logger.js';

export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

export type RuntimeConfig = {
	clientOptions: CopilotClientOptions;
	sessionConfig: SessionConfig;
	models: string[];
	sessionStrategy: 'new' | 'resume' | 'last';
	sessionId?: string;
	tools: Tool[];
	ui: {
		banner: boolean;
	};
	limits: {
		maxAttachmentBytes: number;
		idleTimeoutMs: number;
	};
	logLevel: LogLevel;
};

/**
 * Subset of RuntimeConfig configurable via JSON files.
 * Excludes security-sensitive options (cliPath, cliUrl, port).
 */
/**
 * Provider config subset allowed in JSON files.
 * apiKey/bearerToken must come from environment variables, not files.
 */
export type FileProviderConfig = {
	type?: 'openai' | 'azure' | 'anthropic';
	wireApi?: 'completions' | 'responses';
	baseUrl: string;
};

/**
 * MCP server config for JSON files.
 */
export type FileMcpServerConfig =
	| {type?: 'local' | 'stdio'; command: string; args: string[]; env?: Record<string, string>; tools: string[]}
	| {type: 'http' | 'sse'; url: string; headers?: Record<string, string>; tools: string[]};

/**
 * Custom agent config for JSON files.
 */
export type FileCustomAgentConfig = {
	name: string;
	displayName?: string;
	description?: string;
	prompt: string;
	tools?: string[];
};

export type FileConfig = {
	model?: string;
	reasoningEffort?: ReasoningEffort;
	logLevel?: LogLevel;
	banner?: boolean;
	maxAttachmentBytes?: number;
	maxAttachmentKb?: number; // Convenience alias (converted to bytes)
	idleTimeoutMs?: number;
	models?: string[];
	infiniteSessions?: boolean;
	provider?: FileProviderConfig;
	mcpServers?: Record<string, FileMcpServerConfig>;
	customAgents?: FileCustomAgentConfig[];
};

export const DEFAULTS: RuntimeConfig = {
	clientOptions: {
		useStdio: true,
		autoStart: true,
		autoRestart: true,
		logLevel: 'info',
	},
	sessionConfig: {
		model: 'GPT-5 mini',
		streaming: true,
		infiniteSessions: {enabled: true},
		systemMessage: {
			mode: 'append',
			content: `You have access to the following tools:

- get_weather: Get current weather for a city. Use when users ask about weather conditions.
- get_current_time: Get current date/time. Supports timezone parameter (e.g., "America/New_York", "UTC").

When users ask about weather or time, use the appropriate tool to provide accurate information.`,
		},
	},
	models: ['GPT-5 mini', 'gpt-4', 'gpt-3.5-turbo'],
	sessionStrategy: 'new',
	tools: [],
	ui: {
		banner: true,
	},
	limits: {
		maxAttachmentBytes: 512 * 1024,
		idleTimeoutMs: 120_000,
	},
	logLevel: 'info',
};

export function buildRuntimeConfig(
	overrides?: Partial<RuntimeConfig>,
): RuntimeConfig {
	const resolvedLogLevel = overrides?.logLevel ?? DEFAULTS.logLevel;
	const clientLogLevel =
		overrides?.clientOptions?.logLevel ??
		(resolvedLogLevel === 'warn' ? 'warning' : resolvedLogLevel);

	return {
		...DEFAULTS,
		...overrides,
		models: overrides?.models ?? DEFAULTS.models,
		tools: overrides?.tools ?? DEFAULTS.tools,
		clientOptions: {
			...DEFAULTS.clientOptions,
			...overrides?.clientOptions,
			logLevel: clientLogLevel,
		},
		sessionConfig: {
			...DEFAULTS.sessionConfig,
			...overrides?.sessionConfig,
		},
		ui: {
			...DEFAULTS.ui,
			...overrides?.ui,
		},
		limits: {
			...DEFAULTS.limits,
			...overrides?.limits,
		},
	};
}
