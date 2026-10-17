# Project Two — Release Progress Evidence Register

Last updated: 2026-10-17. Each item lists real verification performed in this
session, or states plainly that verification was not possible.

## Implemented and tested

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
| eas.json | Blank env values removed; profiles now reference EAS secret variables (`$EXPO_PUBLIC_SUPABASE_URL`, `$EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). |

| Weekly adventures (Phase C #3) | New table `weekly_adventures` + RLS (couple-scoped read, author-side write) + `get_this_weeks_adventure()` (idempotent, deterministic fair rotation across 4 kinds × 6 variants) + `complete_adventure_part()` (server-side author identification, 500-char limit) applied to the hosted DB and committed at `supabase/migrations/20261017154538_0008_weekly_adventures.sql`. App: `WeeklyAdventure` type, adapter methods, Supabase + Demo implementations, home-screen section with two-sided progress and entries. Typecheck 0, lint clean, all suites pass, migration suite 19/19. |

| Lumi interactive gaze + press feedback | LanternSeed now looks toward touch (gaze offset with settle-back timer), keeps squish response, reduced-motion fallback preserved. Typecheck 0, lint clean. |

## Implemented but untested

- Hosted Auth end-to-end (real signup → confirmation email → login) — requires
  an Auth-enabled hosted session exercise; the trigger and client flow are in
  place but no live account was created during this session.
- Pocket-note production path against live Data API (table + policies exist;
  repository methods match; no live authenticated session exercised).

## Blocked by missing external access

- GitHub Actions run verdict: we cannot trigger or observe runs in
  `pavithran299/Couples` from this environment. The workflow is committed and
  locally validated; the green verdict must come from a real run at the pushed
  SHA. If the repository is private without Actions minutes, the run will not
  execute — enable Actions/billing in repo settings.
- Android APK/AAB: requires `eas login` on a signed-in machine.
  Next executable step: `npx eas login && npx eas build -p android --profile preview`.
  EAS secrets must be set first: `npx eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value <url>` (and the publishable key).

## Known defects

- None open from the Phase A contract audit. Historical note: the hosted
  `get_couple_stats` returned `letters/memories/revealed` keys before
  migration 0007; any clients built before that point would have shown zeros.

## Next highest-value work

1. Phase B premium UX pass (onboarding composition, home dashboard, tactile
   letter flow, Lumi interactions).
2. Phase C engagement: pocket surprises polish, weekly adventures, garden
   progression.
3. Phase D: adaptive icon/splash assets, permission audit, deep-link
   confirmation/reset handling.
4. Live hosted E2E auth run.
