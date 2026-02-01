import type {CopilotClient, CopilotSession} from '@github/copilot-sdk';

export type CommandOutcome =
	| {type: 'message'; message: string; kind?: 'info' | 'error'}
	| {type: 'clear'}
	| {type: 'exit'}
	| {type: 'open-model-picker'}
	| {type: 'set-model'; model: string}
	| {type: 'new-session'}
	| {type: 'resume-session'; sessionId: string}
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
		usage: '/session [list|new|resume <id>]',
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
			return {type: 'message', message: `Client state: ${state}`};
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
