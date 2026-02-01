import React from 'react';
import { Box, Text } from 'ink';
import type { ModelOption } from '../types/index.js';

// Re-export for backwards compatibility
export type { ModelOption };

type ModelPickerProps = {
	title?: string;
	models: ModelOption[];
	activeIndex: number;
	currentModel: string;
	status?: 'idle' | 'loading' | 'ready' | 'error';
	errorMessage?: string | null;
	borderColor?: string;
	accentColor?: string;
	textColor?: string;
	dimColor?: string;
};

export const ModelPicker: React.FC<ModelPickerProps> = ({
	title = 'Models',
	models,
	activeIndex,
	currentModel,
	status = 'ready',
	errorMessage,
	borderColor = 'magenta',
	accentColor = 'yellow',
	textColor = 'white',
	dimColor = 'gray',
}) => {
	const hasModels = models.length > 0;
	const statusLine =
		status === 'loading'
			? 'Loading models...'
			: status === 'error'
				? errorMessage ?? 'Failed to load models.'
				: null;

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={borderColor}
			paddingX={1}
			marginTop={1}
		>
			<Text color={dimColor}>{title}</Text>
			{statusLine && <Text dimColor>{statusLine}</Text>}
			{hasModels ? (
				models.map((model, index) => {
					const isActive = index === activeIndex && !model.disabled;
					const isCurrent = model.id === currentModel;
					const itemColor = isActive ? 'black' : (model.disabled ? dimColor : textColor);
					const backgroundColor = isActive ? accentColor : undefined;

					const extraParts: string[] = [];
					if (model.description) {
						extraParts.push(model.description);
					}
					if (model.details) {
						extraParts.push(model.details);
					}
					const extraText =
						extraParts.length > 0 ? ` — ${extraParts.join(' · ')}` : '';

					return (
						<Box key={model.id} justifyContent="space-between">
							<Text
								color={itemColor}
								backgroundColor={backgroundColor}
							>
								{isActive ? '  ➜ ' : '    '}
								{model.label ?? model.id}
								{isCurrent && <Text color={isActive ? 'black' : dimColor}>{' (current)'}</Text>}
								{extraText && <Text color={isActive ? 'black' : dimColor}>{extraText}</Text>}
							</Text>
							{model.metaRight && <Text color={isActive ? 'black' : dimColor}>{model.metaRight}</Text>}
						</Box>
					);
				})
			) : (
				<Text color={dimColor}>No models configured.</Text>
			)}
		</Box>
	);
};
