import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  // Demo-build gate: when the preview/demo build flag is set, the app runs
  // the fictional flow unconditionally and never touches any Supabase
  // backend, even if other EXPO_PUBLIC_* variables exist. Production
  // behavior is unchanged when the flag is unset.
  if (process.env.EXPO_PUBLIC_FORCE_DEMO === '1') return false;
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function createSupabaseClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase is not configured');
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
