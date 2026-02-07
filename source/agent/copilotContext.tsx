import React, {
	createContext,
	useCallback,
	useContext,
	useState,
	useEffect,
	useRef,
	useMemo,
	type ReactNode,
} from 'react';
import {
	CopilotClient,
	type CopilotSession,
	type CopilotClientOptions,
	type PermissionHandler,
	type PermissionRequest,
	type PermissionRequestResult,
	type SessionConfig,
} from '@github/copilot-sdk';
import {buildRuntimeConfig, type RuntimeConfig} from '../core/config.js';
import {createLogger} from '../core/logger.js';
import type {UserInputRequest, UserInputResponse} from '../types/index.js';

type CopilotContextType = {
	client: CopilotClient | null;
	session: CopilotSession | null;
	status: 'starting' | 'ready' | 'error' | 'stopped';
	error: Error | null;
	config: RuntimeConfig;
	pendingPermission: PermissionRequest | null;
	pendingUserInput: UserInputRequest | null;
	actions: {
		createSession: (override?: Partial<SessionConfig>) => Promise<CopilotSession | null>;
		resumeSession: (
			sessionId: string,
			override?: Partial<SessionConfig>,
		) => Promise<CopilotSession | null>;
		stop: () => Promise<void>;
		resolvePermission: (result: PermissionRequestResult) => void;
		resolveUserInput: (response: UserInputResponse) => void;
	};
};

const CopilotContext = createContext<CopilotContextType | null>(null);

type CopilotProviderProps = {
	children: ReactNode;
	config?: RuntimeConfig;
};

