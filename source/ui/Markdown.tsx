/**
 * Dynamic markdown renderer with ESM/CJS compatibility.
 * @module ui/Markdown
 */

import React, { useEffect, useRef, useState } from 'react';
import { Text } from 'ink';

type MarkdownProps = {
    children: string;
};

/**
 * Production-ready markdown renderer using ink-markdown.
 * Uses dynamic import to avoid ESM/CJS module loading issues.
 */
export const Markdown: React.FC<MarkdownProps> = ({ children }) => {
    const [MarkdownComponent, setMarkdownComponent] =
        useState<React.ComponentType<{ children: string }> | null>(null);
    const loadedRef = useRef(false);

    useEffect(() => {
        if (!loadedRef.current) {
            loadedRef.current = true;
            // Dynamically import ink-markdown to avoid top-level module issues
            import('ink-markdown')
                .then(module => {
                    // Handle both default and named exports
                    const Component =
                        typeof module.default === 'function'
                            ? module.default
                            : (module as any).default?.default || module.default;
                    setMarkdownComponent(
                        () => Component as React.ComponentType<{ children: string }>,
                    );
                })
                .catch(() => {
                    // If import fails, just render plain text
                    setMarkdownComponent(() => Text);
                });
        }
    }, []);

    if (!MarkdownComponent) {
        // Show loading or plain text while component loads
        return <Text dimColor>{children}</Text>;
    }

    try {
        return <MarkdownComponent>{children}</MarkdownComponent>;
    } catch {
        // Fallback to plain text if rendering fails
        return <Text>{children}</Text>;
    }
};
