/**
 * Hook for managing input history with arrow key navigation.
 * @module hooks/useInputHistory
 */

import { useCallback, useRef, useState } from 'react';

type UseInputHistoryOptions = {
	/** Maximum number of history entries to keep */
	maxHistory?: number;
};

type UseInputHistoryResult = {
	/** Add a new entry to history */
	addToHistory: (value: string) => void;
	/** Navigate to previous entry (arrow up) */
	navigateUp: (currentInput: string) => string | null;
	/** Navigate to next entry (arrow down) */
	navigateDown: () => string | null;
	/** Reset navigation position (e.g., when input changes manually) */
	resetNavigation: () => void;
	/** Check if currently navigating history */
	isNavigating: boolean;
};

/**
 * Hook for managing input history with arrow key navigation.
 * Allows users to navigate through previous inputs using up/down arrows.
 */
export function useInputHistory(options: UseInputHistoryOptions = {}): UseInputHistoryResult {
	const { maxHistory = 100 } = options;

	// History stack (newest at end)
	const [history, setHistory] = useState<string[]>([]);

	// Current position in history (-1 means not navigating, 0 is most recent)
	const [historyIndex, setHistoryIndex] = useState(-1);

	// Store the current input before navigation started
	const pendingInputRef = useRef<string>('');

	const addToHistory = useCallback((value: string) => {
		const trimmed = value.trim();
		if (!trimmed) return;

		setHistory(prev => {
			// Don't add duplicates of the most recent entry
			if (prev.length > 0 && prev[prev.length - 1] === trimmed) {
				return prev;
			}

			const newHistory = [...prev, trimmed];
			// Trim to max size
			if (newHistory.length > maxHistory) {
				return newHistory.slice(newHistory.length - maxHistory);
			}
			return newHistory;
		});

		// Reset navigation when adding new entry
		setHistoryIndex(-1);
		pendingInputRef.current = '';
	}, [maxHistory]);

	const navigateUp = useCallback((currentInput: string): string | null => {
		if (history.length === 0) return null;

		// If starting navigation, save current input
		if (historyIndex === -1) {
			pendingInputRef.current = currentInput;
		}

		// Calculate new index (moving backwards through history)
		const newIndex = historyIndex === -1
			? history.length - 1
			: Math.max(0, historyIndex - 1);

		if (newIndex === historyIndex) return null; // Already at oldest

		setHistoryIndex(newIndex);
		return history[newIndex] ?? null;
	}, [history, historyIndex]);

	const navigateDown = useCallback((): string | null => {
		if (historyIndex === -1) return null; // Not navigating

		// Calculate new index (moving forwards through history)
		const newIndex = historyIndex + 1;

		if (newIndex >= history.length) {
			// Return to pending input
			setHistoryIndex(-1);
			return pendingInputRef.current;
		}

		setHistoryIndex(newIndex);
		return history[newIndex] ?? null;
	}, [history, historyIndex]);

	const resetNavigation = useCallback(() => {
		setHistoryIndex(-1);
		pendingInputRef.current = '';
	}, []);

	return {
		addToHistory,
		navigateUp,
		navigateDown,
		resetNavigation,
		isNavigating: historyIndex !== -1,
	};
}
