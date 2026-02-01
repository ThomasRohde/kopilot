export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelRank: Record<LogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
};

export type Logger = {
	level: LogLevel;
	debug: (message: string, meta?: Record<string, unknown>) => void;
	info: (message: string, meta?: Record<string, unknown>) => void;
	warn: (message: string, meta?: Record<string, unknown>) => void;
	error: (message: string, meta?: Record<string, unknown>) => void;
};

type Sink = (line: string) => void;

function formatLine(
	level: LogLevel,
	message: string,
	meta?: Record<string, unknown>,
): string {
	const prefix = `[${new Date().toISOString()}] ${level.toUpperCase()}: `;
	if (!meta || Object.keys(meta).length === 0) {
		return `${prefix}${message}`;
	}

	let serialized = '';
	try {
		serialized = ` ${JSON.stringify(meta)}`;
	} catch {
		serialized = ' {"meta":"[unserializable]"}';
	}

	return `${prefix}${message}${serialized}`;
}

export function createLogger(level: LogLevel, sink?: Sink): Logger {
	const write = sink ?? ((line: string) => process.stderr.write(`${line}\n`));
	const shouldLog = (candidate: LogLevel) =>
		levelRank[candidate] >= levelRank[level];

	return {
		level,
		debug: (message, meta) => {
			if (shouldLog('debug')) {
				write(formatLine('debug', message, meta));
			}
		},
		info: (message, meta) => {
			if (shouldLog('info')) {
				write(formatLine('info', message, meta));
			}
		},
		warn: (message, meta) => {
			if (shouldLog('warn')) {
				write(formatLine('warn', message, meta));
			}
		},
		error: (message, meta) => {
			if (shouldLog('error')) {
				write(formatLine('error', message, meta));
			}
		},
	};
}
