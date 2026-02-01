/**
 * Hook for managing model picker state.
 * @module hooks/useModelPicker
 */

import {useCallback, useEffect, useMemo, useState} from 'react';
import type {CopilotClient, ModelInfo} from '@github/copilot-sdk';
import type {ModelOption} from '../types/index.js';
import {buildModelOptions} from '../utils/model.js';

type UseModelPickerOptions = {
	client: CopilotClient | null;
	isReady: boolean;
	configModels: string[];
	currentModel: string;
	appendSystemMessage: (content: string, kind?: 'info' | 'error') => void;
	clearPicker: () => void;
	clearScreen: () => void;
};

type UseModelPickerResult = {
	isModelPickerOpen: boolean;
	modelPickerIndex: number;
	modelOptions: ModelOption[];
	modelsStatus: 'idle' | 'loading' | 'ready' | 'error';
	modelsError: string | null;
	openModelPicker: () => Promise<boolean>;
	closeModelPicker: () => void;
	moveModelSelection: (delta: number) => void;
	applyModelSelection: (switchModel: (model: string) => Promise<unknown>) => boolean;
	refreshModels: () => Promise<ModelInfo[] | null>;
};

/**
 * Hook for managing model picker state.
 */
export function useModelPicker(options: UseModelPickerOptions): UseModelPickerResult {
	const {
		client,
		isReady,
		configModels,
		currentModel,
		appendSystemMessage,
		clearPicker,
		clearScreen,
	} = options;

	const [availableModels, setAvailableModels] = useState<ModelInfo[] | null>(null);
	const [modelsStatus, setModelsStatus] = useState<
		'idle' | 'loading' | 'ready' | 'error'
	>('idle');
	const [modelsError, setModelsError] = useState<string | null>(null);
	const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
	const [modelPickerIndex, setModelPickerIndex] = useState(0);

	const modelOptions = useMemo(() => {
		const source =
			availableModels && availableModels.length > 0
				? availableModels
				: configModels;
		return buildModelOptions(source, currentModel);
	}, [availableModels, configModels, currentModel]);

	const refreshModels = useCallback(async () => {
		if (!client) {
			return null;
		}

		setModelsStatus('loading');
		setModelsError(null);
		try {
			const models = await client.listModels();
			setAvailableModels(models);
			setModelsStatus('ready');
			return models;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			setModelsError(message);
			setModelsStatus('error');
			return null;
		}
	}, [client]);

	// Auto-refresh models when ready
	useEffect(() => {
		if (!isReady || modelsStatus !== 'idle') {
			return;
		}

		void refreshModels();
	}, [isReady, modelsStatus, refreshModels]);

	const openModelPicker = useCallback(async () => {
		if (!isReady || !client) {
			appendSystemMessage('Copilot is not ready yet.', 'error');
			return false;
		}

		if (modelsStatus === 'idle' || modelsStatus === 'error') {
			await refreshModels();
		}

		if (modelOptions.length === 0) {
			const fallbackMessage =
				modelsStatus === 'error'
					? modelsError ?? 'Failed to load models.'
					: 'No models configured.';
			appendSystemMessage(fallbackMessage, 'error');
			return false;
		}

		const currentIndex = modelOptions.findIndex(
			option => option.id === currentModel,
		);
		setModelPickerIndex(currentIndex >= 0 ? currentIndex : 0);
		setIsModelPickerOpen(true);
		clearPicker();
		return true;
	}, [
		appendSystemMessage,
		clearPicker,
		client,
		currentModel,
		isReady,
		modelOptions,
		modelsError,
		modelsStatus,
		refreshModels,
	]);

	const closeModelPicker = useCallback(() => {
		clearScreen();
		setIsModelPickerOpen(false);
	}, [clearScreen]);

	const moveModelSelection = useCallback(
		(delta: number) => {
			setModelPickerIndex(currentIndex => {
				if (modelOptions.length === 0) {
					return currentIndex;
				}

				let nextIndex = currentIndex;
				for (let i = 0; i < modelOptions.length; i += 1) {
					nextIndex =
						(nextIndex + delta + modelOptions.length) %
						modelOptions.length;
					if (!modelOptions[nextIndex]?.disabled) {
						return nextIndex;
					}
				}

				return currentIndex;
			});
		},
		[modelOptions],
	);

	const applyModelSelection = useCallback(
		(switchModel: (model: string) => Promise<unknown>): boolean => {
			const selected = modelOptions[modelPickerIndex];
			if (!selected || selected.disabled) {
				return false;
			}

			// Clear screen to remove picker UI before adding new content.
			// This prevents picker content from being captured in Static's scroll buffer.
			clearScreen();
			setIsModelPickerOpen(false);
			void switchModel(selected.id);
			return true;
		},
		[clearScreen, modelOptions, modelPickerIndex],
	);

	// Reset index when picker opens or options change
	useEffect(() => {
		if (!isModelPickerOpen) {
			return;
		}

		if (modelOptions.length === 0) {
			setModelPickerIndex(0);
			return;
		}

		setModelPickerIndex(currentIndex => {
			if (
				currentIndex >= modelOptions.length ||
				modelOptions[currentIndex]?.disabled
			) {
				const firstEnabled = modelOptions.findIndex(
					option => !option.disabled,
				);
				return firstEnabled >= 0 ? firstEnabled : 0;
			}

			return currentIndex;
		});
	}, [isModelPickerOpen, modelOptions]);

	return {
		isModelPickerOpen,
		modelPickerIndex,
		modelOptions,
		modelsStatus,
		modelsError,
		openModelPicker,
		closeModelPicker,
		moveModelSelection,
		applyModelSelection,
		refreshModels,
	};
}
