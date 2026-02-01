/**
 * Message list component for chat transcript.
 * @module ui/MessageList
 */

import React from 'react';
import { Box, Static, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { Message } from '../types/index.js';
import { colors } from '../constants/index.js';
import { Markdown } from './Markdown.js';
import { formatBytes } from '../utils/format.js';

type MessageListProps = {
    messages: Message[];
};

/**
 * Renders a single message (user, system, or assistant).
 */
const MessageItem: React.FC<{ msg: Message }> = ({ msg }) => {
    if (msg.role === 'user') {
        return (
            <Box flexDirection="column" marginBottom={1}>
                <Box>
                    <Text color={colors.logo} bold>
                        ❯{' '}
                    </Text>
                    <Text bold>{msg.content}</Text>
                </Box>
                {msg.attachments && msg.attachments.length > 0 && (
                    <Text dimColor>
                        {'  '}attachments:{' '}
                        {msg.attachments
                            .map(att => {
                                const size =
                                    att.sizeBytes !== undefined
                                        ? ` (${formatBytes(att.sizeBytes)})`
                                        : '';
                                return `${att.displayName ?? att.path}${size}`;
                            })
                            .join(', ')}
                    </Text>
                )}
            </Box>
        );
    }

    if (msg.role === 'system') {
        return (
            <Box marginBottom={1} paddingLeft={2}>
                <Text
                    color={msg.kind === 'error' ? colors.error : colors.dimText}
                >
                    {msg.kind === 'error' ? '! ' : '• '}
                    {msg.content}
                </Text>
            </Box>
        );
    }

    // Assistant message
    return (
        <Box flexDirection="column" marginBottom={1} paddingLeft={2}>
            {msg.isStreaming && !msg.content ? (
                <Box>
                    <Text color={colors.star}>
                        <Spinner type="dots" />
                    </Text>
                    <Text color={colors.dimText}> Thinking...</Text>
                    <Text dimColor> (Esc to cancel)</Text>
                </Box>
            ) : (
                <Markdown>{msg.content || '...'}</Markdown>
            )}
        </Box>
    );
};

/**
 * Renders the chat transcript with user, assistant, and system messages.
 * Uses Ink's Static component for completed messages to prevent re-renders
 * and keep them "above the fold" while streaming content stays dynamic.
 */
export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
    // Split messages: completed go to Static, streaming stays dynamic
    const completedMessages = messages.filter(
        msg => msg.role !== 'assistant' || !msg.isStreaming
    );
    const streamingMessage = messages.find(
        msg => msg.role === 'assistant' && msg.isStreaming
    );

    return (
        <Box flexDirection="column">
            {/* Completed messages - rendered once and pushed above viewport */}
            <Static items={completedMessages}>
                {msg => <MessageItem key={msg.id} msg={msg} />}
            </Static>

            {/* Currently streaming message - re-renders as content arrives */}
            {streamingMessage && (
                <MessageItem key={streamingMessage.id} msg={streamingMessage} />
            )}
        </Box>
    );
};
