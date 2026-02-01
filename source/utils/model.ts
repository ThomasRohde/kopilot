/**
 * Model picker utilities.
 * @module utils/model
 */

import type {ModelInfo} from '@github/copilot-sdk';
import type {ModelOption} from '../types/index.js';
import {formatTokenCount, formatMultiplier, formatPolicyLabel} from './format.js';

/**
 * Build details string for a model.
 * @param model - Model info object
 * @returns Details string or null
 */
export function buildModelDetails(model: ModelInfo): string | null {
	const details: string[] = [];
	const maxContext = model.capabilities?.limits?.max_context_window_tokens;
	if (typeof maxContext === 'number') {
		details.push(`ctx ${formatTokenCount(maxContext)}`);
	}

	if (model.capabilities?.supports?.vision) {
		details.push('vision');
	}

	return details.length > 0 ? details.join(' · ') : null;
}

/**
 * Build model options list for picker.
 * @param models - Available models (can be strings or ModelInfo objects)
 * @param currentModel - Currently selected model ID
 * @returns Sorted list of model options
 */
export function buildModelOptions(
	models: Array<ModelInfo | string> | undefined,
	currentModel: string,
): ModelOption[] {
	const seen = new Set<string>();
	const ordered: ModelOption[] = [];

	const pushOption = (option: ModelOption) => {
		const trimmed = option.id.trim();
		if (!trimmed || seen.has(trimmed)) {
			return;
		}

		seen.add(trimmed);
		ordered.push({...option, id: trimmed});
	};

	for (const model of models ?? []) {
		if (typeof model === 'string') {
			const trimmed = model.trim();
			if (!trimmed) {
				continue;
			}

			pushOption({id: trimmed, label: trimmed});
			continue;
		}

		const id = model.id?.trim() ?? '';
		if (!id) {
			continue;
		}

		const baseLabel = model.name?.trim() || id;
		const policyLabel = formatPolicyLabel(model.policy);
		const label = policyLabel ? `${baseLabel} (${policyLabel})` : baseLabel;
		const description = baseLabel !== id ? id : undefined;
		const details = buildModelDetails(model) ?? undefined;
		const metaRight =
			typeof model.billing?.multiplier === 'number'
				? formatMultiplier(model.billing.multiplier)
				: undefined;
		pushOption({
			id,
			label,
			description,
			details,
			metaRight,
			disabled: model.policy?.state === 'disabled',
		});
	}

	if (currentModel) {
		const trimmedCurrent = currentModel.trim();
		if (trimmedCurrent && !seen.has(trimmedCurrent)) {
			ordered.unshift({id: trimmedCurrent, label: trimmedCurrent});
		}
	}

	return ordered;
}
