/**
 * Animated banner component for Kopilot TUI.
 * @module ui/Banner
 */

import React, { useEffect, useRef, useState } from 'react';
import { Box, Text } from 'ink';
import { colors, VERSION, BANNER_FRAMES, FINAL_BANNER } from '../constants/index.js';

type BannerProps = {
    onComplete?: () => void;
};

/**
 * Animated banner with frame-by-frame reveal animation.
 */
export const Banner: React.FC<BannerProps> = ({ onComplete }) => {
    const [frameIndex, setFrameIndex] = useState(0);
    const [animationComplete, setAnimationComplete] = useState(false);
    const completedRef = useRef(false);

    useEffect(() => {
        if (frameIndex < BANNER_FRAMES.length - 1) {
            // ~75ms interval for smooth animation
            const timer = setTimeout(() => {
                setFrameIndex(prev => prev + 1);
            }, 75);
            return () => clearTimeout(timer);
        }

        if (!completedRef.current) {
            // Animation complete - show final banner
            completedRef.current = true;
            const timer = setTimeout(() => {
                setAnimationComplete(true);
                onComplete?.();
            }, 200);
            return () => clearTimeout(timer);
        }

        return undefined;
    }, [frameIndex, onComplete]);

    if (animationComplete) {
        // Render final static banner inside bordered box
        return (
            <Box
                flexDirection="column"
                borderStyle="round"
                borderColor={colors.border}
                paddingX={1}
                marginBottom={1}
            >
                {FINAL_BANNER.map((line, index) => (
                    <Text key={index} color={colors.logo}>
                        {line}
                    </Text>
                ))}
                <Box marginTop={1}>
                    <Text>v{VERSION}</Text>
                    <Text dimColor> · Describe a task to get started.</Text>
                </Box>
                <Box>
                    <Text dimColor>
                        Kopilot uses AI, so always check for mistakes.
                    </Text>
                </Box>
            </Box>
        );
    }

    // Render animated frame
    const frame = BANNER_FRAMES[frameIndex] ?? [];
    return (
        <Box flexDirection="column" marginBottom={1}>
            {frame.map((line, index) => (
                <Text key={index}>
                    {line.split('').map((char, charIndex) => {
                        // Color stars yellow, logo cyan
                        if (char === '✦' || char === '✧') {
                            return (
                                <Text key={charIndex} color={colors.star}>
                                    {char}
                                </Text>
                            );
                        }
                        if (
                            char === '█' ||
                            char === '╗' ||
                            char === '╔' ||
                            char === '║' ||
                            char === '╝' ||
                            char === '╚' ||
                            char === '═'
                        ) {
                            return (
                                <Text key={charIndex} color={colors.logo}>
                                    {char}
                                </Text>
                            );
                        }
                        return char;
                    })}
                </Text>
            ))}
        </Box>
    );
};
