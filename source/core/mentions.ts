import fs from 'node:fs/promises';
import path from 'node:path';

export type FileAttachment = {
	type: 'file';
	path: string;
	displayName?: string;
	sizeBytes?: number;
};

export type MentionResolution = {
	attachments: FileAttachment[];
	mentions: string[];
	errors: string[];
};

type ResolveOptions = {
	cwd: string;
	maxBytes: number;
};

const mentionPattern = /(^|\s)@(?:"([^"]+)"|'([^']+)'|([^\s]+))/g;

function extractMentions(input: string): string[] {
	const mentions: string[] = [];
	let match: RegExpExecArray | null = null;
	while ((match = mentionPattern.exec(input)) !== null) {
		const raw = match[2] ?? match[3] ?? match[4];
		if (!raw) {
			continue;
		}

		const cleaned = raw.replace(/[),.;:!?]+$/, '');
		if (cleaned) {
			mentions.push(cleaned);
		}
	}

	return mentions;
}

export async function resolveFileMentions(
	input: string,
	options: ResolveOptions,
): Promise<MentionResolution> {
	const mentions = extractMentions(input);
	if (mentions.length === 0) {
		return {attachments: [], mentions: [], errors: []};
	}

	const attachments: FileAttachment[] = [];
	const errors: string[] = [];

	for (const mention of mentions) {
		const resolved = path.isAbsolute(mention)
			? mention
			: path.resolve(options.cwd, mention);
		try {
			const stat = await fs.stat(resolved);
			if (!stat.isFile()) {
				errors.push(`@${mention} is not a file.`);
				continue;
			}

			if (stat.size > options.maxBytes) {
				errors.push(
					`@${mention} is too large (${stat.size} bytes, max ${options.maxBytes}).`,
				);
				continue;
			}

			attachments.push({
				type: 'file',
				path: resolved,
				displayName: path.basename(resolved),
				sizeBytes: stat.size,
			});
		} catch {
			errors.push(`@${mention} was not found.`);
		}
	}

	return {attachments, mentions, errors};
}
