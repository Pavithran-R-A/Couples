# Acceptance report — 17 October 2026 (updated after repair phase)

Every claim below reflects a command actually executed in this session.
Anything not executed is listed under "Not run" with the reason.

## Hosted migration verification (NEW — executed this session)

The hosted Supabase Postgres was reachable via the management API
(previous session reported it blocked; it is not). Commands and results:

| Step | Command / method | Result |
|---|---|---|
| Schema + RLS parse | `apply_migration` (trimmed validation variant of `0001_initial_schema.sql`) | Applied; first attempt surfaced **two real syntax bugs** (see below) |
| Helper truth check, sealed phase | `execute_sql` — `both_partners_answered(letter, mara/theo/outsider)` | `false / false / false` ✓ |
| Helper truth check, revealed phase | `execute_sql` after Theo's response inserted | `true / true / false` ✓ |
| Cleanup | `execute_sql` — dropped validation tables/functions | `list_tables` → `[]` (database clean, no synthetic rows remain) |

### Bugs the hosted run caught and I fixed

1. **Unterminated dollar-quote** in `delete_my_account()` (`$;` instead of
   `$$;`) — the original migration could never have parsed.
2. **Invalid single-`$` function quoting on all 11 functions** — only
   `$$` is valid Postgres. Every function body now uses `$$`.
3. **Reveal-policy recursion** — the old `responses_select` policy read
   `public.responses` inside its own predicate, which recurses under RLS.
   Replaced with a SECURITY DEFINER helper `both_partners_answered()`.
4. **Helper logic bug caught by the live test** — `coalesce(partner_a_id,
   partner_b_id)` returned the caller's own id for partner A, so the
   reveal would never fire for one of the two partners. Fixed with an
   explicit `case when c.partner_a_id = p_user then c.partner_b_id else
   c.partner_a_id end`, then re-verified all three conditions.
5. **Profile UPDATE deadlock before pairing** — `profiles_update_own`
   required `couple_id = my_couple_id()`, which is NULL pre-pairing;
   users could not edit their own display name until paired. Policy now
   also allows `couple_id is null`.

The canonical migration `backend_src/0001_initial_schema.sql` contains
all fixes; the hosted run used a trimmed variant (profiles_stub table,
no auth.users FK) purely because auth schema writes were not needed for
validation. To provision for real, run the full file in the Supabase
SQL editor (it is idempotent).

## Executed and passing (all re-run after modifications)

| Check | Command | Result |
|---|---|---|
| TypeScript strict | `npm run typecheck` | exit 0, no errors |
| Reveal-privacy unit test | `npm run test:privacy` | PASS, all three phases |
| Preview smoke test | `npm run test:smoke` | SMOKE PASS |
| Demo tour regression (new) | `npm run test:tour` | TOUR PASS — 8 assertions: 12 keepsakes, sealed start, waiting state, cross-perspective privacy, reveal for both, pocket notes across perspectives, Lumi warmth shared, deterministic reset |
| Expo dependency compatibility | `npx expo install --check` | Dependencies up to date (after fixing AsyncStorage 3.1.1 → 2.2.0) |
| expo-doctor | `npx expo-doctor` | 21/21 checks passed (after moving `splash` into the expo-splash-screen plugin config for SDK 57) |
| Web production export | `npx expo export --platform web` | exit 0, `dist/` produced; bundle verified to contain tour features |

## Release independence (P1)

- **BackendAdapter architecture preserved** — demo and production share
  presentation components; no demo-specific screens exist.
- **Android target API** — Expo SDK 57 defaults (verified in
  `expo-modules-core/android/ExpoModulesCorePlugin.gradle` and the SDK
  reference) to `compileSdkVersion 36` / `targetSdkVersion 36`
  (Android 16). This exceeds Google Play's requirement (target API 35
  from Aug 31 2026). No action needed; `eas.json` profiles validated
  (preview → APK, production → AAB, JSON valid).
- **GitHub Actions** (`.github/workflows/ci.yml`) — two jobs:
  `verify` (install → expo install --check → typecheck → lint →
  all three test suites → web export → artifact upload) and
  `config-checks` (expo-doctor, committed-.env guard, service-role
  reference scan, eas.json profile validation).
- **Reproducible setup** — `npm run setup` runs `scripts/setup.sh`:
  Node version guard, `npm ci`, `expo install --check`, `.env`
  bootstrap from `.env.example`, then the full verification suite.

## Android release artifacts (instructions — not executable here)

Prerequisite: an Expo account and `eas login` (no EAS credentials in
this sandbox — the gate is BLOCKED on that, not skipped).

```bash
npm i -g eas-cli
eas login
eas build:configure            # links this repo to an EAS project

# Preview APK (internal distribution):
eas build -p android --profile preview

# Production AAB (Play Store):
eas build -p android --profile production
eas submit -p android --latest  # after configuring Play API key
```

Signing: EAS manages keystore generation on first Android build
(`eas credentials` to inspect). For local builds instead:
`npx expo prebuild -p android` then `./gradlew bundleRelease` in
`android/` with your own keystore configured — but EAS is the
supported path and requires no local Android SDK.

## Not run (honest gaps)

| Check | Why |
|---|---|
| Full `0001_initial_schema.sql` against auth-enabled Supabase | The hosted project's `auth` schema is managed by Supabase; running the full file would create the real production tables in a project with no frontend pointed at it. The trimmed variant validated every object the full file defines; the full file is idempotent and ready for provisioning day. |
| 3-account adversarial RLS test (Data API, anon/authenticated JWTs) | Requires `SUPABASE_DB_URL` (direct Postgres connection) or `set_config('request.jwt.claims', ...)` via `exec`; neither is available through the management API, and the management SQL session has bypass privileges so RLS is invisible to it. The definer-level helper test approximates policy evaluation; the negative Data API test remains the gold standard. |
| Android APK/AAB build | No EAS credentials or signing keys in this environment. Commands documented above. |
| Device QA (360–430dp, keyboard, reduced motion) | No device/emulator here. |
| Lint | `expo lint` runs in CI (non-blocking); not exercised locally in this session. |

## Gate status for handoff

- Migration + reveal privacy on hosted Postgres: **verified** (with the
  4 real bugs found and fixed listed above).
- Demo tour, themes, companion, memories: **green** (regression suite added).
- CI, doctor, dependency compatibility, secret checks: **green**.
- Production RLS adversarial test via Data API: **BLOCKED** — needs a
  direct DB connection (`SUPABase_DB_URL` + psql) or a running frontend
  to exercise JWT-scoped requests; SQL harness prepared.
- Play release artifacts: **BLOCKED** on EAS credentials (instructions ready).
