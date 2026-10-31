import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Appearance, AccessibilityInfo } from 'react-native';
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
  applyRecoveryTokens: (accessToken: string, refreshToken: string) => Promise<void>;
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
  const supabaseRepo = useMemo(() => {
    if (configuredMode !== 'supabase') return null;
    try {
      return new SupabaseRepository(createSupabaseClient());
    } catch {
      return null;
    }
  }, [configuredMode]);
  const production: BackendAdapter | null = supabaseRepo;
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
  // Reduced motion follows the OS preference unless the user has chosen
  // explicitly in Settings (stored '1'/'0' = override; absent = follow OS).
  const [reducedMotion, setReducedMotionState] = useState(false);
  const motionOverrideRef = useRef<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const t = await AsyncStorage.getItem(THEME_KEY);
        if (t === 'daylight' || t === 'moonlit') setThemeModeState(t);
        const m = await AsyncStorage.getItem(MOTION_KEY);
        if (m === '1') {
          motionOverrideRef.current = true;
          setReducedMotionState(true);
        } else if (m === '0') {
          motionOverrideRef.current = false;
          setReducedMotionState(false);
        } else {
          const os = await AccessibilityInfo.isReduceMotionEnabled();
          setReducedMotionState(os);
        }
      } catch {
        /* defaults hold */
      }
    })();
  }, []);

  useEffect(() => {
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      if (motionOverrideRef.current === null) setReducedMotionState(value);
    });
    return () => sub.remove();
  }, []);

  const setThemeMode = useCallback((m: ThemeMode) => {
    setThemeModeState(m);
    AsyncStorage.setItem(THEME_KEY, m).catch(() => {});
  }, []);

  const setReducedMotion = useCallback((v: boolean) => {
    motionOverrideRef.current = v;
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

  // Live auth state: a sign-out or token revocation on another device must
  // reach the UI instead of leaving a dead session on screen, and a sign-in
  // (for example an email-confirmation link) must refresh the session.
  const demoActiveRef = useRef(demoActive);
  useEffect(() => {
    demoActiveRef.current = demoActive;
  }, [demoActive]);

  useEffect(() => {
    if (!supabaseRepo) return;
    return supabaseRepo.onAuthStateChange((event) => {
      if (demoActiveRef.current) return; // the fictional world ignores Supabase auth
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setAuthReady(true);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        supabaseRepo
          .getSession()
          .then((s) => setSession(s))
          .catch(() => {});
      }
    });
  }, [supabaseRepo]);

  const applyRecoveryTokens = useCallback(
    async (accessToken: string, refreshToken: string) => {
      if (!supabaseRepo) throw new Error('Supabase is not configured');
      await supabaseRepo.applyRecoveryTokens(accessToken, refreshToken);
      await refreshSession(supabaseRepo);
    },
    [supabaseRepo, refreshSession]
  );

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const theme = themes[themeMode];

  const value = useMemo(
    () => ({
      backend, mode, demo, production, authReady, session, backendNotice: backendError, retryBackend, refreshSession, enterDemo, applyRecoveryTokens,
      theme, themeMode, setThemeMode, reducedMotion, setReducedMotion,
    }),
    [backend, mode, demo, production, authReady, session, backendError, retryBackend, refreshSession, enterDemo, applyRecoveryTokens,
     theme, themeMode, setThemeMode, reducedMotion, setReducedMotion]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
