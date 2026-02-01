import type {CopilotSession, SessionEvent} from '@github/copilot-sdk';
import type {FileAttachment} from '../core/mentions.js';

type StreamResponseOptions = {
	attachments?: FileAttachment[];
	mode?: 'enqueue' | 'immediate';
	idleTimeoutMs?: number;
	onEvent?: (event: SessionEvent) => void;
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

		const eventType = event.type as string;
		const data = (event as {data?: Record<string, unknown>}).data ?? {};

		switch (eventType) {
			case 'assistant.message.delta':
			case 'assistant.message_delta': {
				sawDelta = true;
				queue.pushData((data['deltaContent'] as string | undefined) ?? '');
				resetTimer();
				break;
			}

			case 'assistant.message': {
				if (!sawDelta && typeof data['content'] === 'string') {
					queue.pushData(data['content'] as string);
				}
				resetTimer();
				break;
			}

			case 'tool.execution_start': {
				// Tool execution events are forwarded via onEvent callback
				// The SDK handles tool execution automatically
				resetTimer();
				break;
			}

			case 'tool.execution_complete': {
				// Tool execution completed, response will continue
				resetTimer();
				break;
			}

			case 'session.idle': {
				queue.close();
				break;
			}

			case 'session.error': {
				queue.fail(new Error(String(data['message'] ?? 'Unknown error')));
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
