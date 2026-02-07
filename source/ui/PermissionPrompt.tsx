/**
 * Interactive permission prompt for tool operations.
 * @module ui/PermissionPrompt
 */

import React from 'react';
import {Box, Text, useInput} from 'ink';
import type {PermissionRequest, PermissionRequestResult} from '../types/index.js';
import {colors} from '../constants/index.js';

type PermissionPromptProps = {
	request: PermissionRequest;
	onResolve: (result: PermissionRequestResult) => void;
};

function formatPermissionDetails(request: PermissionRequest): string {
	const parts = [`Kind: ${request.kind}`];
	const data = request as Record<string, unknown>;

	if (request.kind === 'shell' && typeof data['command'] === 'string') {
		parts.push(`Command: ${data['command']}`);
	}

	if ((request.kind === 'write' || request.kind === 'read') && typeof data['path'] === 'string') {
		parts.push(`Path: ${data['path']}`);
	}

	if (request.kind === 'url' && typeof data['url'] === 'string') {
		parts.push(`URL: ${data['url']}`);
	}

	if (request.kind === 'mcp' && typeof data['server'] === 'string') {
		parts.push(`Server: ${data['server']}`);
	}

	return parts.join('\n  ');
}

export const PermissionPrompt: React.FC<PermissionPromptProps> = ({
	request,
	onResolve,
}) => {
	useInput((_input, key) => {
		if (_input === 'y' || _input === 'Y' || key.return) {
			onResolve({kind: 'approved'});
			return;
		}

		if (_input === 'n' || _input === 'N' || key.escape) {
			onResolve({kind: 'denied-interactively-by-user'});
		}
	});

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={colors.star}
			paddingX={1}
			marginTop={1}
		>
			<Text bold color={colors.star}>
				Permission Required
			</Text>
			<Box paddingLeft={1} flexDirection="column">
				<Text>
					{'  '}{formatPermissionDetails(request)}
				</Text>
			</Box>
			<Box marginTop={1}>
				<Text dimColor>
					Press <Text bold>y</Text> to approve, <Text bold>n</Text> to deny
				</Text>
			</Box>
		</Box>
	);
};
