# Security acceptance — Couples (Project Two)

Status: LOCAL acceptance complete at branch HEAD. Hosted acceptance blocked
(see `EXTERNAL_BLOCKERS.md`). All evidence below is reproducible from the
repository at the recorded commit.

## Answer finality (P0) — append-only, DB-enforced

- **Contract:** one final answer per partner per letter; body/author/letter/
  timestamps immutable through the client; reveal only when both submitted;
  third parties and anonymous clients get nothing; races and replays cannot
  overwrite.
- **Enforcement layers:**
  1. `unique (letter_id, author_id)` (0001) — duplicate submission is SQLSTATE 23505.
  2. INSERT policy requires `author_id = auth.uid()` + couple membership (0003).
  3. SELECT policy gates partner rows behind `private.both_partners_answered` + couple membership (0003).
  4. Migration 0011: `responses_update` policy dropped; UPDATE/DELETE revoked from authenticated (privilege level, not just policy).
  5. `private.stamp_response_reveal()` — SECURITY DEFINER AFTER INSERT trigger stamps `revealed_at` for the pair: private schema (not Data-API exposed), EXECUTE revoked from public/anon/authenticated, restricted `search_path = ''` with fully qualified references, validates letter existence + couple membership, touches only `revealed_at` while null, xact-scoped advisory lock serializes the concurrent-first-insert race, atomic with the inserting transaction. No client clock or client-provided value.
- **Adversarial evidence:** 55/55 checks in `scripts/migrate-and-test.mjs`
  (real Postgres via PGlite, roles anon/authenticated with JWT claims,
  replayed from empty DB through all 11 migrations). Includes: stored-body
  equality after rejected resubmission; privilege-level UPDATE /
  revealed_at / DELETE denials; explicit `has_table_privilege` grant
  surface (select+insert only); post-reveal immutability; third-account
  view/join/alter denial; spoofed author_id rejection; trigger function
  not client-callable; anon insert denial; concurrent-submission stamping
  (identical server-side timestamps on both rows); legacy backfill
  idempotence (completed pairs stamped, solo answers untouched).

## Authorization matrix (all tables)

profiles, couples, invitations, daily_letters, responses, reactions,
pet_states, memories, milestones, mood_check_ins, pocket_notes,
weekly_adventures — every table has RLS enabled (asserted in the suite's
post-migration sanity block) and the suite exercises the horizontal
escalation paths: direct couples/invitations inserts denied, own
couple_id change denied, cross-profile edits denied, pocket-note spoofing
denied, adventures RPC-only with forged side/entry/metadata denied,
cross-couple completion denied, anon reads permission-denied.

## Auth session handling

- Sessions persist via AsyncStorage (`persistSession`, `autoRefreshToken`,
  `detectSessionInUrl: false` — correct for React Native).
- `onAuthStateChange` subscription: SIGNED_OUT clears the UI session
  (sign-out on another device / token revocation); SIGNED_IN /
  TOKEN_REFRESHED / USER_UPDATED refresh provider state.
- Recovery deep links parsed by `services/recoveryLink.ts` (11 regression
  checks): fragment (implicit) and query token forms, error parameters,
  malformed encoding (no throw), foreign URLs rejected, incomplete sets
  keep waiting, consumed links left to server rejection. Link contents are
  never logged. The reset screen replaces the indefinite "opening" state
  with a 6-second fallback and never treats a present link as absent.

## Secrets and exposure

- Only publishable/anon configuration reaches the client; no
  service-role/secret material in the repository (CI secret scans + local
  scans: no `.env`, no `eyJ…` key material, no hardcoded key assignments).
- `private` schema is not Data-API exposed; user-facing RPCs grant EXECUTE
  to authenticated only; the privileged stamping function grants none.
- Dependency audit (`npm audit --package-lock-only`): non-breaking fixes
  applied to the lockfile (17 → 8 findings; critical `shell-quote` and
  high `ws`/`@xmldom/xmldom`/`picomatch` resolved). The remaining 8
  (3 moderate, 5 high) sit in the Expo SDK 57 toolchain (e.g. `@expo/cli`,
  `node-forge` via code-signing, `zod` in CLI validation) and have no
  runtime attack surface in the shipped app; npm's suggested "fix" is a
  major Expo downgrade (57 → 44), which is not viable. Recorded as
  accepted toolchain risk, to be revisited at the next SDK upgrade.

## Known limitations (not vulnerabilities, stated to keep privacy claims honest)

- Letters/answers are server-side protected by RLS; there is **no
  end-to-end encryption** — Supabase (and the project owner) can
  technically read content. No UI copy claims otherwise.
- Photo keepsakes are not yet uploaded (no Supabase Storage usage yet);
  bucket privacy review is pending until that feature exists.
- Auth rate-limiting/abuse posture is Supabase-project-level; not
  verifiable from this environment.

## Not yet executed (blocked, not skipped)

- Supabase security advisors against the hosted project.
- Hosted migration 0011 application + post-apply policy/grant/trigger
  verification with isolated test users.
- Real email confirmation + recovery link journey.
