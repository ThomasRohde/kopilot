/**
 * Hook for managing chat messages and command handling.
 * @module hooks/useChat
 */

import {useCallback, useRef, useState} from 'react';
import type {CopilotSession, SessionEvent} from '@github/copilot-sdk';
import type {Message} from '../types/index.js';
import {createId} from '../utils/format.js';
import {streamResponse} from '../agent/copilotAgent.js';
import {resolveFileMentions} from '../core/mentions.js';
import {runCommand, type CommandContext} from '../core/commands.js';

/** Debounce interval for streaming updates (ms) */
const STREAM_DEBOUNCE_MS = 50;

type ToolEventData = {
	toolName?: string;
	toolCallId?: string;
};

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
				const handleToolEvent = (event: SessionEvent) => {
					const eventType = event.type as string;
					const data = (event as {data?: ToolEventData}).data;

					if (eventType === 'tool.execution_start' && data?.toolName) {
						// Insert tool notification before the assistant message
						setMessages(prev => {
							const assistantIdx = prev.findIndex(m => m.id === assistantId);
							if (assistantIdx === -1) {
								return [...prev, {
									role: 'system',
									id: createId(),
									content: `🔧 Calling tool: ${data.toolName}`,
									kind: 'info',
								}];
							}

							const newMessages = [...prev];
							newMessages.splice(assistantIdx, 0, {
								role: 'system',
								id: createId(),
								content: `🔧 Calling tool: ${data.toolName}`,
								kind: 'info',
							});
							return newMessages;
						});
					}
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
									? {...msg, content: msg.content + contentToAdd}
									: msg,
							),
						);
					}
					lastFlush = Date.now();
				};

				for await (const chunk of streamResponse(escapedValue, session, {
					attachments: sendAttachments,
					idleTimeoutMs,
					onEvent: handleToolEvent,
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
						msg.id === assistantId ? {...msg, isStreaming: false} : msg,
					),
				);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
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
