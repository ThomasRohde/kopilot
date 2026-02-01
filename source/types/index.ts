/**
 * Centralized type definitions for Kopilot TUI.
 * @module types
 */

import type {FileAttachment} from '../core/mentions.js';

// Re-export for convenience
export type {FileAttachment};

/**
 * Chat message in the conversation.
 */
export type Message = {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	isStreaming?: boolean;
	kind?: 'info' | 'error';
	attachments?: FileAttachment[];
};

/**
 * Type of picker being displayed.
 */
export type PickerKind = 'file' | 'command';

/**
 * Item displayed in a picker menu.
 */
export type PickerItem = {
	id: string;
	kind: PickerKind;
	label: string;
	value: string;
	description?: string;
	meta?: string;
	usage?: string;
	disabled?: boolean;
};

/**
 * Context for an active picker.
 */
export type PickerContext =
	| {kind: 'file'; query: string; start: number; quote?: '"' | "'"}
	| {kind: 'command'; query: string};

/**
 * Option displayed in the model picker.
 */
export type ModelOption = {
	id: string;
	label: string;
	description?: string;
	details?: string;
	metaRight?: string;
	disabled?: boolean;
};
