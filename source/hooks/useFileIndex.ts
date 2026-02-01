/**
 * Hook for managing file index state.
 * @module hooks/useFileIndex
 */

import {useCallback, useEffect, useRef, useState} from 'react';
import {buildFileIndex} from '../core/fileIndex.js';

type UseFileIndexOptions = {
	cwd: string;
	maxFiles?: number;
};

type UseFileIndexResult = {
	fileIndex: string[];
	isIndexing: boolean;
	fileIndexError: string | null;
	ensureFileIndex: () => void;
};

/**
 * Hook for managing file index for @mentions.
 */
export function useFileIndex(options: UseFileIndexOptions): UseFileIndexResult {
	const {cwd, maxFiles = 20_000} = options;

	const [fileIndex, setFileIndex] = useState<string[]>([]);
	const [isIndexing, setIsIndexing] = useState(false);
	const [fileIndexError, setFileIndexError] = useState<string | null>(null);
	const fileIndexPromiseRef = useRef<Promise<void> | null>(null);

	const ensureFileIndex = useCallback(() => {
		if (fileIndexPromiseRef.current) {
			return;
		}

		setIsIndexing(true);
		fileIndexPromiseRef.current = buildFileIndex(cwd, {maxFiles})
			.then(files => {
				setFileIndex(files);
				setFileIndexError(null);
			})
			.catch(error => {
				setFileIndexError(
					error instanceof Error ? error.message : String(error),
				);
				fileIndexPromiseRef.current = null;
			})
			.finally(() => {
				setIsIndexing(false);
			});
	}, [cwd, maxFiles]);

	// Reset file index when cwd changes
	useEffect(() => {
		fileIndexPromiseRef.current = null;
		setFileIndex([]);
		setFileIndexError(null);
		setIsIndexing(false);
	}, [cwd]);

	return {
		fileIndex,
		isIndexing,
		fileIndexError,
		ensureFileIndex,
	};
}
