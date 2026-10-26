# Project Two — Release Progress Evidence Register

Last updated: 2026-10-26 (completion session). Each item lists real verification
performed in this session, or states plainly that verification was not possible.

## Implemented and tested (Hardening session, 2026-10-26 — answer finality + auth)

| Work | Evidence |
| --- | --- |
| P0: answers are append-only end to end | Before: 0006 granted UPDATE (and an unused DELETE) on responses to authenticated; 0003's `responses_update` policy allowed the author to rewrite the body whenever `revealed_at` was null — and nothing ever stamped it, so the gate never closed; `SupabaseRepository.submitResponse` used `.upsert()`, silently overwriting the original. Migration `20261026120000_0011_responses_append_only` drops `responses_update`, revokes UPDATE/DELETE from authenticated, and stamps `revealed_at` server-side via an AFTER INSERT trigger. The SECURITY DEFINER trigger is justified and fenced: the inserting client holds no UPDATE privilege by design, so an invoker-rights trigger could not stamp; EXECUTE is revoked from public/anon/authenticated; it validates letter existence and couple membership internally; it touches only `revealed_at` while null; an xact-scoped advisory lock (the 0009 pattern) serializes the two concurrent first inserts; it runs inside the inserting transaction, so insert and stamp commit together. No client clock or client-provided reveal value is trusted. The client now inserts and maps SQLSTATE 23505 to "already sealed". DemoRepository mirrors first-write-wins plus the same stamping rule. Row visibility still uses the live `both_partners_answered` rule, so existing rows keep exactly their previous visibility. |
| Adversarial finality suite | 19 new checks in `scripts/migrate-and-test.mjs` (54/54 total, exit 0), asserting affected rows and stored values explicitly, never bare `true`: exact stored body; pre-reveal blindness for partner B; 23505-specific resubmission rejection with byte-identical original and count=1; UPDATE body / revealed_at / DELETE denial at the privilege level; explicit `has_table_privilege` grant surface (select+insert only); both originals visible after both submit; identical non-null server-side stamps on both rows; post-reveal edit denial; third-account view/join/alter denial; spoofed `author_id` rejection; the stamping function is not client-callable; anon insert denial; the legacy backfill stamps completed pairs and leaves solo answers unstamped. |
| Auth session hardening | `AppProvider` now subscribes to Supabase `onAuthStateChange` (SIGNED_OUT clears the UI session; SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED refresh it) — previously a sign-out or token revocation on another device left a dead session on screen. Password recovery can now complete on-device: `resetPasswordForEmail` redirects to `projecttwo://reset-password`, the new `app/reset-password.tsx` screen parses the URL-fragment tokens, exchanges them via `auth.setSession`, and sets the new password through the new adapter method `updatePassword` (demo is an honest no-op — the fictional world has no credential store). `RootGate` skips its redirects while the pathname is `/reset-password` so gating cannot yank the user away mid-recovery. `supabaseClient.ts` already persisted sessions correctly (AsyncStorage storage, autoRefreshToken, persistSession, detectSessionInUrl:false — no change needed). |

## Implemented and tested (Completion session, 2026-10-26)

