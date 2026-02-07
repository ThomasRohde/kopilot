/**
 * Centralized type definitions for Kopilot TUI.
 * @module types
 */

import type {FileAttachment} from '../core/mentions.js';
import type {
	PermissionRequest,
	PermissionRequestResult,
} from '@github/copilot-sdk';

// Re-export for convenience
export type {FileAttachment};

// Re-export SDK types used by UI components
export type {PermissionRequest, PermissionRequestResult};

/**
 * User input request from the agent (mirrors SDK internal type).
 */
export type UserInputRequest = {
	question: string;
	choices?: string[];
	allowFreeform?: boolean;
};

/**
 * User input response (mirrors SDK internal type).
 */
export type UserInputResponse = {
	answer: string;
	wasFreeform: boolean;
};

/**
 * Token usage information from the assistant.
 */
export type TokenUsage = {
	model?: string;
	inputTokens?: number;
	outputTokens?: number;
	cacheReadTokens?: number;
	cacheWriteTokens?: number;
	cost?: number;
	duration?: number;
};

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
	usage?: TokenUsage;
	reasoning?: string;
	turnPhase?: 'thinking' | 'responding';
	intent?: string;
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
