#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import App from './app.js';
import {CopilotProvider} from './agent/copilotContext.js';
import {parseCli} from './core/cliConfig.js';

// Async wrapper to avoid top-level await issues
async function main() {
	const {config} = await parseCli(process.argv.slice(2));

	// Render the app
	const {waitUntilExit, clear, unmount} = render(
		<CopilotProvider config={config}>
			<App />
		</CopilotProvider>,
		{exitOnCtrlC: false},
	);

	// Handle exit gracefully
	let shuttingDown = false;
	const shutdown = (code: number) => {
		if (shuttingDown) {
			return;
		}

		shuttingDown = true;
		clear();
		unmount();
		setTimeout(() => {
			process.exit(code);
		}, 50);
	};

	process.on('SIGINT', () => shutdown(0));
	process.on('SIGTERM', () => shutdown(0));
	process.on('uncaughtException', error => {
		console.error('Fatal error:', error);
		shutdown(1);
	});
	process.on('unhandledRejection', error => {
		console.error('Unhandled rejection:', error);
		shutdown(1);
	});

	// Wait for the app to exit
	await waitUntilExit();
}

// Run the app
main().catch(error => {
	console.error('Fatal error:', error);
	process.exit(1);
});
