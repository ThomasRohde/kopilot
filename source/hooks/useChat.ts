/**
 * Hook for managing chat messages and command handling.
 * @module hooks/useChat
 */

import {useCallback, useRef, useState} from 'react';
import type {CopilotSession, SessionEvent} from '@github/copilot-sdk';
import type {Message, TokenUsage} from '../types/index.js';
import {createId} from '../utils/format.js';
import {streamResponse} from '../agent/copilotAgent.js';
import {resolveFileMentions} from '../core/mentions.js';
import {runCommand, type CommandContext} from '../core/commands.js';

/** Debounce interval for streaming updates (ms) */
const STREAM_DEBOUNCE_MS = 50;

type UseChatOptions = {
	session: CopilotSession | null;
	isReady: boolean;
	copilotError: Error | null;
	cwd: string;
	maxAttachmentBytes: number;
	idleTimeoutMs: number;
};

type UseChatResult = {
	messages: Message[];
	isStreaming: boolean;
	cancelRef: React.MutableRefObject<boolean>;
	appendSystemMessage: (content: string, kind?: 'info' | 'error') => void;
	clearMessages: () => void;
	handleCommand: (
		value: string,
		context: CommandContext,
		callbacks: {
			onClear: () => void;
			onExit: () => void;
			onOpenModelPicker: () => Promise<boolean>;
			onSwitchModel: (model: string) => Promise<unknown>;
			onNewSession: () => Promise<unknown>;
			onResumeSession: (sessionId: string) => Promise<unknown>;
			onSetReasoningEffort: (effort: string) => Promise<unknown>;
		},
	) => Promise<boolean>;
	handleSubmit: (
		value: string,
		callbacks: {
			handleCommand: (value: string) => Promise<boolean>;
			setInput: (value: string) => void;
		},
	) => Promise<void>;
};

/**
 * Helper to insert a system message before the assistant message in the list.
 */
function insertBeforeAssistant(
	prev: Message[],
	assistantId: string,
	msg: Message,
): Message[] {
	const assistantIdx = prev.findIndex(m => m.id === assistantId);
	if (assistantIdx === -1) {
		return [...prev, msg];
	}

	const newMessages = [...prev];
	newMessages.splice(assistantIdx, 0, msg);
	return newMessages;
}

/**
 * Hook for managing chat messages and streaming.
 */