| Work | Evidence |
| --- | --- |
| GitHub Actions zero-jobs failure root-caused and fixed | All 9 runs since the workflow existed failed in ~0s with zero jobs. Cause: the `Validate eas.json build profiles` step used a multi-line YAML plain scalar (`run: node -e "`) whose closing quote line was indented 8 spaces against 10-space continuation lines — a hard parse error (`deficient indentation`), so GitHub never created a job. Fixed in commit `b9d3d2f` by wrapping the script in a literal block scalar; validated with js-yaml (file parses: jobs verify/migration/config-checks, triggers push+pull_request). Empirically confirmed on PR #1: all three jobs are now created. |
| Second CI blocker identified (external): account billing | With jobs now created, each fails in 1–4s with zero steps executed and the annotation: "The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings." The same instant-failure signature appears on other private repos of this account. Resolves only via GitHub Settings → Billing & plans; not fixable from the repository. |
| Production reactions fixed | The UI sent reaction kind `'spark'` but the hosted check constraint only allows ('heart','sparkle','smile','tear','hug') — every production reaction insert was rejected (the demo masked it). Renamed to `'sparkle'` in `domain/types.ts`, `components/ReactionRow.tsx`, `app/(tabs)/index.tsx`. Commit `2a1cb7c`. |
| Weekly-adventure doodles persist their drawing summary | `submitDoodle` pushed the serialized drawing through parent state and submitted synchronously, so the parent closure sent the stale (usually empty) entry to `complete_adventure_part`. `onSubmit` now carries the finalized entry (`(entry?: string) => void`); the parent uses `entry ?? adventureEntry`; the shared submit button invokes `onSubmit()` without leaking the press event. Commit `2a1cb7c`. |
| Invitation-code copy made real | The pairing button only flipped a local `copied` flag. It now copies via the Clipboard API on web and opens the share sheet on native (no new dependencies). Commit `2a1cb7c`. |
| Demo mode reachable in production-configured builds | `AppProvider` pinned the adapter to Supabase whenever env vars existed, so "Enter the demo" signed into the DemoRepository while `refreshSession()` read Supabase — RootGate bounced back to onboarding and the demo was unreachable. The provider now tracks an explicit `demoActive` override (`enterDemo()`), exposes `production` separately from the active `backend`, and `refreshSession(adapter?)` can target an adapter explicitly. Commit `2a1cb7c`. |
| Sign-in form establishes a provider session | `submitAuth` navigated to tabs after `signIn` without refreshing the provider session, leaving every screen with a null session. Fixed, and all real-auth calls now go through `production ?? backend` so a demo-active user signing in still hits Supabase. Commit `2a1cb7c`. |
| Full local verification at pushed SHA `f5d6730` | `tsc --noEmit` → 0 errors (exit 0) · `expo lint --max-warnings 0` → clean (exit 0) · reveal_privacy_demo / preview_smoke / demo_tour → PASS · `node scripts/migrate-and-test.mjs` → ALL 10/10 migrations applied, HARDENING RESULTS 35/35 passed (exit 0) · `expo install --check` → dependencies up to date (exit 0) · `expo export --platform web` → exit 0 · CI secret checks (no committed .env, no `eyJ` key material, no hardcoded Supabase keys) → OK · eas.json profile validation → OK. |

## Implemented and tested (Gate 2)

