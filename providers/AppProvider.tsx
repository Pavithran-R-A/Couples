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
  authReady: boolean;
  session: { id: string; email: string } | null;
  backendNotice: string | null;
  refreshSession: () => Promise<void>;
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
  const demo = useMemo(() => new DemoRepository(), []);
  const [forcedDemo, setForcedDemo] = useState(false);
  const [backendNotice, setBackendNotice] = useState<string | null>(null);
  const mode: BackendMode = forcedDemo ? 'demo' : configuredMode;
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

  // If the configured backend cannot serve data (schema absent, network
  // down), fall back to the interactive demo with a visible notice rather
  // than letting every screen throw.
  useEffect(() => {
    if (configuredMode !== 'supabase') return;
    let cancelled = false;
    (async () => {
      try {
        const probe = new SupabaseRepository(createSupabaseClient());
        await probe.getMyProfile();
      } catch {
        if (cancelled) return;
        setForcedDemo(true);
        setBackendNotice(
          'The production backend is not ready yet, so the app is running the interactive demo with fictional data.'
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configuredMode]);

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

  const theme = themes[themeMode];

  const value = useMemo(
    () => ({
      backend, mode, demo, authReady, session, backendNotice, refreshSession,
      theme, themeMode, setThemeMode, reducedMotion, setReducedMotion,
    }),
    [backend, mode, demo, authReady, session, backendNotice, refreshSession,
     theme, themeMode, setThemeMode, reducedMotion, setReducedMotion]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
