import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BackendAdapter } from '../services/BackendAdapter';
import { DemoRepository } from '../services/DemoRepository';
import { SupabaseRepository } from '../services/SupabaseRepository';
import { isSupabaseConfigured, createSupabaseClient } from '../services/supabaseClient';
import { themes, type Theme, type ThemeMode } from '../theme/tokens';

type BackendMode = 'demo' | 'supabase';

interface AppState {
  backend: BackendAdapter;
  mode: BackendMode;
  demo: DemoRepository;
  /** The real Supabase adapter, or null when no backend env is configured. */
  production: BackendAdapter | null;
  authReady: boolean;
  session: { id: string; email: string } | null;
  backendNotice: string | null;
  retryBackend: () => void;
  refreshSession: (adapter?: BackendAdapter) => Promise<void>;
  enterDemo: () => Promise<void>;
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;
}

const Ctx = createContext<AppState | null>(null);

const THEME_KEY = 'projecttwo.theme';
const MOTION_KEY = 'projecttwo.reducedMotion';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [configuredMode] = useState<BackendMode>(() => (isSupabaseConfigured() ? 'supabase' : 'demo'));
  // The user's explicit choice to enter the fictional demo overrides the
  // configured backend until they sign out or reset.
  const [demoActive, setDemoActive] = useState(false);
  const demo = useMemo(() => new DemoRepository(), []);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [backendProbeKey, setBackendProbeKey] = useState(0);
  const retryBackend = useCallback(() => setBackendProbeKey((k) => k + 1), []);
  const mode: BackendMode = demoActive ? 'demo' : configuredMode;
  const production: BackendAdapter | null = useMemo(() => {
    if (configuredMode !== 'supabase') return null;
    try {
      return new SupabaseRepository(createSupabaseClient());
    } catch {
      return null;
    }
  }, [configuredMode]);
  const backend: BackendAdapter = demoActive ? demo : production ?? demo;

  // A real user must never be silently switched into the fictional demo.
  // If the production backend cannot be reached, we surface a blocking
  // error with a retry action; the demo remains an explicit choice on the
  // welcome screen only.
  useEffect(() => {
    if (configuredMode !== 'supabase') return;
    let cancelled = false;
    (async () => {
      try {
        const probe = new SupabaseRepository(createSupabaseClient());
        await probe.getMyProfile();
        if (!cancelled) setBackendError(null);
      } catch {
        if (cancelled) return;
        setBackendError(
          'We cannot reach your Project Two space right now. Check your connection and try again — your letters are waiting on the real account system. The demo below is fictional and separate.'
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configuredMode, backendProbeKey]);

  const [themeMode, setThemeModeState] = useState<ThemeMode>(() =>
    Appearance.getColorScheme() === 'dark' ? 'moonlit' : 'daylight'
  );
  const [reducedMotion, setReducedMotionState] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const t = await AsyncStorage.getItem(THEME_KEY);
        if (t === 'daylight' || t === 'moonlit') setThemeModeState(t);
        const m = await AsyncStorage.getItem(MOTION_KEY);
        if (m === '1') setReducedMotionState(true);
      } catch {
        /* defaults hold */
      }
    })();
  }, []);

  const setThemeMode = useCallback((m: ThemeMode) => {
    setThemeModeState(m);
    AsyncStorage.setItem(THEME_KEY, m).catch(() => {});
  }, []);

  const setReducedMotion = useCallback((v: boolean) => {
    setReducedMotionState(v);
    AsyncStorage.setItem(MOTION_KEY, v ? '1' : '0').catch(() => {});
  }, []);

  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<{ id: string; email: string } | null>(null);

  const refreshSession = useCallback(
    async (adapter?: BackendAdapter) => {
      try {
        const s = await (adapter ?? backend).getSession();
        setSession(s);
      } catch {
        setSession(null);
      } finally {
        setAuthReady(true);
      }
    },
    [backend]
  );

  const enterDemo = useCallback(async () => {
    setDemoActive(true);
    await demo.seedDemoCouple();
    await demo.signInAsPartner('a');
    // Read the demo adapter explicitly: the refreshed `backend` value is not
    // visible in this closure yet.
    await refreshSession(demo);
  }, [demo, refreshSession]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const theme = themes[themeMode];

  const value = useMemo(
    () => ({
      backend, mode, demo, production, authReady, session, backendNotice: backendError, retryBackend, refreshSession, enterDemo,
      theme, themeMode, setThemeMode, reducedMotion, setReducedMotion,
    }),
    [backend, mode, demo, production, authReady, session, backendError, retryBackend, refreshSession, enterDemo,
     theme, themeMode, setThemeMode, reducedMotion, setReducedMotion]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