export function CopilotProvider({children, config}: CopilotProviderProps) {
	const runtimeConfig = useMemo(
		() => (config ? buildRuntimeConfig(config) : buildRuntimeConfig()),
		[config],
	);
	const logger = useMemo(
		() => createLogger(runtimeConfig.logLevel),
		[runtimeConfig.logLevel],
	);
	const [client, setClient] = useState<CopilotClient | null>(null);
	const [session, setSession] = useState<CopilotSession | null>(null);
	const [status, setStatus] = useState<CopilotContextType['status']>(
		'starting',
	);
	const [error, setError] = useState<Error | null>(null);

	// Permission handler bridge
	const [pendingPermission, setPendingPermission] =
		useState<PermissionRequest | null>(null);
	const permissionResolverRef = useRef<
		((result: PermissionRequestResult) => void) | null
	>(null);

	// User input handler bridge
	const [pendingUserInput, setPendingUserInput] =
		useState<UserInputRequest | null>(null);
	const userInputResolverRef = useRef<
		((response: UserInputResponse) => void) | null
	>(null);

	const resolvePermission = useCallback(
		(result: PermissionRequestResult) => {
			if (permissionResolverRef.current) {
				permissionResolverRef.current(result);
				permissionResolverRef.current = null;
			}

			setPendingPermission(null);
		},
		[],
	);

	const resolveUserInput = useCallback(
		(response: UserInputResponse) => {
			if (userInputResolverRef.current) {
				userInputResolverRef.current(response);
				userInputResolverRef.current = null;
			}

			setPendingUserInput(null);
		},
		[],
	);

	// Create the permission handler that bridges SDK callbacks to React state
	const permissionHandler: PermissionHandler = useCallback(
		(request: PermissionRequest) => {
			return new Promise<PermissionRequestResult>(resolve => {
				permissionResolverRef.current = resolve;
				setPendingPermission(request);
			});
		},
		[],
	);

	// Create the user input handler that bridges SDK callbacks to React state
	const userInputHandler = useCallback(
		(request: UserInputRequest) => {
			return new Promise<UserInputResponse>(resolve => {
				userInputResolverRef.current = resolve;
				setPendingUserInput(request);
			});
		},
		[],
	);

	// Track references for cleanup
	const sessionRef = useRef<CopilotSession | null>(null);
	const clientRef = useRef<CopilotClient | null>(null);

	// Build session config with handlers
	const buildSessionConfig = useCallback(
		(override?: Partial<SessionConfig>) => ({
			...runtimeConfig.sessionConfig,
			tools: runtimeConfig.tools.length > 0 ? runtimeConfig.tools : undefined,
			onPermissionRequest: permissionHandler,
			onUserInputRequest: userInputHandler,
			...override,
		}),
		[runtimeConfig, permissionHandler, userInputHandler],
	);

	useEffect(() => {
		let mounted = true;
		const copilotClient = new CopilotClient(
			runtimeConfig.clientOptions as CopilotClientOptions,
		);
		clientRef.current = copilotClient;

		(async () => {
			try {
				setStatus('starting');
				await copilotClient.start();
				const copilotSession = await initializeSession(
					copilotClient,
					runtimeConfig,
					logger,
					permissionHandler,
					userInputHandler,
				);

				if (!mounted) {
					await copilotSession?.destroy().catch(() => undefined);
					return;
				}

				sessionRef.current = copilotSession;
				setClient(copilotClient);
				setSession(copilotSession);
				setStatus('ready');
				setError(null);
			} catch (err) {
				if (mounted) {
					setError(err as Error);
					setStatus('error');
				}
			}
		})();

		return () => {
			mounted = false;
			(async () => {
				try {
					// Use refs to get the actual instances, not state
					if (sessionRef.current) {
						await sessionRef.current.destroy().catch(() => {
							// Ignore errors if connection is already disposed
						});
						sessionRef.current = null;
					}

					if (clientRef.current) {
						await clientRef.current.stop().catch(() => {
							// Ignore errors if connection is already disposed
						});
						clientRef.current = null;
					}
				} catch {
					// Silently ignore cleanup errors
				}
			})();
		};
	}, [runtimeConfig, logger, permissionHandler, userInputHandler]);

	const replaceSession = async (next: CopilotSession | null) => {
		if (sessionRef.current) {
			await sessionRef.current.destroy().catch(() => undefined);
		}

		sessionRef.current = next;
		setSession(next);
	};

	const createSession = async (override?: Partial<SessionConfig>) => {
		if (!clientRef.current) {
			return null;
		}

		setStatus('starting');
		try {
			const next = await clientRef.current.createSession(
				buildSessionConfig(override),
			);
			await replaceSession(next);
			setStatus('ready');
			setError(null);
			return next;
		} catch (err) {
			setError(err as Error);
			setStatus('error');
			return null;
		}
	};

	const resumeSession = async (
		sessionId: string,
		override?: Partial<SessionConfig>,
	) => {
		if (!clientRef.current) {
			return null;
		}

		setStatus('starting');
		try {
			const next = await clientRef.current.resumeSession(
				sessionId,
				buildSessionConfig(override),
			);
			await replaceSession(next);
			setStatus('ready');
			setError(null);
			return next;
		} catch (err) {
			setError(err as Error);
			setStatus('error');
			return null;
		}
	};

	const stop = async () => {
		setStatus('stopped');
		setSession(null);
		try {
			if (sessionRef.current) {
				await sessionRef.current.destroy().catch(() => undefined);
				sessionRef.current = null;
			}

			if (clientRef.current) {
				await clientRef.current.stop().catch(() => undefined);
				clientRef.current = null;
			}
		} catch (err) {
			setError(err as Error);
			setStatus('error');
		}
	};

	return (
		<CopilotContext.Provider
			value={{
				client,
				session,
				status,
				error,
				config: runtimeConfig,
				pendingPermission,
				pendingUserInput,
				actions: {
					createSession,
					resumeSession,
					stop,
					resolvePermission,
					resolveUserInput,
				},
			}}
		>
			{children}
		</CopilotContext.Provider>
	);
}

export function useCopilot() {
	const context = useContext(CopilotContext);
	if (!context) {
		throw new Error('useCopilot must be used within CopilotProvider');
	}

	return context;
}

async function initializeSession(
	client: CopilotClient,
	config: RuntimeConfig,
	logger: ReturnType<typeof createLogger>,
	permissionHandler: PermissionHandler,
	userInputHandler: (request: UserInputRequest) => Promise<UserInputResponse>,
): Promise<CopilotSession> {
	// Merge tools and handlers into session config
	const sessionConfigWithHandlers = {
		...config.sessionConfig,
		tools: config.tools.length > 0 ? config.tools : undefined,
		onPermissionRequest: permissionHandler,
		onUserInputRequest: userInputHandler,
	};

	if (config.sessionStrategy === 'resume' && config.sessionId) {
		try {
			return await client.resumeSession(
				config.sessionId,
				sessionConfigWithHandlers,
			);
		} catch (error) {
			logger.warn('Failed to resume session, creating new session instead', {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	if (config.sessionStrategy === 'last') {
		try {
			const lastId = await client.getLastSessionId();
			if (lastId) {
				return await client.resumeSession(lastId, sessionConfigWithHandlers);
			}
		} catch (error) {
			logger.warn('Failed to resume last session, creating new session instead', {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return client.createSession(sessionConfigWithHandlers);
}
