/**
 * Hook for managing picker state (commands and files).
 * @module hooks/usePicker
 */

import {useCallback, useEffect, useRef, useState} from 'react';
import type {PickerContext, PickerItem} from '../types/index.js';
import type {CommandSummary} from '../core/commands.js';
import {
	findActiveCommand,
	findActiveMention,
	buildCommandItems,
	buildFileItems,
	wrapMentionValue,
	ensureTrailingSpace,
	commandAcceptsArgs,
} from '../utils/picker.js';

type UsePickerOptions = {
	commandList: CommandSummary[];
	fileIndex: string[];
	isIndexing: boolean;
	fileIndexError: string | null;
	ensureFileIndex: () => void;
	isReady: boolean;
	isStreaming: boolean;
	isModelPickerOpen: boolean;
	clearScreen: () => void;
};

type UsePickerResult = {
	pickerContext: PickerContext | null;
	pickerItems: PickerItem[];
	pickerIndex: number;
	isPickerOpen: boolean;
	hasSelectablePickerItems: boolean;
	clearPicker: (suppressInput?: string) => void;
	movePickerSelection: (delta: number) => void;
	applyPickerSelection: (
		input: string,
		handleCommand: (value: string) => Promise<boolean>,
		setInput: (value: string) => void,
		setInputCursorKey: React.Dispatch<React.SetStateAction<number>>,
	) => Promise<boolean>;
	updatePickerFromInput: (input: string) => void;
};

/**
 * Hook for managing command and file picker state.
 */
export function usePicker(options: UsePickerOptions): UsePickerResult {
	const {
		commandList,
		fileIndex,
		isIndexing,
		fileIndexError,
		ensureFileIndex,
		isReady,
		isStreaming,
		isModelPickerOpen,
		clearScreen,
	} = options;

	const [pickerContext, setPickerContext] = useState<PickerContext | null>(null);
	const [pickerItems, setPickerItems] = useState<PickerItem[]>([]);
	const [pickerIndex, setPickerIndex] = useState(0);
	const suppressPickerRef = useRef<string | null>(null);

	const hasSelectablePickerItems = pickerItems.some(item => !item.disabled);
	const isPickerOpen = pickerContext !== null && pickerItems.length > 0;

	const clearPicker = useCallback((suppressInput?: string) => {
		setPickerContext(current => (current === null ? current : null));
		setPickerItems(current => (current.length === 0 ? current : []));
		setPickerIndex(current => (current === 0 ? current : 0));
		if (suppressInput !== undefined) {
			suppressPickerRef.current = suppressInput;
		}
	}, []);

	const movePickerSelection = useCallback(
		(delta: number) => {
			setPickerIndex(currentIndex => {
				if (pickerItems.length === 0) {
					return currentIndex;
				}

				let nextIndex = currentIndex;
				for (let i = 0; i < pickerItems.length; i += 1) {
					nextIndex =
						(nextIndex + delta + pickerItems.length) % pickerItems.length;
					if (!pickerItems[nextIndex]?.disabled) {
						return nextIndex;
					}
				}

				return currentIndex;
			});
		},
		[pickerItems],
	);

	const applyPickerSelection = useCallback(
		async (
			input: string,
			handleCommand: (value: string) => Promise<boolean>,
			setInput: (value: string) => void,
			setInputCursorKey: React.Dispatch<React.SetStateAction<number>>,
		): Promise<boolean> => {
			if (!pickerContext || pickerItems.length === 0) {
				return false;
			}

			const selected = pickerItems[pickerIndex];
			if (!selected || selected.disabled) {
				return false;
			}

			if (pickerContext.kind === 'command') {
				const acceptsArgs = commandAcceptsArgs(selected.usage);
				if (!acceptsArgs) {
					// Clear screen to remove picker UI before executing command.
					// This prevents picker content from being captured in Static's scroll buffer.
					clearScreen();
					clearPicker(input);
					const handled = await handleCommand(`/${selected.value}`);
					if (handled) {
						setInput('');
					}
					return handled;
				}

				const nextInput = ensureTrailingSpace(`/${selected.value}`);
				setInput(nextInput);
				setInputCursorKey(current => current + 1);
				clearPicker(nextInput);
				return true;
			}

			const mentionValue = wrapMentionValue(
				selected.value,
				pickerContext.quote,
			);
			const mentionStart = pickerContext.start + 1;
			const mentionEnd =
				mentionStart +
				(pickerContext.quote ? 1 : 0) +
				pickerContext.query.length;
			const nextInput = `${input.slice(0, mentionStart)}${mentionValue}${input.slice(
				mentionEnd,
			)}`;
			const nextInputWithSpace = ensureTrailingSpace(nextInput);
			setInput(nextInputWithSpace);
			setInputCursorKey(current => current + 1);
			clearPicker(nextInputWithSpace);
			return true;
		},
		[clearPicker, clearScreen, pickerContext, pickerIndex, pickerItems],
	);

	const updatePickerFromInput = useCallback(
		(input: string) => {
			if (!isReady || isStreaming) {
				if (isPickerOpen) {
					clearPicker();
				}
				return;
			}

			if (isModelPickerOpen) {
				if (isPickerOpen) {
					clearPicker();
				}
				return;
			}

			const suppressedValue = suppressPickerRef.current;
			if (suppressedValue !== null) {
				if (suppressedValue === input) {
					return;
				}
				suppressPickerRef.current = null;
			}

			const commandMatch = findActiveCommand(input);
			if (commandMatch) {
				const items = buildCommandItems(commandMatch.query, commandList);
				if (items.length === 0) {
					clearPicker();
					return;
				}

				setPickerContext({kind: 'command', query: commandMatch.query});
				setPickerItems(items);
				return;
			}

			const mentionMatch = findActiveMention(input);
			if (mentionMatch) {
				ensureFileIndex();
				const items = buildFileItems(
					mentionMatch.query,
					fileIndex,
					isIndexing,
					fileIndexError,
				);

				if (items.length === 0) {
					clearPicker();
					return;
				}

				setPickerContext({
					kind: 'file',
					query: mentionMatch.query,
					start: mentionMatch.start,
					quote: mentionMatch.quote,
				});
				setPickerItems(items);
				return;
			}

			if (isPickerOpen) {
				clearPicker();
			}
		},
		[
			commandList,
			clearPicker,
			ensureFileIndex,
			fileIndex,
			fileIndexError,
			isIndexing,
			isModelPickerOpen,
			isPickerOpen,
			isReady,
			isStreaming,
		],
	);

	// Reset picker index when items change
	useEffect(() => {
		if (pickerItems.length === 0) {
			setPickerIndex(0);
			return;
		}

		setPickerIndex(currentIndex => {
			if (
				currentIndex >= pickerItems.length ||
				pickerItems[currentIndex]?.disabled
			) {
				const firstEnabled = pickerItems.findIndex(item => !item.disabled);
				return firstEnabled >= 0 ? firstEnabled : 0;
			}

			return currentIndex;
		});
	}, [pickerItems]);

	return {
		pickerContext,
		pickerItems,
		pickerIndex,
		isPickerOpen,
		hasSelectablePickerItems,
		clearPicker,
		movePickerSelection,
		applyPickerSelection,
		updatePickerFromInput,
	};
}