| Four distinct adventure presentations (no fake doodle input) | New `components/AdventureStage.tsx`: gratitude_exchange renders paired envelopes ("From you" / partner), tiny_date renders a twilight picnic vignette (moon, stars, picnic scene), playful_question renders two speech bubbles (mine vs partner's sealed one), and doodle_prompt renders a REAL finger-drawing canvas — 6 ink colors, quadratic-smoothed strokes, undo/clear, "Seal the doodle" (serialized vector summary stored in the same entry string; DB contract unchanged). Home screen routes each kind through AdventureStage; the old generic TextInput is gone. Typecheck 0, lint --max-warnings 0 clean, all suites pass, 35/35 migration checks, web export OK. |
| Premium auth screens | Signup/signin/reset forms now open with a WaxSeal–engraved divider–WaxSeal composition above the form title, matching the Midnight Postcards identity (previously bare inputs). Verified by typecheck/lint/export. |
| Memory sheet polish | "Keep a moment" bottom sheet: grip bar, tap-outside to dismiss, stamp + editorial subtitle header, "Press into the book" submit label. Verified by typecheck/lint/export. |

## Implemented and tested (Gate 1)

| Work | Evidence |
| --- | --- |
| Canonical database schema aligned with app contract (pet_states.affection/mood/last_interaction_at/last_watered_at/last_sunlit_at; memories note/photo_uri/memory_date; milestones kind/label/achieved_at; 90-question bank; get_couple_stats letters_completed/memories_count/days_together) | Applied as hosted migration `0007_align_app_contract`; column shapes verified via live catalog query: `pet_states: couple_id,name,affection,mood,last_interaction_at,last_watered_at,last_sunlit_at`, `memories: id,couple_id,author_id,title,note,memory_date,created_at,photo_uri`, 90 questions. Corrective migration committed at `supabase/migrations/20261017150000_0007_align_app_contract.sql`. |
| Signup works with email confirmation enabled | Profile row is now created by the `on_auth_user_created` trigger (server-side). Client no longer inserts the profile; onboarding shows a "check your inbox" state when no session is returned. Typecheck + lint pass. |
| Full-migration + authorization suite (19 checks, all with real data assertions) | `node scripts/migrate-and-test.mjs` → `HARDENING RESULTS: 19/19 passed` against real Postgres (PGlite wasm) with Supabase runtime emulation (roles, auth schema, auth.uid). Fake `check(..., true)` assertions removed: replay rejection, third-user join rejection and no-letter checks now assert actual return values. |
| Reveal privacy, invite expiry/replay/race, cross-couple isolation, blocked direct writes, profile-field protection, pocket-note rules, anon denial, unlink, account deletion | All covered by the 19-check suite above; each asserts returned data or explicit error/zero-row outcomes. |
| Unit tests | reveal_privacy_demo PASS · preview_smoke PASS · demo_tour PASS. |
| TypeScript | `tsc --noEmit` → 0 errors. |
| Lint (blocking) | `expo lint --max-warnings 0` → clean. |
| expo-doctor | 21/21 checks passed (earlier run this session). |
| Web export | `expo export --platform web` → dist built successfully. |
| CI workflow | Node 22.13 (SDK 57 requirement), blocking lint, migration job running the full schema + 19-check suite on real Postgres, secret check rewritten to detect actual key material (JWT-shaped `eyJ…` strings / hardcoded key assignments) instead of the `service_role` word, which false-positived on docs and SQL test fixtures. |
| eas.json (Gate 1 rewrite) | Uses Expo's documented environment selection: `"environment": "preview"` (APK profile) and `"environment": "production"` (AAB profile). The literal `"$EXPO_PUBLIC_*"` placeholder strings are gone. CI now fails the build if either environment key is missing or wrong (`Validate eas.json build profiles` step extended and verified locally). |

| Duplicate migration reconciliation (Gate 1.1) | Hosted history verified via migration list: `20261017153604_0007` is the applied version; `20261017150000_0007` was never applied and was deleted from disk. Hosted series now: 0000, 0001, 0002, 0003, 0005, 0006, 0007, 0008, 0009, 0010 — no duplicates, no gaps. |

| Weekly adventures RPC-only authorization (Gate 1.2) | Migration `0009_adventures_rpc_only` applied to the hosted DB: client INSERT/UPDATE policies dropped, `revoke insert, update, delete` + `grant select only` on `weekly_adventures`, `unique (couple_id, week_of)` backstop, `pg_advisory_xact_lock` serializing creation, `complete_adventure_part` as the sole write path with server-side side identification (caller's partner role resolved from `couples`, never trusted from the client). |

| Lumi interactive gaze + press feedback | LanternSeed now looks toward touch (gaze offset with settle-back timer), keeps squish response, reduced-motion fallback preserved. Typecheck 0, lint clean. |

| Partner B adventure bug fixed (Gate 1.3) | Home screen no longer assumes the viewer is Partner A. The viewer's side is resolved from the authorized couple record (`partnerAId === session.id`) in BOTH modes; mine/partner done flags, entries, and labels remap accordingly. Demo Mara/Theo perspective switching reloads data (load callback now depends on the session, which the provider updates on switch). Independent entries stay sealed until both sides are done, mirroring the letter reveal rule. Typecheck 0, lint clean. |

| Migration test suite rewritten to the ordered series (Gate 1.5) | `node scripts/migrate-and-test.mjs` now replays ALL of supabase/migrations (0000 → 0010, 10 files) from an empty database — the monolithic `backend_src/0001_initial_schema.sql` is no longer the test path. Three identities (mara/theo/eve) drive 35 checks, including the signup trigger creating profiles server-side. Result: `MIGRATION: ALL 10/10 APPLIED CLEANLY` + `HARDENING RESULTS: 35/35 passed`. |

| Adversarial adventure tests (Gate 1.2) | Proven by real DB responses, not assertions of true: direct INSERT permission-denied; partner A cannot forge `partner_b_done`; cannot write partner B's entry; cannot edit metadata (title); third user sees zero rows; cross-couple completion via RPC rejected; user without a couple cannot claim; >500-char entry rejected; duplicate (couple, week) insert hits the unique constraint; replay after both completed preserves flags and entries. All PASS. |

| Two-person production path (Gate 3) | Exercised against the HOSTED database exactly as the app drives it — two fresh auth identities, trigger-created profiles, `create_my_invitation` → `join_couple_with_code`, both partners claiming `get_or_create_today_letter` and inserting responses under their own JWTs (own-row policy), reveal opening both responses, `get_this_weeks_adventure` + `complete_adventure_part` from both sides (both flags true, both entries intact, sides correctly attributed by the server), `get_couple_stats` returning the contract keys. All NOTICE checks passed; test users cascade-deleted afterward (verified zero remain). NOTE: this proves the database contract end-to-end under real roles/JWTs; it does not replace a live two-device app session (see untested list). |

## Implemented but untested

- Hosted Auth end-to-end (real signup → confirmation email → login) — requires
  an Auth-enabled hosted session exercise; the trigger and client flow are in
  place but no live account was created during this session. The recovery
  deep-link completion (hardening session) additionally requires
  `projecttwo://reset-password` to be allow-listed in the hosted Supabase Auth
  redirect configuration — unverifiable from this environment.
- Pocket-note production path against live Data API (table + policies exist;
  repository methods match; no live authenticated session exercised).
- Supabase security advisors: not run — no Supabase access token exists in
  this environment, and hosted configuration must not be touched from here.

## Implemented and tested (Gate 4)

| Android handoff configuration | `app.json`: adaptive icon with foreground + monochrome layers on midnight `#151D32`; splash with explicit dark variant on `#0E1526`; `projecttwo://` scheme plus `https://projecttwo.app` App Links intent filter (autoVerify); permissions limited to `POST_NOTIFICATIONS`; EAS `extra.projectId` placeholder documented in `docs/ANDROID_RELEASE.md` alongside the exact blocked commands (`eas login`, `eas secret:create`, `eas build -p android --profile preview` for the APK, local `gradlew assembleRelease` alternative needing SDK 36) and an 8-point on-device checklist. |

## Blocked by missing external access

- GitHub Actions green verdict: two independent blockers found. (1) The
  workflow YAML defect — FIXED (see the completion session above; jobs are
  now created). (2) Account Actions billing: jobs fail before any step runs
  with "recent account payments have failed or your spending limit needs to
  be increased" — resolves only in GitHub Settings → Billing & plans. Every
  verification the run would perform already passes locally at the pushed
  SHA `f5d6730` (see the completion session above). Once billing is fixed,
  re-run PR #1's checks (e.g. `gh run rerun 40353624925`) or push.
- Android APK/AAB: requires `eas login` on a signed-in machine — **blocked
  here** (no EAS credentials in this environment; no build was produced).
  Every configuration file is ready; `docs/ANDROID_RELEASE.md` holds the
  exact commands (EAS APK path and the local `gradlew assembleRelease`
  alternative) plus the on-device checklist.
- `extra.eas.projectId` in `app.json` is a placeholder — `eas init` replaces
  it with the real project ID the first time `eas login` + `eas init` run.

## Known defects

- None open from the Phase A contract audit. Historical note: the hosted
  `get_couple_stats` returned `letters/memories/revealed` keys before
  migration 0007; any clients built before that point would have shown zeros.
- FIXED during Gate 1: `hashtext()` returns a signed int4, so
  `mod(hashtext(...), n)` could yield a negative index and adventure creation
  crashed with a not-null violation on `kind` for some (couple, week) pairs.
  Migration `0010_fix_adventure_hash_rotation` (applied to the hosted DB and
  included in the replay series) wraps both hash uses in `abs()`. The test
  suite caught this — proof the ordered replay earns its keep.
- Supabase advisor `authenticated_security_definer_function_executable`
  reports 10 WARN-level findings — every user-facing RPC is SECURITY DEFINER
  and callable by `authenticated`. This is intentional (they are the app's
  API surface and validate the caller internally); documented here so it is
  not mistaken for an oversight. 22 `auth_rls_initplan` WARNs are initplan
  cost hints (auth.uid() re-evaluation), INFO-level significance at this
  scale.

## Next highest-value work

1. Gate 2 premium UX pass (onboarding composition, home dashboard, tactile
   letter flow, Lumi interactions, scrapbook memories, distinct adventure
   presentations per kind).
2. Gate 3: two-person production verification against the hosted backend.
3. Gate 4: Android handoff (adaptive icon/splash, API 36, permissions,
   deep links, EAS profiles).
4. Live hosted E2E auth run.
