import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		pool: 'forks',
		singleFork: true,
		setupFiles: ['./vitest.setup.ts'],
	},
});
