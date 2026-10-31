// Regression tests for the preview/demo build flag. EXPO_PUBLIC_FORCE_DEMO=1
// must force the fictional demo flow even when a full Supabase production
// configuration is present, so a demo APK can never connect to a real
// backend. Unset, the flag must not change production behavior.
//
// supabaseClient reads its env constants at module scope, so the production
// variables are set BEFORE the module is imported below.

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-anon-key';

let failures = 0;
function check(name: string, pass: boolean, detail = '') {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failures += 1;
}

async function main() {
  // Imported after the production env vars are set (the module reads them
  // at scope evaluation time).
  const { isSupabaseConfigured } = await import('../../services/supabaseClient');

  // 1. With production variables present and no flag, the app is configured
  //    for the real backend (unchanged behavior).
  check(
    'production config present + no flag -> supabase configured',
    isSupabaseConfigured() === true
  );

  // 2. The flag forces demo mode even with production variables present.
  process.env.EXPO_PUBLIC_FORCE_DEMO = '1';
  check(
    'FORCE_DEMO=1 wins over present production config',
    isSupabaseConfigured() === false
  );

  // 3. Any value other than exactly '1' does not trigger the flag.
  process.env.EXPO_PUBLIC_FORCE_DEMO = 'true';
  check(
    "flag values other than '1' are ignored",
    isSupabaseConfigured() === true
  );
  process.env.EXPO_PUBLIC_FORCE_DEMO = '0';
  check(
    "flag '0' is ignored",
    isSupabaseConfigured() === true
  );

  // 4. Unsetting the flag restores production behavior.
  delete process.env.EXPO_PUBLIC_FORCE_DEMO;
  check(
    'unset flag restores production behavior',
    isSupabaseConfigured() === true
  );

  if (failures > 0) {
    console.error(`DEMO FLAG TESTS: ${failures} FAILED`);
    process.exit(1);
  }
  console.log('DEMO FLAG TESTS PASS');
}

main().catch((e) => {
  console.error('DEMO FLAG TESTS: crashed —', e);
  process.exit(1);
});
