/**
 * Generic picker component for commands and files.
 * @module ui/Picker
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { PickerItem } from '../types/index.js';
import { colors } from '../constants/index.js';

type PickerProps = {
    title: string;
    items: PickerItem[];
    activeIndex: number;
};

/**
 * Picker component for selecting commands or files.
 */
export const Picker: React.FC<PickerProps> = ({ title, items, activeIndex }) => {
    return (
        <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={colors.border}
            paddingX={1}
            marginTop={1}
        >
            <Text dimColor>{title}</Text>
            {items.map((item, index) => {
                const isActive = index === activeIndex && !item.disabled;
                const tone = item.disabled ? colors.dimText : colors.text;

                return (
                    <Box key={item.id}>
                        <Text
                            color={isActive ? 'black' : tone}
                            backgroundColor={isActive ? colors.star : undefined}
                        >
                            {isActive ? '  ➜ ' : '    '}
                            {item.label}
                            {item.description && (
                                <Text color={isActive ? 'black' : colors.dimText}>
                                    {` - ${item.description}`}
                                </Text>
                            )}
                            {item.meta && (
                                <Text color={isActive ? 'black' : colors.dimText}>
                                    {` (${item.meta})`}
                                </Text>
                            )}
                        </Text>
                    </Box>
                );
            })}
        </Box>
    );
};
