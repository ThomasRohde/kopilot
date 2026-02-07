import type {CopilotClient, CopilotSession} from '@github/copilot-sdk';

export type CommandOutcome =
	| {type: 'message'; message: string; kind?: 'info' | 'error'}
	| {type: 'clear'}
	| {type: 'exit'}
	| {type: 'open-model-picker'}
	| {type: 'set-model'; model: string}
	| {type: 'new-session'}
	| {type: 'resume-session'; sessionId: string}
	| {type: 'set-reasoning-effort'; effort: string}
	| {type: 'noop'};

export type CommandContext = {
	client: CopilotClient | null;
	session: CopilotSession | null;
	currentModel: string;
};

export type CommandSummary = {
	name: string;
	description: string;
	usage: string;
	aliases?: string[];
};

type Command = {
	name: string;
	description: string;
	usage: string;
	aliases?: string[];
	run: (args: string[], context: CommandContext) => Promise<CommandOutcome>;
};

type ParsedCommand = {
	name: string;
	args: string[];
};

function tokenizeArgs(input: string): string[] {
	const tokens: string[] = [];
	let current = '';
	let quote: '"' | "'" | null = null;

	for (const char of input.trim()) {
		if (quote) {
			if (char === quote) {
				quote = null;
				continue;
			}

			current += char;
			continue;
		}

		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}

		if (/\s/.test(char)) {
			if (current) {
				tokens.push(current);
				current = '';
			}

			continue;
		}

		current += char;
	}

	if (current) {
		tokens.push(current);
	}

	return tokens;
}

function parseCommand(input: string): ParsedCommand | null {
	const trimmed = input.trim();
	if (!trimmed.startsWith('/')) {
		return null;
	}

	const tokens = tokenizeArgs(trimmed.slice(1));
	if (tokens.length === 0) {
		return null;
	}

	const [name, ...args] = tokens;
	if (!name) {
		return null;
	}

	return {name: name.toLowerCase(), args};
}

function formatHelp(commands: Command[]): string {
	const lines = ['Commands:'];
	for (const command of commands) {
		const aliasText =
			command.aliases && command.aliases.length > 0
				? ` (aliases: ${command.aliases.join(', ')})`
				: '';
		lines.push(`  /${command.name} - ${command.description}${aliasText}`);
		lines.push(`    usage: ${command.usage}`);
	}

	return lines.join('\n');
}

