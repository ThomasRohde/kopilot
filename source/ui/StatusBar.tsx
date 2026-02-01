/**
 * Status bar component showing model and connection status.
 * @module ui/StatusBar
 */

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { BoxProps } from 'ink';
import { colors } from '../constants/index.js';

type StatusBarProps = {
    cwd: string;
    currentModel: string;
    status: 'starting' | 'ready' | 'error' | 'stopped';
} & Pick<BoxProps, 'flexShrink' | 'flexGrow'>;

/**
 * Displays the current working directory, model, and connection status.
 */
export const StatusBar: React.FC<StatusBarProps> = ({ cwd, currentModel, status, flexShrink, flexGrow }) => {
    const cwdLabel = useMemo(() => {
        return cwd.replace(/^[A-Z]:\\Users\\[^\\]+/i, '~');
    }, [cwd]);

    const statusColor = useMemo(() => {
        if (status === 'ready') return colors.eyes;
        if (status === 'error') return colors.error;
        if (status === 'starting') return colors.star;
        return colors.dimText;
    }, [status]);

    const statusLabel = useMemo(() => {
        if (status === 'starting') return 'Connecting...';
        if (status === 'error') return 'Error';
        if (status === 'stopped') return 'Stopped';
        return 'Online';
    }, [status]);

    return (
        <Box
            borderStyle="round"
            borderColor="gray" // Subtle border
            paddingX={1}
            marginBottom={1}
            width="100%"
            justifyContent="space-between"
            flexShrink={flexShrink}
            flexGrow={flexGrow}
        >
            <Box>
                <Text color="gray">
                    {cwdLabel}
                </Text>
            </Box>

            <Box>
                <Text color="gray">
                    {currentModel}
                </Text>
                <Text color="gray"> │ </Text>
                <Text color={statusColor}>
                    ● {statusLabel}
                </Text>
            </Box>
        </Box>
    );
};
