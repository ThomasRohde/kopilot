import {describe, it, expect} from 'vitest';
import {
	formatBytes,
	formatTokenCount,
	formatMultiplier,
	createId,
} from '../source/utils/format.js';
import {
	findActiveCommand,
	findActiveMention,
	filterFileMatches,
	wrapMentionValue,
	ensureTrailingSpace,
	commandAcceptsArgs,
} from '../source/utils/picker.js';
import {buildModelOptions} from '../source/utils/model.js';

describe('format utilities', () => {
	describe('createId', () => {
		it('returns a non-empty string', () => {
			const id = createId();
			expect(typeof id).toBe('string');
			expect(id.length).toBeGreaterThan(0);
		});

		it('returns unique IDs', () => {
			const id1 = createId();
			const id2 = createId();
			expect(id1).not.toBe(id2);
		});
	});

	describe('formatBytes', () => {
		it('formats bytes under 1KB', () => {
			expect(formatBytes(512)).toBe('512B');
			expect(formatBytes(0)).toBe('0B');
		});

		it('formats kilobytes', () => {
			expect(formatBytes(1024)).toBe('1.0KB');
			expect(formatBytes(1536)).toBe('1.5KB');
		});

		it('formats megabytes', () => {
			expect(formatBytes(1024 * 1024)).toBe('1.0MB');
			expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5MB');
		});
	});

	describe('formatTokenCount', () => {
		it('formats small counts', () => {
			expect(formatTokenCount(500)).toBe('500');
			expect(formatTokenCount(0)).toBe('0');
		});

		it('formats thousands', () => {
			expect(formatTokenCount(1000)).toBe('1k');
			expect(formatTokenCount(1500)).toBe('1.5k');
		});

		it('formats millions', () => {
			expect(formatTokenCount(1_000_000)).toBe('1m');
			expect(formatTokenCount(2_500_000)).toBe('2.5m');
		});
	});

	describe('formatMultiplier', () => {
		it('formats integers', () => {
			expect(formatMultiplier(1)).toBe('1x');
			expect(formatMultiplier(2)).toBe('2x');
		});

		it('formats decimals', () => {
			expect(formatMultiplier(0.5)).toBe('0.5x');
			expect(formatMultiplier(1.5)).toBe('1.5x');
		});

		it('handles edge cases', () => {
			expect(formatMultiplier(0)).toBe('0x');
			expect(formatMultiplier(NaN)).toBe('');
		});
	});
});

describe('picker utilities', () => {
	describe('findActiveCommand', () => {
		it('detects command start', () => {
			expect(findActiveCommand('/help')).toEqual({query: 'help'});
			expect(findActiveCommand('/m')).toEqual({query: 'm'});
			expect(findActiveCommand('/')).toEqual({query: ''});
		});

		it('ignores non-commands', () => {
			expect(findActiveCommand('hello')).toBeNull();
			expect(findActiveCommand('//escaped')).toBeNull();
			expect(findActiveCommand('/cmd arg')).toBeNull();
		});
	});

	describe('findActiveMention', () => {
		it('detects unquoted mentions', () => {
			const result = findActiveMention('@readme');
			expect(result?.query).toBe('readme');
			expect(result?.start).toBe(0);
		});

		it('detects quoted mentions', () => {
			const result = findActiveMention('@"my file');
			expect(result?.query).toBe('my file');
			expect(result?.quote).toBe('"');
		});

		it('returns null for no mention', () => {
			expect(findActiveMention('hello world')).toBeNull();
		});
	});

	describe('filterFileMatches', () => {
		const files = ['src/app.tsx', 'src/utils.ts', 'readme.md'];

		it('returns all files when no query', () => {
			const matches = filterFileMatches('', files);
			expect(matches).toHaveLength(3);
		});

		it('filters by filename', () => {
			const matches = filterFileMatches('app', files);
			expect(matches).toContain('src/app.tsx');
			expect(matches).not.toContain('readme.md');
		});

		it('filters by path', () => {
			const matches = filterFileMatches('src/', files);
			expect(matches).toHaveLength(2);
		});
	});

	describe('wrapMentionValue', () => {
		it('returns value as-is if no spaces', () => {
			expect(wrapMentionValue('readme.md')).toBe('readme.md');
		});

		it('adds quotes for values with spaces', () => {
			expect(wrapMentionValue('my file.md')).toBe('"my file.md"');
		});

		it('uses specified quote character', () => {
			expect(wrapMentionValue('file.md', "'" )).toBe("'file.md'");
		});
	});

	describe('ensureTrailingSpace', () => {
		it('adds space if missing', () => {
			expect(ensureTrailingSpace('hello')).toBe('hello ');
		});

		it('keeps existing trailing space', () => {
			expect(ensureTrailingSpace('hello ')).toBe('hello ');
		});
	});

	describe('commandAcceptsArgs', () => {
		it('returns true for commands with args', () => {
			expect(commandAcceptsArgs('/model <name>')).toBe(true);
		});

		it('returns false for simple commands', () => {
			expect(commandAcceptsArgs('/help')).toBe(false);
		});

		it('returns false for undefined', () => {
			expect(commandAcceptsArgs(undefined)).toBe(false);
		});
	});
});

describe('model utilities', () => {
	describe('buildModelOptions', () => {
		it('builds options from string array', () => {
			const options = buildModelOptions(['gpt-4', 'gpt-3.5-turbo'], 'gpt-4');
			expect(options).toHaveLength(2);
			expect(options[0]?.id).toBe('gpt-4');
		});

		it('adds current model if not in list', () => {
			const options = buildModelOptions(['gpt-4'], 'custom-model');
			expect(options).toHaveLength(2);
			expect(options[0]?.id).toBe('custom-model');
		});

		it('handles empty array', () => {
			const options = buildModelOptions([], 'gpt-4');
			expect(options).toHaveLength(1);
			expect(options[0]?.id).toBe('gpt-4');
		});
	});
});
