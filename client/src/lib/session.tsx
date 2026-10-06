import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { PROVIDERS } from "./providers";

const STORAGE_KEY = "brazzer-dl.session.v1";

export interface AccountProfile {
  displayName: string;
  email: string;
}

export interface ProviderSession {
  account: string;
  connectedAt: string;
}

interface StoredSession {
  account: AccountProfile | null;
  providers: Record<string, ProviderSession>;
}

interface SessionContextValue {
  account: AccountProfile | null;
  providerSessions: Record<string, ProviderSession>;
  connectedCount: number;
  isConnected: (providerId: string) => boolean;
  getProviderSession: (providerId: string) => ProviderSession | undefined;
  signIn: (profile: AccountProfile) => void;
  signOut: () => void;
  connectProvider: (providerId: string, account: string) => void;
  disconnectProvider: (providerId: string) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function readStored(): StoredSession {
  if (typeof window === "undefined") return { account: null, providers: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { account: null, providers: {} };
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    const providers: Record<string, ProviderSession> = {};
    for (const [id, session] of Object.entries(parsed.providers ?? {})) {
      if (!PROVIDERS.some((provider) => provider.id === id)) continue;
      if (session && typeof session.account === "string") {
        providers[id] = { account: session.account, connectedAt: session.connectedAt ?? new Date().toISOString() };
      }
    }
    return { account: parsed.account ?? null, providers };
  } catch {
    return { account: null, providers: {} };
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredSession>(() => readStored());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable (private mode); the session simply stays in memory.
    }
  }, [state]);

  const signIn = useCallback((profile: AccountProfile) => {
    setState((current) => ({ ...current, account: profile }));
  }, []);

  const signOut = useCallback(() => {
    setState({ account: null, providers: {} });
  }, []);

  const connectProvider = useCallback((providerId: string, account: string) => {
    setState((current) => ({
      ...current,
      providers: {
        ...current.providers,
        [providerId]: { account, connectedAt: new Date().toISOString() },
      },
    }));
  }, []);

  const disconnectProvider = useCallback((providerId: string) => {
    setState((current) => {
      const next = { ...current.providers };
      delete next[providerId];
      return { ...current, providers: next };
    });
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      account: state.account,
      providerSessions: state.providers,
      connectedCount: Object.keys(state.providers).length,
      isConnected: (providerId: string) => Boolean(state.providers[providerId]),
      getProviderSession: (providerId: string) => state.providers[providerId],
      signIn,
      signOut,
      connectProvider,
      disconnectProvider,
    }),
    [state, signIn, signOut, connectProvider, disconnectProvider],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession doit être utilisé dans un SessionProvider.");
  return context;
}
