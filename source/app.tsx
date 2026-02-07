/**
 * Main Kopilot TUI application component.
 * @module app
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import TextInput from 'ink-text-input';

// Context and agent
import { useCopilot } from './agent/copilotContext.js';

// UI Components
import { Banner } from './ui/Banner.js';
import { MessageList } from './ui/MessageList.js';
import { StatusBar } from './ui/StatusBar.js';
import { Picker } from './ui/Picker.js';
import { ModelPicker } from './ui/ModelPicker.js';
import { PermissionPrompt } from './ui/PermissionPrompt.js';
import { UserInputPrompt } from './ui/UserInputPrompt.js';

// Custom hooks
import { useFileIndex } from './hooks/useFileIndex.js';
import { usePicker } from './hooks/usePicker.js';
import { useModelPicker } from './hooks/useModelPicker.js';
import { useChat } from './hooks/useChat.js';
import { useInputHistory } from './hooks/useInputHistory.js';

// Core utilities
import { listCommands } from './core/commands.js';
import { colors } from './constants/index.js';

const COMMAND_LIST = listCommands();

export default function App() {
	const {
		client,
		session,
		status,
		error: copilotError,
		config,
		pendingPermission,
		pendingUserInput,
		actions,
	} = useCopilot();
	const { exit } = useApp();
	const { write } = useStdout();

	// Clear screen function using ANSI escape codes
	const clearScreen = useCallback(() => {
		// ESC[2J clears entire screen, ESC[H moves cursor to home position
		write('\x1B[2J\x1B[H');
	}, [write]);

	const [input, setInput] = useState('');
	const [inputCursorKey, setInputCursorKey] = useState(0);
	const [currentModel, setCurrentModel] = useState(
		config.sessionConfig.model ?? 'GPT-5 mini',
	);

	const runtimeCwd = config.clientOptions.cwd ?? process.cwd();
	const isInteractive = process.stdin.isTTY === true;
	const isReady = status === 'ready' && !copilotError;
	const hasPrompt = pendingPermission !== null || pendingUserInput !== null;

	// File index hook
	const { fileIndex, isIndexing, fileIndexError, ensureFileIndex } = useFileIndex({
		cwd: runtimeCwd,
	});

	// Chat hook
	const {
		messages,
		isStreaming,
		cancelRef,
		appendSystemMessage,
		clearMessages,
		handleCommand: chatHandleCommand,
		handleSubmit: chatHandleSubmit,
	} = useChat({
		session,
		isReady,
		copilotError,
		cwd: runtimeCwd,
		maxAttachmentBytes: config.limits.maxAttachmentBytes,
		idleTimeoutMs: config.limits.idleTimeoutMs,
	});

	// Input history hook for arrow up/down navigation
	const {
		addToHistory,
		navigateUp,
		navigateDown,
		resetNavigation,
	} = useInputHistory();

	// Model picker hook
	const {
		isModelPickerOpen,
		modelPickerIndex,
		modelOptions,
		modelsStatus,
		modelsError,
		openModelPicker,
		closeModelPicker,
		moveModelSelection,
		applyModelSelection,
	} = useModelPicker({
		client,
		isReady,
		configModels: config.models,
		currentModel,
		appendSystemMessage,
		clearPicker: () => pickerHook.clearPicker(),
		clearScreen,
	});

	// Picker hook
	const pickerHook = usePicker({
		commandList: COMMAND_LIST,
		fileIndex,
		isIndexing,
		fileIndexError,
		ensureFileIndex,
		isReady,
		isStreaming,
		isModelPickerOpen,
		clearScreen,
	});

	const {
		pickerContext,
		pickerItems,
		pickerIndex,
		isPickerOpen,
		hasSelectablePickerItems,
		clearPicker,
		movePickerSelection,
		applyPickerSelection,
		updatePickerFromInput,
	} = pickerHook;

	// Switch model and create new session
	const switchModel = useCallback(
		async (model: string) => {
			setCurrentModel(model);
			const newSession = await actions.createSession({ model });
			appendSystemMessage(
				newSession
					? `Switched model to ${model}.`
					: `Failed to switch model to ${model}.`,
				newSession ? 'info' : 'error',
			);
			return newSession;
		},
		[actions, appendSystemMessage],
	);

	// Exit handling
	const exitConfirmRef = React.useRef(false);
	const forceExitTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

	const forceExit = useCallback(() => {
		if (forceExitTimeoutRef.current) {
			return;
		}

		exit();
		forceExitTimeoutRef.current = setTimeout(() => {
			process.exit(0);
		}, 50);
	}, [exit]);

	const requestExit = useCallback(() => {
		if (exitConfirmRef.current) {
			forceExit();
			return;
		}

		exitConfirmRef.current = true;
		appendSystemMessage('To exit, press Ctrl-C again.');
	}, [appendSystemMessage, forceExit]);

	// Command handler with all callbacks
	const handleCommand = useCallback(
		async (value: string) => {
			return chatHandleCommand(value, { client, session, currentModel }, {
				onClear: clearMessages,
				onExit: exit,
				onOpenModelPicker: openModelPicker,
				onSwitchModel: switchModel,
				onNewSession: async () => {
					const newSession = await actions.createSession({ model: currentModel });
					appendSystemMessage(
						newSession
							? `Started new session ${newSession.sessionId}.`
							: 'Failed to start new session.',
						newSession ? 'info' : 'error',
					);
					return newSession;
				},
				onResumeSession: async (sessionId: string) => {
					const resumed = await actions.resumeSession(sessionId, {
						model: currentModel,
					});
					appendSystemMessage(
						resumed
							? `Resumed session ${sessionId}.`
							: `Failed to resume session ${sessionId}.`,
						resumed ? 'info' : 'error',
					);
					return resumed;
				},
				onSetReasoningEffort: async (effort: string) => {
					const newSession = await actions.createSession({
						model: currentModel,
						reasoningEffort: effort as 'low' | 'medium' | 'high' | 'xhigh',
					});
					appendSystemMessage(
						newSession
							? `Reasoning effort set to ${effort}.`
							: `Failed to set reasoning effort to ${effort}.`,
						newSession ? 'info' : 'error',
					);
					return newSession;
				},
			});
		},
		[
			actions,
			appendSystemMessage,
			chatHandleCommand,
			clearMessages,
			client,
			currentModel,
			exit,
			openModelPicker,
			session,
			switchModel,
		],
	);

	// Submit handler
	const handleSubmit = useCallback(
		async (value: string) => {
			if (isPickerOpen) {
				if (hasSelectablePickerItems) {
					const handled = await applyPickerSelection(
						input,
						handleCommand,
						setInput,
						setInputCursorKey,
					);
					if (handled) {
						return;
					}
				}

				clearPicker(value);
			}

			// Add to history before submitting
			if (value.trim()) {
				addToHistory(value);
				resetNavigation();
			}

			await chatHandleSubmit(value, {
				handleCommand,
				setInput,
			});
		},
		[
			addToHistory,
			applyPickerSelection,
			chatHandleSubmit,
			clearPicker,
			handleCommand,
			hasSelectablePickerItems,
			input,
			isPickerOpen,
			resetNavigation,
		],
	);

	// Update picker from input changes
	useEffect(() => {
		updatePickerFromInput(input);
	}, [input, updatePickerFromInput]);

	// Keyboard input handling
	useInput(
		(_input, key) => {
			// Always allow Ctrl-C for exit
			if (key.ctrl && _input === 'c') {
				requestExit();
				return;
			}

			// Skip other key handling when a prompt is active
			if (hasPrompt) {
				return;
			}

			if (key.ctrl && _input === 'd' && !isStreaming) {
				exit();
				return;
			}

			if (key.escape) {
				if (isModelPickerOpen) {
					closeModelPicker();
					return;
				}

				if (isPickerOpen) {
					clearPicker(input);
					return;
				}

				if (isStreaming && session) {
					cancelRef.current = true;
					void session.abort();
					appendSystemMessage('Canceled current response.', 'info');
					return;
				}
			}

			if (isModelPickerOpen) {
				if (key.upArrow) {
					moveModelSelection(-1);
					return;
				}

				if (key.downArrow) {
					moveModelSelection(1);
					return;
				}

				if (key.return) {
					applyModelSelection(switchModel);
					return;
				}
			}

			if (isPickerOpen) {
				if (key.upArrow) {
					movePickerSelection(-1);
					return;
				}

				if (key.downArrow) {
					movePickerSelection(1);
					return;
				}
			}

			// History navigation when not in picker/model picker and not streaming
			if (!isPickerOpen && !isModelPickerOpen && !isStreaming) {
				if (key.upArrow) {
					const prev = navigateUp(input);
					if (prev !== null) {
						setInput(prev);
						setInputCursorKey(k => k + 1);
					}
					return;
				}

				if (key.downArrow) {
					const next = navigateDown();
					if (next !== null) {
						setInput(next);
						setInputCursorKey(k => k + 1);
					}
					return;
				}
			}
		},
		{ isActive: isInteractive },
	);

	return (
		<Box flexDirection="column" padding={1}>
			{/* Show banner only before conversation starts */}
			{config.ui.banner && messages.length === 0 && <Banner />}

			{/* Messages using Static - completed messages scroll up, streaming stays visible */}
			<MessageList messages={messages} />

			{/* Bottom section */}
			<Box flexDirection="column" flexShrink={0}>

				<Box>
					<Text color={colors.logo} bold>
						❯{' '}
					</Text>
					{!isReady && !copilotError && (
						<Text dimColor>Initializing Kopilot...</Text>
					)}
					{copilotError && (
						<Text color="red">Error: {copilotError.message}</Text>
					)}
					{isReady && isStreaming && !hasPrompt && (
						<Text dimColor>Waiting for response...</Text>
					)}
					{isReady && hasPrompt && (
						<Text dimColor>Respond to the prompt below...</Text>
					)}
					{isReady && !isStreaming && !isModelPickerOpen && !hasPrompt && (
						<TextInput
							key={inputCursorKey}
							value={input}
							onChange={setInput}
							onSubmit={handleSubmit}
							placeholder="Type @ to attach files or / for commands"
						/>
					)}
					{isReady && !isStreaming && isModelPickerOpen && !hasPrompt && (
						<Text dimColor>Select a model and press Enter.</Text>
					)}
				</Box>

				{/* Interactive prompts */}
				{pendingPermission && (
					<PermissionPrompt
						request={pendingPermission}
						onResolve={actions.resolvePermission}
					/>
				)}
				{pendingUserInput && (
					<UserInputPrompt
						request={pendingUserInput}
						onResolve={actions.resolveUserInput}
					/>
				)}

				{isModelPickerOpen && !hasPrompt && (
					<ModelPicker
						title="Models"
						models={modelOptions}
						activeIndex={modelPickerIndex}
						currentModel={currentModel}
						status={modelsStatus}
						errorMessage={modelsError}
						borderColor={colors.border}
						accentColor={colors.star}
						textColor={colors.text}
						dimColor={colors.dimText}
					/>
				)}
				{isPickerOpen && pickerContext && !isModelPickerOpen && !hasPrompt && (
					<Picker
						title={pickerContext.kind === 'command' ? 'Commands' : 'Files'}
						items={pickerItems}
						activeIndex={pickerIndex}
					/>
				)}
				<Box marginTop={1}>
					<Text dimColor>
						{hasPrompt
							? 'Respond to the prompt above'
							: isModelPickerOpen
								? 'esc cancel · enter select model · up/down select · ctrl-c twice exit'
								: 'esc cancel · ctrl-c twice exit · up/down select · /help commands · // to escape'}
					</Text>
				</Box>
					<StatusBar
					cwd={runtimeCwd}
					currentModel={currentModel}
					status={status}
				/>
			</Box>
		</Box>
	);
}
