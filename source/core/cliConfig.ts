import meow from 'meow';
import {buildRuntimeConfig, DEFAULTS, type RuntimeConfig} from './config.js';
import type {LogLevel} from './logger.js';
import {defaultTools} from '../agent/tools.js';
import {loadAllConfigs, mergeFileConfigs} from './configLoader.js';

type CliResult = {
	config: RuntimeConfig;
};

const HELP_TEXT = `
Usage:
  kopilot [options]

Options:
  -m, --model <name>           Model name (default: ${DEFAULTS.sessionConfig.model})
  -s, --session <id>           Resume a specific session id
  --resume-last                Resume the last session id
  --no-banner                  Disable the startup banner
  --no-color                   Disable ANSI colors
  --log-level <level>          debug|info|warn|error (default: ${DEFAULTS.logLevel})
  --cli-path <path>            Path to Copilot CLI executable
  --cli-url <url>              Connect to an existing CLI server
  --port <number>              Port for spawned CLI server
  --stdio                       Use stdio transport (default: true)
  --cwd <path>                 Working directory for CLI process
  --timeout <ms>               Idle timeout for responses
  --max-attachment-kb <kb>     Attachment size cap per file
`;

function normalizeLogLevel(value?: string): LogLevel {
	switch (value) {
		case 'debug':
		case 'info':
		case 'warn':
		case 'error':
			return value;
		default:
			return DEFAULTS.logLevel;
	}
}

export async function parseCli(argv: string[]): Promise<CliResult> {
	const cli = meow(HELP_TEXT, {
		importMeta: import.meta,
		argv,
		flags: {
			model: {
				type: 'string',
				alias: 'm',
			},
			session: {
				type: 'string',
				alias: 's',
			},
			resumeLast: {
				type: 'boolean',
				default: false,
			},
			banner: {
				type: 'boolean',
				default: true,
			},
			color: {
				type: 'boolean',
				default: true,
			},
			logLevel: {
				type: 'string',
			},
			cliPath: {
				type: 'string',
			},
			cliUrl: {
				type: 'string',
			},
			port: {
				type: 'number',
			},
			stdio: {
				type: 'boolean',
				default: true,
			},
			cwd: {
				type: 'string',
			},
			timeout: {
				type: 'number',
			},
			maxAttachmentKb: {
				type: 'number',
			},
		},
	});

	const env = process.env;

	// Load file configs (user config, then project config overrides)
	const cwd = cli.flags.cwd ?? process.cwd();
	const {user, project} = await loadAllConfigs(cwd);
	const fileConfig = mergeFileConfigs(user, project);

	// Priority chain: CLI Flags > Env Vars > Project Config > User Config > DEFAULTS
	// fileConfig already has project > user merged, now layer CLI/env on top

	const logLevel = normalizeLogLevel(
		cli.flags.logLevel ??
			env['KOPILOT_LOG_LEVEL'] ??
			fileConfig.logLevel,
	);

	const model =
		cli.flags.model ??
		env['KOPILOT_MODEL'] ??
		(fileConfig.sessionConfig?.['model'] as string | undefined) ??
		DEFAULTS.sessionConfig.model;

	const sessionId = cli.flags.session ?? env['KOPILOT_SESSION'];
	const resumeLast =
		cli.flags.resumeLast || env['KOPILOT_RESUME_LAST'] === '1';

	// Resolve limits with file config fallback
	const fileIdleTimeoutMs = fileConfig.limits?.idleTimeoutMs;
	const fileMaxAttachmentBytes = fileConfig.limits?.maxAttachmentBytes;

	const idleTimeoutMs = Number(
		cli.flags.timeout ??
			env['KOPILOT_TIMEOUT_MS'] ??
			fileIdleTimeoutMs ??
			DEFAULTS.limits.idleTimeoutMs,
	);

	const cliOrEnvMaxKb =
		cli.flags.maxAttachmentKb ?? env['KOPILOT_MAX_ATTACHMENT_KB'];
	const maxAttachmentBytes =
		cliOrEnvMaxKb !== undefined
			? Number(cliOrEnvMaxKb) * 1024
			: fileMaxAttachmentBytes ?? DEFAULTS.limits.maxAttachmentBytes;

	// Resolve banner: CLI flag (--no-banner), env var, file config, default
	// meow sets banner=true by default, so we need to check if --no-banner was explicitly passed
	const envBannerDisabled =
		env['KOPILOT_BANNER'] === '0' || env['KOPILOT_BANNER'] === 'false';
	const banner =
		cli.flags.banner && !envBannerDisabled
			? (fileConfig.ui?.banner ?? DEFAULTS.ui.banner)
			: false;

	const config = buildRuntimeConfig({
		logLevel,
		tools: defaultTools,
		models: fileConfig.models,
		ui: {
			banner,
		},
		limits: {
			idleTimeoutMs: Number.isFinite(idleTimeoutMs)
				? idleTimeoutMs
				: DEFAULTS.limits.idleTimeoutMs,
			maxAttachmentBytes: Number.isFinite(maxAttachmentBytes)
				? maxAttachmentBytes
				: DEFAULTS.limits.maxAttachmentBytes,
		},
		clientOptions: {
			cliPath: cli.flags.cliPath ?? env['KOPILOT_CLI_PATH'],
			cliUrl: cli.flags.cliUrl ?? env['KOPILOT_CLI_URL'],
			port: cli.flags.port,
			useStdio: cli.flags.stdio,
			cwd: cli.flags.cwd,
			logLevel: logLevel === 'warn' ? 'warning' : logLevel,
		},
		sessionConfig: {
			model,
			streaming: true,
		},
		sessionStrategy: resumeLast
			? 'last'
			: sessionId
				? 'resume'
				: 'new',
		sessionId: sessionId ?? undefined,
	});

	if (!cli.flags.color || env['NO_COLOR']) {
		process.env['NO_COLOR'] = '1';
	}

	return {config};
}
