# Acceptance report — 17 October 2026

Every claim below reflects a command actually executed in this session.
Anything not executed is listed under "Not run" with the reason.

## Executed and passing

| Check | Command | Result |
|---|---|---|
| TypeScript strict | `npm run typecheck` | exit 0, no errors |
| Expo Web production export | `npm run build:web` | exit 0, `dist/` produced (entry JS ~2.3 MB) |
| Reveal-privacy unit test (demo path) | `npx tsx backend_src/tests/reveal_privacy_demo.test.ts` | PASS across all three phases: partner answer unreadable before I write, after only I write; readable once both write |

## Fixed this session (with evidence)

1. **Pairing is now server-generated.** The client previously invented
   invitation codes and inserted them directly. `SupabaseRepository`
   now calls the `create_my_invitation` server function only; the client
   no longer contains any code-generation logic (the helper was deleted —
   `grep generateCode services/` returns nothing).
2. **Letter history no longer queries a nonexistent column.** The adapter
   selected `both_replied`, which the schema does not define; it now reads
   `responses(author_id)` through the relationship and derives completion.
3. **Password reset reachable from the UI.** The adapter had
   `requestPasswordReset` but no screen path; onboarding now has a
   "Forgot your password?" flow with a neutral confirmation message.
4. **Profile RLS no longer recursive.** The old policy read `profiles`
   inside its own predicate; `my_couple_id()` (security definer) resolves
   membership without self-referencing the table.
5. **No anonymous backend calls.** `REVOKE EXECUTE ... FROM public, anon`
   added for all ten security-definer functions; only `authenticated` can
   call them.
6. **Profile inserts cannot self-assign a couple.** INSERT now requires
   `couple_id is null`; UPDATE pins `couple_id` to the caller's own.
7. **Env key naming aligned with Supabase's current convention.** The
   client accepts `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with
   `EXPO_PUBLIC_SUPABASE_ANON_KEY` as fallback. No service-role key exists
   anywhere in the app bundle path.

## Not run (honest gaps)

| Check | Why |
|---|---|
| Live Supabase migration + RLS negative tests (3-account adversarial) | This workspace's Supabase project has no database provisioned (the management API reports zero tables and blocks creation). `backend_src/0001_initial_schema.sql` ships ready to run; `backend_src/tests/0002_reveal_privacy_test.sql` is the adversarial check to run against it. |
| Real two-account pairing E2E | Requires the provisioned backend above. The demo path covers the same state machine locally. |
| Android APK/AAB build | No signing key or EAS credentials in this environment; `eas.json` preview/production profiles are committed for the next stage. |
| Device QA (360–430dp, keyboard, reduced motion) | No device/emulator here. Screens use safe-area padding, keyboard-avoiding views, and a reduced-motion switch, but that is code review, not device evidence. |
| `expo lint`, `expo-doctor`, secret scan tooling | Not run in this session; `npm run lint` is available. |

## Gate status for handoff

- Code compiles and web demo builds: **green**.
- Reveal privacy: **proven on the demo path; server-side proof pending a
  provisioned database** (SQL test ready).
- Production auth/pairing E2E: **pending backend provisioning** — code
  complete, unverified against a live instance.
- Play release artifacts: **not started** (by design; Phase G).
