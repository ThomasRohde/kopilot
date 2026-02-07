import type {CopilotSession, SessionEvent} from '@github/copilot-sdk';
import type {FileAttachment} from '../core/mentions.js';
import type {TokenUsage} from '../types/index.js';

export type StreamResponseOptions = {
	attachments?: FileAttachment[];
	mode?: 'enqueue' | 'immediate';
	idleTimeoutMs?: number;
	onEvent?: (event: SessionEvent) => void;
	onUsage?: (usage: TokenUsage) => void;
	onReasoning?: (chunk: string) => void;
	onTurnStart?: () => void;
	onTurnEnd?: () => void;
	onIntent?: (intent: string) => void;
};

type QueueItem =
	| {type: 'data'; value: string}
	| {type: 'done'}
	| {type: 'error'; error: Error};

function createAsyncQueue() {
	const items: QueueItem[] = [];
	const waiters: Array<(item: QueueItem) => void> = [];
	let closed = false;

	const push = (item: QueueItem) => {
		if (closed) {
			return;
		}

		if (item.type === 'done' || item.type === 'error') {
			closed = true;
		}

		if (waiters.length > 0) {
			const waiter = waiters.shift();
			if (waiter) {
				waiter(item);
			}
			return;
		}

		items.push(item);
	};

	const next = async (): Promise<QueueItem> => {
		if (items.length > 0) {
			return items.shift()!;
		}

		return new Promise(resolve => {
			waiters.push(resolve);
		});
	};

	return {
		pushData: (value: string) => push({type: 'data', value}),
		close: () => push({type: 'done'}),
		fail: (error: Error) => push({type: 'error', error}),
		async *iterate(): AsyncGenerator<string> {
			while (true) {
				const item = await next();
				if (item.type === 'data') {
					yield item.value;
					continue;
				}

				if (item.type === 'error') {
					throw item.error;
				}

				break;
			}
		},
	};
}

/**
 * Adapter to convert GitHub Copilot SDK event-based streaming to async generator interface.
 * This maintains compatibility with the existing app architecture while using the SDK.
 *
 * @param userMessage - The user's message to send to Copilot
 * @param session - The persistent Copilot session (maintains conversation history)
 * @param options - Optional send configuration
 * @returns AsyncGenerator that yields response chunks as they arrive
 */
export async function* streamResponse(
	userMessage: string,
	session: CopilotSession,
	options: StreamResponseOptions = {},
): AsyncGenerator<string> {
	const queue = createAsyncQueue();
	let idleTimer: NodeJS.Timeout | null = null;
	let sawDelta = false;

	const resetTimer = () => {
		if (options.idleTimeoutMs) {
			if (idleTimer) {
				clearTimeout(idleTimer);
			}

			idleTimer = setTimeout(() => {
				queue.fail(
					new Error(`Response timed out after ${options.idleTimeoutMs}ms.`),
				);
			}, options.idleTimeoutMs);
		}
	};

	resetTimer();

	const unsubscribe = session.on(event => {
		options.onEvent?.(event);

		switch (event.type) {
			case 'assistant.message_delta': {
				sawDelta = true;
				queue.pushData(event.data.deltaContent ?? '');
				resetTimer();
				break;
			}

			case 'assistant.message': {
				if (!sawDelta && typeof event.data.content === 'string') {
					queue.pushData(event.data.content);
				}

				resetTimer();
				break;
			}

			case 'assistant.usage': {
				options.onUsage?.({
					model: event.data.model,
					inputTokens: event.data.inputTokens,
					outputTokens: event.data.outputTokens,
					cacheReadTokens: event.data.cacheReadTokens,
					cacheWriteTokens: event.data.cacheWriteTokens,
					cost: event.data.cost,
					duration: event.data.duration,
				});
				resetTimer();
				break;
			}

			case 'assistant.reasoning_delta': {
				options.onReasoning?.(event.data.deltaContent);
				resetTimer();
				break;
			}

			case 'assistant.reasoning': {
				// Final reasoning content -- only forward if no deltas were sent
				resetTimer();
				break;
			}

			case 'assistant.turn_start': {
				options.onTurnStart?.();
				resetTimer();
				break;
			}

			case 'assistant.turn_end': {
				options.onTurnEnd?.();
				resetTimer();
				break;
			}

			case 'assistant.intent': {
				options.onIntent?.(event.data.intent);
				resetTimer();
				break;
			}

			case 'tool.execution_start':
			case 'tool.execution_complete':
			case 'tool.execution_progress': {
				// Tool events are forwarded via onEvent callback
				resetTimer();
				break;
			}

			case 'session.compaction_start':
			case 'session.compaction_complete':
			case 'session.truncation': {
				// Context management events are forwarded via onEvent
				resetTimer();
				break;
			}

			case 'subagent.started':
			case 'subagent.completed':
			case 'subagent.failed':
			case 'subagent.selected': {
				// Agent events are forwarded via onEvent
				resetTimer();
				break;
			}

			case 'hook.start':
			case 'hook.end': {
				// Hook events are forwarded via onEvent
				resetTimer();
				break;
			}

			case 'session.idle': {
				queue.close();
				break;
			}

			case 'session.error': {
				queue.fail(new Error(event.data.message ?? 'Unknown error'));
				break;
			}

			default: {
				// Unknown events are silently forwarded via onEvent
				resetTimer();
				break;
			}
		}
	});

	try {
		const payload: {
			prompt: string;
			attachments?: FileAttachment[];
			mode?: 'enqueue' | 'immediate';
		} = {
			prompt: userMessage,
		};

		if (options.attachments && options.attachments.length > 0) {
			payload.attachments = options.attachments;
		}

		if (options.mode) {
			payload.mode = options.mode;
		}

		await session.send(payload);

		for await (const chunk of queue.iterate()) {
			yield chunk;
		}
	} finally {
		if (idleTimer) {
			clearTimeout(idleTimer);
		}

		unsubscribe();
	}
}
