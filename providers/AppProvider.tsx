import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import type { BackendAdapter } from '../services/BackendAdapter';
import { DemoRepository } from '../services/DemoRepository';
import { SupabaseRepository } from '../services/SupabaseRepository';
import { isSupabaseConfigured, createSupabaseClient } from '../services/supabaseClient';

type BackendMode = 'demo' | 'supabase';

interface AppState {
  backend: BackendAdapter;
  mode: BackendMode;
  demo: DemoRepository;
  authReady: boolean;
  session: { id: string; email: string } | null;
  refreshSession: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [mode] = useState<BackendMode>(() => (isSupabaseConfigured() ? 'supabase' : 'demo'));
  const demo = useMemo(() => new DemoRepository(), []);
  const backend: BackendAdapter = useMemo(() => {
    if (mode === 'supabase') {
      try {
        return new SupabaseRepository(createSupabaseClient());
      } catch {
        return demo;
      }
    }
    return demo;
  }, [mode, demo]);

  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<{ id: string; email: string } | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      const s = await backend.getSession();
      setSession(s);
    } catch {
      setSession(null);
    } finally {
      setAuthReady(true);
    }
  }, [backend]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const value = useMemo(
    () => ({ backend, mode, demo, authReady, session, refreshSession }),
    [backend, mode, demo, authReady, session, refreshSession]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
