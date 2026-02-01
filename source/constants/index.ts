/**
 * Application constants for Kopilot TUI.
 * @module constants
 */

export const VERSION = '0.1.0';

/**
 * Maximum items to display in picker menus.
 */
export const MAX_PICKER_ITEMS = 8;

/**
 * Semantic color mapping for terminal UI.
 * Uses 4-bit ANSI colors for terminal compatibility.
 */
export const colors = {
	logo: 'cyan',
	logoAccent: 'cyanBright',
	eyes: 'greenBright',
	head: 'magentaBright',
	border: 'magenta',
	star: 'yellow',
	text: 'white',
	dimText: 'gray',
	error: 'red',
} as const;

/**
 * ASCII art frames for the animated banner.
 * Each frame is a step in the reveal animation.
 */
export const BANNER_FRAMES = [
	// Frame 0: Empty
	['', '', '', ''],
	// Frame 1: Stars appear
	[
		'                                    ✦',
		'         ✧                               ✧',
		'                    ✦',
		'',
	],
	// Frame 2: More stars
	[
		'      ✧                             ✦',
		'            ✧                            ✧',
		'                       ✦       ✧',
		'    ✦                                   ✧',
	],
	// Frame 3: Logo starts appearing (partial)
	[
		'      ✧                             ✦',
		'            ██╗  ██╗',
		'            ██║ ██╔╝',
		'    ✦                                   ✧',
	],
	// Frame 4: More logo
	[
		'      ✧                             ✦',
		'            ██╗  ██╗ ██████╗',
		'            ██║ ██╔╝██╔═══██╗',
		'    ✦       █████╔╝ ██║   ██║          ✧',
	],
	// Frame 5: Full logo reveal
	[
		'      ✧                                              ✦',
		'            ██╗  ██╗ ██████╗ ██████╗ ██╗██╗      ██████╗ ████████╗',
		'            ██║ ██╔╝██╔═══██╗██╔══██╗██║██║     ██╔═══██╗╚══██╔══╝',
		'    ✦       █████╔╝ ██║   ██║██████╔╝██║██║     ██║   ██║   ██║   ✧',
	],
	// Frame 6: Full logo with bottom
	[
		'      ✧                                              ✦',
		'            ██╗  ██╗ ██████╗ ██████╗ ██╗██╗      ██████╗ ████████╗',
		'            ██║ ██╔╝██╔═══██╗██╔══██╗██║██║     ██╔═══██╗╚══██╔══╝',
		'    ✦       █████╔╝ ██║   ██║██████╔╝██║██║     ██║   ██║   ██║   ✧',
		'            ██╔═██╗ ██║   ██║██╔═══╝ ██║██║     ██║   ██║   ██║',
		'            ██║  ██╗╚██████╔╝██║     ██║███████╗╚██████╔╝   ██║',
		'            ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝ ╚═════╝    ╚═╝',
	],
];

/**
 * Final static banner displayed after animation completes.
 */
export const FINAL_BANNER = [
	'██╗  ██╗ ██████╗ ██████╗ ██╗██╗      ██████╗ ████████╗',
	'██║ ██╔╝██╔═══██╗██╔══██╗██║██║     ██╔═══██╗╚══██╔══╝',
	'█████╔╝ ██║   ██║██████╔╝██║██║     ██║   ██║   ██║',
	'██╔═██╗ ██║   ██║██╔═══╝ ██║██║     ██║   ██║   ██║',
	'██║  ██╗╚██████╔╝██║     ██║███████╗╚██████╔╝   ██║',
	'╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝ ╚═════╝    ╚═╝',
];
