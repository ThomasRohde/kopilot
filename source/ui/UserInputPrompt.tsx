/**
 * Interactive user input prompt for agent questions.
 * @module ui/UserInputPrompt
 */

import React, {useState} from 'react';
import {Box, Text, useInput} from 'ink';
import TextInput from 'ink-text-input';
import type {UserInputRequest, UserInputResponse} from '../types/index.js';
import {colors} from '../constants/index.js';

type UserInputPromptProps = {
	request: UserInputRequest;
	onResolve: (response: UserInputResponse) => void;
};

export const UserInputPrompt: React.FC<UserInputPromptProps> = ({
	request,
	onResolve,
}) => {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [freeformValue, setFreeformValue] = useState('');
	const hasChoices = request.choices && request.choices.length > 0;
	const allowFreeform = request.allowFreeform !== false;

	useInput(
		(_input, key) => {
			if (!hasChoices) {
				return;
			}

			if (key.upArrow) {
				setSelectedIndex(i => Math.max(0, i - 1));
				return;
			}

			if (key.downArrow) {
				setSelectedIndex(i =>
					Math.min((request.choices?.length ?? 1) - 1, i + 1),
				);
				return;
			}

			if (key.return) {
				const choice = request.choices?.[selectedIndex];
				if (choice) {
					onResolve({answer: choice, wasFreeform: false});
				}
			}
		},
		{isActive: hasChoices && !allowFreeform},
	);

	const handleFreeformSubmit = (value: string) => {
		if (value.trim()) {
			onResolve({answer: value.trim(), wasFreeform: true});
		}
	};

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={colors.logo}
			paddingX={1}
			marginTop={1}
		>
			<Text bold color={colors.logo}>
				Agent Question
			</Text>
			<Box paddingLeft={1}>
				<Text>{request.question}</Text>
			</Box>

			{hasChoices && (
				<Box flexDirection="column" paddingLeft={1} marginTop={1}>
					{request.choices!.map((choice, index) => {
						const isActive = index === selectedIndex;
						return (
							<Box key={choice}>
								<Text
									color={isActive ? 'black' : colors.text}
									backgroundColor={isActive ? colors.star : undefined}
								>
									{isActive ? ' > ' : '   '}
									{choice}
								</Text>
							</Box>
						);
					})}
				</Box>
			)}

			{allowFreeform && (
				<Box paddingLeft={1} marginTop={1}>
					<Text dimColor>{'> '}</Text>
					<TextInput
						value={freeformValue}
						onChange={setFreeformValue}
						onSubmit={handleFreeformSubmit}
						placeholder="Type your answer..."
					/>
				</Box>
			)}

			<Box marginTop={1}>
				<Text dimColor>
					{hasChoices && !allowFreeform
						? 'up/down to select, enter to confirm'
						: hasChoices && allowFreeform
							? 'up/down to select, enter to confirm, or type a response'
							: 'Type your response and press enter'}
				</Text>
			</Box>
		</Box>
	);
};
