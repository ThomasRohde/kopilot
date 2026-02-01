import React, {
	createContext,
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
	type SessionConfig,
} from '@github/copilot-sdk';
import {buildRuntimeConfig, type RuntimeConfig} from '../core/config.js';
import {createLogger} from '../core/logger.js';

type CopilotContextType = {
	client: CopilotClient | null;
	session: CopilotSession | null;
	status: 'starting' | 'ready' | 'error' | 'stopped';
	error: Error | null;
	config: RuntimeConfig;
	actions: {
		createSession: (override?: Partial<SessionConfig>) => Promise<CopilotSession | null>;
		resumeSession: (
			sessionId: string,
			override?: Partial<SessionConfig>,
		) => Promise<CopilotSession | null>;
		stop: () => Promise<void>;
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

	// Track references for cleanup
	const sessionRef = useRef<CopilotSession | null>(null);
	const clientRef = useRef<CopilotClient | null>(null);

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
				} catch (err) {
					// Silently ignore cleanup errors
				}
			})();
		};
	}, [runtimeConfig, logger]); // Config is stable from CLI

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
			const next = await clientRef.current.createSession({
				...runtimeConfig.sessionConfig,
				tools: runtimeConfig.tools.length > 0 ? runtimeConfig.tools : undefined,
				...override,
			});
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
			const next = await clientRef.current.resumeSession(sessionId, {
				...runtimeConfig.sessionConfig,
				tools: runtimeConfig.tools.length > 0 ? runtimeConfig.tools : undefined,
				...override,
			});
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
				actions: {
					createSession,
					resumeSession,
					stop,
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
): Promise<CopilotSession> {
	// Merge tools into session config
	const sessionConfigWithTools = {
		...config.sessionConfig,
		tools: config.tools.length > 0 ? config.tools : undefined,
	};

	if (config.sessionStrategy === 'resume' && config.sessionId) {
		try {
			return await client.resumeSession(
				config.sessionId,
				sessionConfigWithTools,
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
				return await client.resumeSession(lastId, sessionConfigWithTools);
			}
		} catch (error) {
			logger.warn('Failed to resume last session, creating new session instead', {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return client.createSession(sessionConfigWithTools);
}
