/**
 * Custom tools for the Copilot SDK.
 * Tools defined here are exposed to the assistant and can be called during conversations.
 * @module agent/tools
 */

import {defineTool, type Tool} from '@github/copilot-sdk';

/**
 * Example weather tool that demonstrates custom tool capabilities.
 * In a real app, this would call an actual weather API.
 */
export const getWeather = defineTool('get_weather', {
	description: 'Get the current weather for a city',
	parameters: {
		type: 'object',
		properties: {
			city: {type: 'string', description: 'The city name'},
		},
		required: ['city'],
	},
	handler: async (args: {city: string}) => {
		const {city} = args;
		// Simulated weather data - in a real app, call a weather API
		const conditions = ['sunny', 'cloudy', 'rainy', 'partly cloudy'];
		const temp = Math.floor(Math.random() * 30) + 50;
		const condition = conditions[Math.floor(Math.random() * conditions.length)];
		return {city, temperature: `${temp}°F`, condition};
	},
});

/**
 * Tool to get the current date and time.
 */
export const getCurrentTime = defineTool('get_current_time', {
	description: 'Get the current date and time',
	parameters: {
		type: 'object',
		properties: {
			timezone: {
				type: 'string',
				description: 'The timezone (e.g., "America/New_York", "UTC")',
			},
		},
		required: [],
	},
	handler: async (args: {timezone?: string}) => {
		const {timezone} = args;
		const now = new Date();
		const options: Intl.DateTimeFormatOptions = {
			dateStyle: 'full',
			timeStyle: 'long',
			timeZone: timezone ?? 'UTC',
		};
		try {
			return {
				datetime: now.toLocaleString('en-US', options),
				timezone: timezone ?? 'UTC',
				iso: now.toISOString(),
			};
		} catch {
			// Invalid timezone, fall back to UTC
			return {
				datetime: now.toLocaleString('en-US', {...options, timeZone: 'UTC'}),
				timezone: 'UTC',
				iso: now.toISOString(),
			};
		}
	},
});

/**
 * Default set of tools to expose to Copilot.
 */
export const defaultTools = [getWeather, getCurrentTime] as Tool[];

/**
 * Create a custom tool collection with optional additional tools.
 */
export function createToolCollection(additionalTools: Tool[] = []): Tool[] {
	return [...defaultTools, ...additionalTools];
}
