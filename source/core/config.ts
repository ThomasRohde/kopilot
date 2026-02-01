import type {CopilotClientOptions, SessionConfig, Tool} from '@github/copilot-sdk';
import type {LogLevel} from './logger.js';

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
export type FileConfig = {
	model?: string;
	logLevel?: LogLevel;
	banner?: boolean;
	maxAttachmentBytes?: number;
	maxAttachmentKb?: number; // Convenience alias (converted to bytes)
	idleTimeoutMs?: number;
	models?: string[];
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
