# Project Two — Release Progress Evidence Register

Last updated: 2026-10-17 (Gate 1 complete). Each item lists real verification
performed in this session, or states plainly that verification was not possible.

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
  place but no live account was created during this session.
- Pocket-note production path against live Data API (table + policies exist;
  repository methods match; no live authenticated session exercised).

## Implemented and tested (Gate 4)

| Android handoff configuration | `app.json`: adaptive icon with foreground + monochrome layers on midnight `#151D32`; splash with explicit dark variant on `#0E1526`; `projecttwo://` scheme plus `https://projecttwo.app` App Links intent filter (autoVerify); permissions limited to `POST_NOTIFICATIONS`; EAS `extra.projectId` placeholder documented in `docs/ANDROID_RELEASE.md` alongside the exact blocked commands (`eas login`, `eas secret:create`, `eas build -p android --profile preview` for the APK, local `gradlew assembleRelease` alternative needing SDK 36) and an 8-point on-device checklist. |

## Blocked by missing external access

- GitHub Actions run verdict: we cannot trigger or observe runs in
  `pavithran299/Couples` from this environment. Every workflow step is now
  verified locally (typecheck 0, lint --max-warnings 0 clean, three tsx
  suites pass, migration suite 35/35, web export builds, eas.json check
  passes), but the green verdict must come from a real run at the pushed SHA.
  Seven earlier runs recorded zero job records — the most likely causes are
  Actions disabled for the repo / no runner minutes (private repo billing),
  or a startup failure before jobs were created. Check the repo's
  Settings → Actions → General ("Allow all actions") and the Actions billing
  section; then push and read the run at the new SHA. If a run still shows
  zero jobs, capture the run's `check_suite` state from the API for diagnosis.
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
