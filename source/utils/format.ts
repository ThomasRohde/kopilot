/**
 * Formatting utilities for Kopilot TUI.
 * @module utils/format
 */

import {randomUUID} from 'node:crypto';
import type {ModelInfo} from '@github/copilot-sdk';

/**
 * Generate a unique identifier.
 * Falls back to timestamp-based ID if crypto fails.
 */
export function createId(): string {
	try {
		return randomUUID();
	} catch {
		return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	}
}

/**
 * Format byte count to human-readable string.
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "512B", "1.5KB", "2.3MB")
 */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes}B`;
	}

	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)}KB`;
	}

	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Format token count to human-readable string.
 * @param tokens - Number of tokens
 * @returns Formatted string (e.g., "500", "1.5k", "2m")
 */
export function formatTokenCount(tokens: number): string {
	if (tokens >= 1_000_000) {
		const value = tokens / 1_000_000;
		return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}m`;
	}

	if (tokens >= 1_000) {
		const value = tokens / 1_000;
		return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}k`;
	}

	return `${tokens}`;
}

/**
 * Format multiplier value for display.
 * @param multiplier - The multiplier value
 * @returns Formatted string (e.g., "1x", "0.5x", "2.5x")
 */
export function formatMultiplier(multiplier: number): string {
	if (Number.isNaN(multiplier)) {
		return '';
	}

	if (multiplier === 0) {
		return '0x';
	}

	const precision =
		Number.isInteger(multiplier) ? 0 : multiplier < 1 ? 2 : 1;
	let text = multiplier.toFixed(precision);
	if (text.includes('.')) {
		text = text.replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1');
	}

	return `${text}x`;
}

/**
 * Format policy state to human-readable label.
 * @param policy - Model policy object
 * @returns Label string or null if no special state
 */
export function formatPolicyLabel(policy?: ModelInfo['policy']): string | null {
	if (!policy) {
		return null;
	}

	if (policy.state === 'disabled') {
		return 'requires enablement';
	}

	if (policy.state === 'unconfigured') {
		return 'unconfigured';
	}

	return null;
}
