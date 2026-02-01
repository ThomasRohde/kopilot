import type {Dirent} from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

type FileIndexOptions = {
	ignore?: string[];
	maxFiles?: number;
};

const DEFAULT_IGNORED_DIRS = new Set([
	'.git',
	'node_modules',
	'dist',
	'build',
	'out',
	'coverage',
	'.next',
	'.turbo',
	'.cache',
	'.idea',
	'.vscode',
]);

function toPosixPath(value: string): string {
	return value.split(path.sep).join('/');
}

export async function buildFileIndex(
	root: string,
	options?: FileIndexOptions,
): Promise<string[]> {
	const ignored = new Set(DEFAULT_IGNORED_DIRS);
	for (const entry of options?.ignore ?? []) {
		ignored.add(entry);
	}

	const maxFiles =
		options?.maxFiles !== undefined ? options.maxFiles : Number.POSITIVE_INFINITY;
	const results: string[] = [];
	const queue: string[] = ['.'];

	while (queue.length > 0) {
		const relativeDir = queue.pop();
		if (!relativeDir) {
			continue;
		}

		const absoluteDir = path.resolve(root, relativeDir);
		let entries: Dirent[];
		try {
			entries = await fs.readdir(absoluteDir, {withFileTypes: true});
		} catch {
			continue;
		}

		for (const entry of entries) {
			if (entry.isDirectory()) {
				if (ignored.has(entry.name)) {
					continue;
				}

				const childRelative =
					relativeDir === '.'
						? entry.name
						: path.join(relativeDir, entry.name);
				queue.push(childRelative);
				continue;
			}

			if (!entry.isFile()) {
				continue;
			}

			const relativePath =
				relativeDir === '.'
					? entry.name
					: path.join(relativeDir, entry.name);
			results.push(toPosixPath(relativePath));

			if (results.length >= maxFiles) {
				return results.sort((a, b) => a.localeCompare(b));
			}
		}
	}

	return results.sort((a, b) => a.localeCompare(b));
}