export function useChat(options: UseChatOptions): UseChatResult {
	const {
		session,
		isReady,
		copilotError,
		cwd,
		maxAttachmentBytes,
		idleTimeoutMs,
	} = options;

	const [messages, setMessages] = useState<Message[]>([]);
	const [isStreaming, setIsStreaming] = useState(false);
	const cancelRef = useRef(false);

	const appendSystemMessage = useCallback(
		(content: string, kind: 'info' | 'error' = 'info') => {
			setMessages(prev => [
				...prev,
				{role: 'system', id: createId(), content, kind},
			]);
		},
		[],
	);

	const clearMessages = useCallback(() => {
		setMessages([]);
	}, []);

	const handleCommand = useCallback(
		async (
			value: string,
			context: CommandContext,
			callbacks: {
				onClear: () => void;
				onExit: () => void;
				onOpenModelPicker: () => Promise<boolean>;
				onSwitchModel: (model: string) => Promise<unknown>;
				onNewSession: () => Promise<unknown>;
				onResumeSession: (sessionId: string) => Promise<unknown>;
				onSetReasoningEffort: (effort: string) => Promise<unknown>;
			},
		): Promise<boolean> => {
			const outcome = await runCommand(value, context);

			if (!outcome) {
				return false;
			}

			switch (outcome.type) {
				case 'message':
					appendSystemMessage(outcome.message, outcome.kind ?? 'info');
					return true;
				case 'clear':
					callbacks.onClear();
					return true;
				case 'exit':
					callbacks.onExit();
					return true;
				case 'open-model-picker':
					await callbacks.onOpenModelPicker();
					return true;
				case 'set-model': {
					await callbacks.onSwitchModel(outcome.model);
					return true;
				}
				case 'new-session': {
					await callbacks.onNewSession();
					return true;
				}
				case 'resume-session': {
					await callbacks.onResumeSession(outcome.sessionId);
					return true;
				}
				case 'set-reasoning-effort': {
					await callbacks.onSetReasoningEffort(outcome.effort);
					return true;
				}
				case 'noop':
					return true;
				default:
					return false;
			}
		},
		[appendSystemMessage],
	);

	const handleSubmit = useCallback(
		async (
			value: string,
			callbacks: {
				handleCommand: (value: string) => Promise<boolean>;
				setInput: (value: string) => void;
			},
		): Promise<void> => {
			if (!value.trim() || isStreaming) {
				return;
			}

			if (!isReady || !session) {
				appendSystemMessage(
					copilotError
						? `Copilot error: ${copilotError.message}`
						: 'Copilot is not ready yet.',
					'error',
				);
				return;
			}

			const rawValue = value.trim();
			const escapedValue = rawValue.startsWith('//')
				? rawValue.slice(1)
				: rawValue;

			if (!rawValue.startsWith('//')) {
				const commandHandled = await callbacks.handleCommand(rawValue);
				if (commandHandled) {
					callbacks.setInput('');
					return;
				}
			}

			const mentionResult = await resolveFileMentions(escapedValue, {
				cwd,
				maxBytes: maxAttachmentBytes,
			});

			if (mentionResult.errors.length > 0) {
				appendSystemMessage(mentionResult.errors.join('\n'), 'error');
			}

			const sendAttachments = mentionResult.attachments.map(att => ({
				type: att.type,
				path: att.path,
				displayName: att.displayName,
			}));

			const userMessage: Message = {
				id: createId(),
				role: 'user',
				content: escapedValue,
				attachments: mentionResult.attachments,
			};

			const assistantId = createId();
			const assistantMessage: Message = {
				id: assistantId,
				role: 'assistant',
				content: '',
				isStreaming: true,
			};

			setMessages(prev => [...prev, userMessage, assistantMessage]);
			callbacks.setInput('');
			setIsStreaming(true);
			cancelRef.current = false;

			try {
				const handleEvent = (event: SessionEvent) => {
					if (event.type === 'tool.execution_start' && event.data.toolName) {
						const toolName = event.data.toolName;
						setMessages(prev =>
							insertBeforeAssistant(prev, assistantId, {
								role: 'system',
								id: createId(),
								content: `🔧 Calling tool: ${toolName}`,
								kind: 'info',
							}),
						);
					}

					if (event.type === 'session.compaction_start') {
						setMessages(prev =>
							insertBeforeAssistant(prev, assistantId, {
								role: 'system',
								id: createId(),
								content: 'Compacting context...',
								kind: 'info',
							}),
						);
					}

					if (event.type === 'session.compaction_complete') {
						setMessages(prev =>
							insertBeforeAssistant(prev, assistantId, {
								role: 'system',
								id: createId(),
								content: event.data.success
									? 'Context compacted -- older messages summarized.'
									: `Context compaction failed: ${event.data.error ?? 'unknown error'}`,
								kind: event.data.success ? 'info' : 'error',
							}),
						);
					}

					if (event.type === 'session.truncation') {
						setMessages(prev =>
							insertBeforeAssistant(prev, assistantId, {
								role: 'system',
								id: createId(),
								content: `Context truncated (${event.data.messagesRemovedDuringTruncation} messages removed).`,
								kind: 'info',
							}),
						);
					}

					if (event.type === 'subagent.started') {
						const displayName =
							event.data.agentDisplayName || event.data.agentName;
						setMessages(prev =>
							insertBeforeAssistant(prev, assistantId, {
								role: 'system',
								id: createId(),
								content: `🤖 Agent started: ${displayName}`,
								kind: 'info',
							}),
						);
					}

					if (event.type === 'subagent.completed') {
						setMessages(prev =>
							insertBeforeAssistant(prev, assistantId, {
								role: 'system',
								id: createId(),
								content: `🤖 Agent completed: ${event.data.agentName}`,
								kind: 'info',
							}),
						);
					}

					if (event.type === 'subagent.failed') {
						setMessages(prev =>
							insertBeforeAssistant(prev, assistantId, {
								role: 'system',
								id: createId(),
								content: `🤖 Agent failed: ${event.data.agentName} -- ${event.data.error}`,
								kind: 'error',
							}),
						);
					}
				};

				const handleUsage = (usage: TokenUsage) => {
					setMessages(prev =>
						prev.map(msg =>
							msg.id === assistantId ? {...msg, usage} : msg,
						),
					);
				};

				const handleReasoning = (chunk: string) => {
					setMessages(prev =>
						prev.map(msg =>
							msg.id === assistantId
								? {...msg, reasoning: (msg.reasoning ?? '') + chunk}
								: msg,
						),
					);
				};

				const handleTurnStart = () => {
					setMessages(prev =>
						prev.map(msg =>
							msg.id === assistantId
								? {...msg, turnPhase: 'thinking' as const}
								: msg,
						),
					);
				};

				const handleTurnEnd = () => {
					setMessages(prev =>
						prev.map(msg =>
							msg.id === assistantId
								? {...msg, turnPhase: undefined}
								: msg,
						),
					);
				};

				const handleIntent = (intent: string) => {
					setMessages(prev =>
						prev.map(msg =>
							msg.id === assistantId ? {...msg, intent} : msg,
						),
					);
				};

				// Debounced streaming: buffer chunks and flush every STREAM_DEBOUNCE_MS
				let chunkBuffer = '';
				let lastFlush = Date.now();

				const flushBuffer = () => {
					if (chunkBuffer) {
						const contentToAdd = chunkBuffer;
						chunkBuffer = '';
						setMessages(prev =>
							prev.map(msg =>
								msg.id === assistantId
									? {
											...msg,
											content: msg.content + contentToAdd,
											turnPhase: 'responding' as const,
										}
									: msg,
							),
						);
					}

					lastFlush = Date.now();
				};

				for await (const chunk of streamResponse(escapedValue, session, {
					attachments: sendAttachments,
					idleTimeoutMs,
					onEvent: handleEvent,
					onUsage: handleUsage,
					onReasoning: handleReasoning,
					onTurnStart: handleTurnStart,
					onTurnEnd: handleTurnEnd,
					onIntent: handleIntent,
				})) {
					chunkBuffer += chunk;

					// Flush if enough time has passed since last flush
					const now = Date.now();
					if (now - lastFlush >= STREAM_DEBOUNCE_MS) {
						flushBuffer();
					}
				}

				// Final flush for any remaining content
				flushBuffer();

				setMessages(prev =>
					prev.map(msg =>
						msg.id === assistantId
							? {...msg, isStreaming: false, turnPhase: undefined}
							: msg,
					),
				);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : String(error);
				setMessages(prev =>
					prev.map(msg =>
						msg.id === assistantId
							? {
									...msg,
									content: `Error: ${message}`,
									isStreaming: false,
									kind: 'error',
								}
							: msg,
					),
				);
			} finally {
				setIsStreaming(false);
				if (cancelRef.current) {
					cancelRef.current = false;
				}
			}
		},
		[
			appendSystemMessage,
			copilotError,
			cwd,
			idleTimeoutMs,
			isReady,
			isStreaming,
			maxAttachmentBytes,
			session,
		],
	);

	return {
		messages,
		isStreaming,
		cancelRef,
		appendSystemMessage,
		clearMessages,
		handleCommand,
		handleSubmit,
	};
}