const COMMANDS: Command[] = [
	{
		name: 'help',
		description: 'Show available commands',
		usage: '/help',
		aliases: ['?'],
		run: async () => ({type: 'message', message: formatHelp(COMMANDS)}),
	},
	{
		name: 'clear',
		description: 'Clear the chat history',
		usage: '/clear',
		aliases: ['cls'],
		run: async () => ({type: 'clear'}),
	},
	{
		name: 'exit',
		description: 'Exit the application',
		usage: '/exit',
		aliases: ['quit', 'q'],
		run: async () => ({type: 'exit'}),
	},
	{
		name: 'model',
		description: 'Show or change the model',
		usage: '/model [name]',
		run: async (args, context) => {
			if (args.length === 0) {
				return {type: 'open-model-picker'};
			}

			return {type: 'set-model', model: args[0] ?? context.currentModel};
		},
	},
	{
		name: 'session',
		description: 'Manage Copilot sessions',
		usage: '/session [list|new|resume <id>|delete <id>]',
		run: async (args, context) => {
			const action = args[0]?.toLowerCase();
			if (!action) {
				return {
					type: 'message',
					message: context.session
						? `Active session: ${context.session.sessionId}`
						: 'No active session.',
				};
			}

			if (action === 'new') {
				return {type: 'new-session'};
			}

			if (action === 'resume') {
				const id = args[1];
				if (!id) {
					return {
						type: 'message',
						kind: 'error',
						message: 'Usage: /session resume <session-id>',
					};
				}

				return {type: 'resume-session', sessionId: id};
			}

			if (action === 'delete') {
				const id = args[1];
				if (!id) {
					return {
						type: 'message',
						kind: 'error',
						message: 'Usage: /session delete <session-id>',
					};
				}

				if (!context.client) {
					return {
						type: 'message',
						kind: 'error',
						message: 'Copilot client is not ready.',
					};
				}

				try {
					await context.client.deleteSession(id);
					return {
						type: 'message',
						message: `Deleted session ${id}.`,
					};
				} catch (error) {
					return {
						type: 'message',
						kind: 'error',
						message: `Failed to delete session: ${
							error instanceof Error ? error.message : String(error)
						}`,
					};
				}
			}

			if (action === 'list') {
				if (!context.client) {
					return {
						type: 'message',
						kind: 'error',
						message: 'Copilot client is not ready.',
					};
				}

				try {
					const sessions = await context.client.listSessions();
					if (!sessions || sessions.length === 0) {
						return {type: 'message', message: 'No sessions found.'};
					}

					const lines = ['Sessions:'];
					for (const session of sessions) {
						lines.push(
							`  ${session.sessionId} - ${session.summary ?? 'No summary'}`,
						);
					}

					return {type: 'message', message: lines.join('\n')};
				} catch (error) {
					return {
						type: 'message',
						kind: 'error',
						message: `Failed to list sessions: ${
							error instanceof Error ? error.message : String(error)
						}`,
					};
				}
			}

			return {
				type: 'message',
				kind: 'error',
				message: `Unknown session command: ${action}`,
			};
		},
	},
	{
		name: 'reasoning',
		description: 'Set reasoning effort for capable models',
		usage: '/reasoning [low|medium|high|xhigh]',
		run: async (args) => {
			const validEfforts = ['low', 'medium', 'high', 'xhigh'];
			if (args.length === 0) {
				return {
					type: 'message',
					message: `Usage: /reasoning [${validEfforts.join('|')}]`,
				};
			}

			const effort = args[0]?.toLowerCase() ?? '';
			if (!validEfforts.includes(effort)) {
				return {
					type: 'message',
					kind: 'error',
					message: `Invalid reasoning effort: ${effort}. Valid values: ${validEfforts.join(', ')}`,
				};
			}

			return {type: 'set-reasoning-effort', effort};
		},
	},
	{
		name: 'ping',
		description: 'Ping the Copilot server',
		usage: '/ping',
		run: async (_args, context) => {
			if (!context.client) {
				return {
					type: 'message',
					kind: 'error',
					message: 'Copilot client is not ready.',
				};
			}

			try {
				const response = await context.client.ping('kopilot');
				return {
					type: 'message',
					message: `Server responded at ${new Date(
						response.timestamp,
					).toISOString()}`,
				};
			} catch (error) {
				return {
					type: 'message',
					kind: 'error',
					message: `Ping failed: ${
						error instanceof Error ? error.message : String(error)
					}`,
				};
			}
		},
	},
	{
		name: 'status',
		description: 'Show Copilot client status',
		usage: '/status',
		run: async (_args, context) => {
			if (!context.client) {
				return {
					type: 'message',
					kind: 'error',
					message: 'Copilot client is not ready.',
				};
			}

			const state = context.client.getState?.() ?? 'unknown';
			const lines = [`Client state: ${state}`];

			try {
				const versionInfo = await context.client.getStatus();
				lines.push(
					`Version: ${versionInfo.version} (protocol: ${versionInfo.protocolVersion})`,
				);
			} catch {
				// getStatus may not be available on older servers
			}

			try {
				const auth = await context.client.getAuthStatus();
				lines.push(
					`Auth: ${auth.isAuthenticated ? 'Authenticated' : 'Not authenticated'} (${auth.authType ?? 'unknown'})`,
				);
				if (auth.login) {
					lines.push(`Login: ${auth.login}`);
				}
			} catch {
				// getAuthStatus may not be available on older servers
			}

			if (context.session) {
				lines.push(`Session: ${context.session.sessionId}`);
			}

			lines.push(`Model: ${context.currentModel}`);

			return {type: 'message', message: lines.join('\n')};
		},
	},
	{
		name: 'hooks',
		description: 'Show available session hook types',
		usage: '/hooks',
		run: async () => {
			const lines = [
				'Session Hooks:',
				'  onPreToolUse - Called before a tool is executed',
				'  onPostToolUse - Called after a tool is executed',
				'  onUserPromptSubmitted - Called when the user submits a prompt',
				'  onSessionStart - Called when a session starts',
				'  onSessionEnd - Called when a session ends',
				'  onErrorOccurred - Called when an error occurs',
				'',
				'Configure hooks via the SDK SessionConfig.hooks field.',
			];
			return {type: 'message', message: lines.join('\n')};
		},
	},
	{
		name: 'provider',
		description: 'Show current provider configuration',
		usage: '/provider',
		run: async (_args, context) => {
			// Access provider from session config if available
			const sessionConfig = (context as Record<string, unknown>)['sessionConfig'] as Record<string, unknown> | undefined;
			const provider = sessionConfig?.['provider'] as Record<string, unknown> | undefined;

			if (!provider) {
				return {
					type: 'message',
					message: 'Using default GitHub Copilot provider.\nTo use a custom provider, set "provider" in your config file with a "baseUrl".',
				};
			}

			const lines = ['Custom Provider:'];
			if (provider['type']) {
				lines.push(`  Type: ${provider['type']}`);
			}

			if (provider['baseUrl']) {
				lines.push(`  Base URL: ${provider['baseUrl']}`);
			}

			if (provider['wireApi']) {
				lines.push(`  API Format: ${provider['wireApi']}`);
			}

			return {type: 'message', message: lines.join('\n')};
		},
	},
	{
		name: 'mcp',
		description: 'Show configured MCP servers',
		usage: '/mcp',
		run: async (_args, context) => {
			const sessionConfig = (context as Record<string, unknown>)['sessionConfig'] as Record<string, unknown> | undefined;
			const mcpServers = sessionConfig?.['mcpServers'] as Record<string, unknown> | undefined;

			if (!mcpServers || Object.keys(mcpServers).length === 0) {
				return {
					type: 'message',
					message: 'No MCP servers configured.\nAdd "mcpServers" to your config file to connect external tool servers.',
				};
			}

			const lines = ['MCP Servers:'];
			for (const [name, config] of Object.entries(mcpServers)) {
				const server = config as Record<string, unknown>;
				const serverType = server['type'] ?? 'local';
				lines.push(`  ${name} (${serverType})`);
			}

			return {type: 'message', message: lines.join('\n')};
		},
	},
	{
		name: 'agent',
		description: 'Show configured custom agents',
		usage: '/agent',
		aliases: ['agents'],
		run: async (_args, context) => {
			const sessionConfig = (context as Record<string, unknown>)['sessionConfig'] as Record<string, unknown> | undefined;
			const customAgents = sessionConfig?.['customAgents'] as Array<Record<string, unknown>> | undefined;

			if (!customAgents || customAgents.length === 0) {
				return {
					type: 'message',
					message: 'No custom agents configured.\nAdd "customAgents" to your config file to define specialized agents.',
				};
			}

			const lines = ['Custom Agents:'];
			for (const agent of customAgents) {
				const name = agent['displayName'] ?? agent['name'] ?? 'unknown';
				const desc = agent['description'] ? ` - ${agent['description']}` : '';
				lines.push(`  ${name}${desc}`);
			}

			return {type: 'message', message: lines.join('\n')};
		},
	},
];

export function listCommands(): CommandSummary[] {
	return COMMANDS.map(command => ({
		name: command.name,
		description: command.description,
		usage: command.usage,
		aliases: command.aliases ? [...command.aliases] : undefined,
	}));
}

export async function runCommand(
	input: string,
	context: CommandContext,
): Promise<CommandOutcome | null> {
	const parsed = parseCommand(input);
	if (!parsed) {
		return null;
	}

	const command = COMMANDS.find(
		item =>
			item.name === parsed.name ||
			(item.aliases && item.aliases.includes(parsed.name)),
	);

	if (!command) {
		return {
			type: 'message',
			kind: 'error',
			message: `Unknown command: /${parsed.name}. Try /help.`,
		};
	}

	return command.run(parsed.args, context);
}
