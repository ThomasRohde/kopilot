/**
 * Picker utilities for command and file selection.
 * @module utils/picker
 */

import type {CommandSummary} from '../core/commands.js';
import type {PickerItem} from '../types/index.js';
import {MAX_PICKER_ITEMS} from '../constants/index.js';

/**
 * Detect if input starts with an incomplete command.
 * @param input - Current input string
 * @returns Object with query string, or null if not a command
 */
export function findActiveCommand(input: string): {query: string} | null {
	if (!input.startsWith('/') || input.startsWith('//')) {
		return null;
	}

	const match = input.match(/^\/([^\s]*)$/);
	if (!match) {
		return null;
	}

	return {query: match[1] ?? ''};
}

/**
 * Detect if input contains an incomplete @mention.
 * @param input - Current input string
 * @returns Object with query, start position, and quote type, or null
 */
export function findActiveMention(
	input: string,
): {query: string; start: number; quote?: '"' | "'"} | null {
	const quotedMatch = input.match(/(^|\s)@(["'])([^"']*)$/);
	if (quotedMatch) {
		return {
			query: quotedMatch[3] ?? '',
			start: input.lastIndexOf('@'),
			quote: quotedMatch[2] as '"' | "'",
		};
	}

	const match = input.match(/(^|\s)@([^\s]*)$/);
	if (!match) {
		return null;
	}

	return {query: match[2] ?? '', start: input.lastIndexOf('@')};
}

/**
 * Build picker items from command summaries.
 * @param query - Search query
 * @param commands - Available commands
 * @returns Filtered and sorted picker items
 */
export function buildCommandItems(
	query: string,
	commands: CommandSummary[],
): PickerItem[] {
	const normalized = query.toLowerCase();
	const matches = commands.filter(command => {
		if (!normalized) {
			return true;
		}

		if (command.name.startsWith(normalized)) {
			return true;
		}

		return (
			command.aliases?.some(alias => alias.startsWith(normalized)) ?? false
		);
	});

	matches.sort((left, right) => {
		const leftScore = left.name.startsWith(normalized)
			? 0
			: left.aliases?.some(alias => alias.startsWith(normalized))
				? 1
				: 2;
		const rightScore = right.name.startsWith(normalized)
			? 0
			: right.aliases?.some(alias => alias.startsWith(normalized))
				? 1
				: 2;

		if (leftScore !== rightScore) {
			return leftScore - rightScore;
		}

		return left.name.localeCompare(right.name);
	});

	if (matches.length === 0) {
		return [];
	}

	return matches.slice(0, MAX_PICKER_ITEMS).map(command => ({
		id: command.name,
		kind: 'command',
		label: `/${command.name}`,
		value: command.name,
		description: command.description,
		meta:
			command.aliases && command.aliases.length > 0
				? `aliases: ${command.aliases.join(', ')}`
				: undefined,
		usage: command.usage,
	}));
}

/**
 * Filter file list by query string.
 * @param query - Search query
 * @param files - Available files
 * @returns Filtered file paths
 */
export function filterFileMatches(query: string, files: string[]): string[] {
	if (files.length === 0) {
		return [];
	}

	if (!query) {
		return files.slice(0, MAX_PICKER_ITEMS);
	}

	const normalizedQuery = query.toLowerCase().replace(/\\/g, '/');
	const matchOnPath = normalizedQuery.includes('/');
	const matches = files.filter(file => {
		const normalized = file.toLowerCase();
		if (matchOnPath) {
			return normalized.includes(normalizedQuery);
		}

		const base = normalized.split('/').pop() ?? normalized;
		return base.includes(normalizedQuery);
	});

	matches.sort((a, b) => a.localeCompare(b));
	return matches.slice(0, MAX_PICKER_ITEMS);
}

/**
 * Build picker items for file selection.
 * @param query - Search query
 * @param files - Available files
 * @param isIndexing - Whether file index is loading
 * @param error - File index error message
 * @returns Picker items for file selection
 */
export function buildFileItems(
	query: string,
	files: string[],
	isIndexing: boolean,
	error: string | null,
): PickerItem[] {
	if (error) {
		return [
			{
				id: 'file-index-error',
				kind: 'file',
				label: `File search failed: ${error}`,
				value: '',
				disabled: true,
			},
		];
	}

	if (files.length === 0 && isIndexing) {
		return [
			{
				id: 'file-index-loading',
				kind: 'file',
				label: 'Scanning files...',
				value: '',
				disabled: true,
			},
		];
	}

	const matches = filterFileMatches(query, files);
	if (matches.length === 0) {
		return [];
	}

	return matches.map(file => ({
		id: file,
		kind: 'file',
		label: file,
		value: file,
	}));
}

/**
 * Wrap mention value with quotes if needed.
 * @param value - File path value
 * @param quote - Quote character to use
 * @returns Quoted or unquoted value
 */
export function wrapMentionValue(value: string, quote?: '"' | "'"): string {
	if (quote) {
		return `${quote}${value}${quote}`;
	}

	if (/\s/.test(value)) {
		return `"${value}"`;
	}

	return value;
}

/**
 * Ensure string ends with a space.
 * @param value - Input string
 * @returns String with trailing space
 */
export function ensureTrailingSpace(value: string): string {
	return value.endsWith(' ') ? value : `${value} `;
}

/**
 * Check if command usage indicates it accepts arguments.
 * @param usage - Command usage string
 * @returns True if command accepts arguments
 */
export function commandAcceptsArgs(usage?: string): boolean {
	if (!usage) {
		return false;
	}

	return usage.trim().split(/\s+/).length > 1;
}
