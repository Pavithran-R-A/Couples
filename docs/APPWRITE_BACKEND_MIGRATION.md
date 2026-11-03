# Couples — Appwrite account-first backend migration

**Status: DESIGN/PREFLIGHT ONLY — Appwrite project, database, functions, integrations and tests are NOT provisioned or verified.**
**Branch:** `feature/appwrite-account-backend`. The frozen demo at `completion/consumer-release` and its EAS APK must remain unchanged.

## Decision and constraints

- Replace the *real customer backend* with a new dedicated Appwrite Cloud project. Never reuse the existing unrelated Appwrite project or another application's credentials, senders, storage, or data.
- Users must create a real account. All **user-generated persistent content** (profiles, couple membership, letters, answers, reactions, memories, moods, adventures, companion state, attachments) lives in Appwrite, not in DemoRepository, AsyncStorage or device-only SQLite.
- Authentication requires some protected device-side session state for remembered login; theme and reduced-motion preferences can remain on-device. Don't claim the phone stores literally zero bytes. Avoid caching user-generated content, log redaction applies, and remove temporary uploaded attachment files once practical.
- Backend unavailable/offline: fail closed and show an error/retry. Do **not** silently enter demo mode or acknowledge writes locally. DemoRepository remains only behind the explicit fictional preview flag in noncustomer builds.
- Preserve existing UI/art, Expo Router, domain contracts and migrations as historical reference. No automated Supabase writes, data export or migration without a separately approved plan. Keep the final Android demo APK intact.
- Free plan only; no purchases. Appwrite Free currently permits up to two projects, one serverless database, one bucket and two functions per project. Free projects may pause after one week of inactivity; this is a customer-availability risk, **not launch-certified**.

## Provisioning gate

1. Under the connected personal Free organization, provision a separate Singapore-region project named **Couples — Private Backend**, suggested project ID `couples-private`, **only if no Couples project already exists**. Verify actual ID and endpoint in the console.
2. Register Android platform `com.projecttwo.app`. Add other platforms only if built and tested.
3. Create exactly one shared/serverless **TablesDB** database `couples_main`; don't select any paid dedicated specification.
4. Start with default-DENY table permissions. Use row security where client access is absolutely needed. No table-wide `any`, `users` or `guests` read permissions on private couple data. Prefer trusted Functions as the *only* data access path to sensitive rows, enforcing auth and couple membership server-side.
5. Create one private Storage bucket for memory photos only if needed; ensure per-file membership access and no public download links. Upload durable file objects to Appwrite rather than persisting device `file://` paths.
6. Verify Auth email/password settings, email verification delivery, recovery redirect and session policies. Don't skip verification to make tests pass.
7. Appwrite secrets/API keys may be used only in server-side Functions' secure configuration. **Never** put them in `EXPO_PUBLIC_*`, a mobile bundle, Git, CI logs, screenshots or chat.

## Authoritative existing application contract

The `services/BackendAdapter.ts` interface defines auth, profile/pairing, daily letter, append-only sealed responses and mutual reveal, reactions, Lumi care, memories, milestones, moods, pocket notes, stats, export/delete, and weekly adventures. The `SupabaseRepository.ts` currently delegates security-sensitive workflows to database RPCs. A new `AppwriteRepository` must preserve the interface and semantics, not naively replace SQL calls with unrestricted client database writes.

Proposed TablesDB tables (names provisional; derive exact columns, types, indexes and constraints from `domain/types.ts` and ordered Supabase migrations before creation):
- `profiles` (auth user ID, display name, couple ID, timestamps)
- `couples` (two immutable member IDs, pairing state, anniversary)
- `invitations` (hashed single-use code, creator, couple, expiry, consumption state; no plaintext code readable by other users)
- `question_bank`, `daily_letters` (unique couple/day)
- `responses` (unique letter/author; immutable body; reveal timestamp; private before mutual submission)
- `reactions` (response/author/kind and uniqueness)
- `pet_states` (one per couple; bounded care changes)
- `memories`, `milestones`, `mood_check_ins`, `pocket_notes`
- `weekly_adventures`, `adventure_parts` (separate per-partner sealed entries; unique adventure/author)
- `idempotency_requests` or equivalent server-side operation guard for retries and duplicate taps.

Create only schema required by the reviewed adapter, with appropriate indexes. Never seed production with fictional Mara/Theo records or test accounts.

## Security-critical service boundary

Appwrite row permissions differ from PostgreSQL RLS and are not a drop-in replacement for functions/triggers.

- Implement pairing, join/invite/unlink, daily-letter generation, sealed-answer submission, reveal, adventure part submission, companion care, account export/delete and member authorization in trusted server-side code (Appwrite Functions). Free is limited to two Functions; consolidate carefully into a small authenticated `couples-api` with explicit action routing and, if truly needed, a second lifecycle worker.
- Authenticate every request using *verified Appwrite session/JWT context*, not a userId/coupleId supplied by the caller. For any request and linked row, verify that the caller currently belongs to precisely that couple.
- **Do not give either partner read access to the other's sealed response before both have answered.** Server-side read filtering and dynamic row permissions must be proven adversarially. Similarly, adventure drafts are partner-private until the completion/reveal rule.
- Use a unique index + an atomic server-side transaction to enforce first-write-wins, exactly-once response creation and safe concurrent second-answer reveal. Deny client UPDATE and DELETE on sealed answer rows at all times, even from their author. Never trust client clocks or client-computed reveal flags.
- Pair membership maximum two; expired/replayed invites rejected; unlinks/deletes can't leave unauthorized access. Carefully define retention behavior when one partner deletes their account.
- Keep all private tables default-DENY for ordinary SDK direct access unless per-row permissions are deliberately implemented and tested. Privileged server-side calls use minimally scoped secret credentials.
- If image storage exists, test that a third user cannot download either partner's private photos, including guessed IDs.
- Email/notification sender configuration is Appwrite-project-specific, never reused from other projects.

## Mobile integration

- Add `react-native-appwrite` using Expo-compatible versions and run `expo doctor` / compatibility checks; register the Android package.
- Introduce `EXPO_PUBLIC_BACKEND=appwrite`, `EXPO_PUBLIC_APPWRITE_ENDPOINT`, `EXPO_PUBLIC_APPWRITE_PROJECT_ID` (identifiers are not secrets). Production must require complete configuration, never fall back to demo or Supabase. An explicit preview-only `EXPO_PUBLIC_FORCE_DEMO=1` remains available in existing demo build profile.
- Implement Appwrite-backed `BackendAdapter` for all methods, including verification, recovery and session rehydration. Keep actual content server-owned. Cache only authentication state and small UI preferences necessary for operation; don't locally queue private data as a silent substitute for failed network writes.
- Securely implement registration and verification so an unverified account cannot access pair content if the requirement demands verified email. Manage reset and verification deep links with the existing custom `projecttwo://` scheme and tested allowlist.
- Preserve the original designs. Make backend connectivity/verification/pairing errors truthful and recoverable.
- Build a **new production-backend APK** after passing tests; the current EAS APK is demo-only and MUST NOT be called Appwrite-enabled.

## Acceptance gates (two independent disposable real accounts + third unauthorized account)

1. Fresh install → signup → server Auth user created → verification email → verified login → profile row exists remotely. Repeat on two real devices/sessions. Password reset, logout and restore tested.
2. Pair account A/B with one invitation; verify expiry/replay/third-user rejection and 2-member cap.
3. A sends answer; B cannot read A's body via normal app, direct TablesDB SDK/REST, or crafted Function requests. Concurrent submissions; first-write-wins, no overwrite, no premature reveal. On B's answer, both originals become visible and stay immutable after restart.
4. Account C cannot list/read/update/delete another couple's rows, files, reactions, moods, notes or adventure drafts. Verify both private API and direct-resource permission boundaries. Verify old members lose access after unlink/delete.
5. Reactions, memories (create/edit/delete), mood, notes, companion and all 4 adventures round-trip on Appwrite and survive app reinstall/restart on a different device. Upload/retrieve photo privately if feature is available.
6. Offline/reconnect: show explicit unavailable state, never falsely confirm server writes; no unwanted local persistent content. Define minimal session cookie/token storage honestly.
7. Export and account deletion verified server-side on disposable identities. Inspect residual rows, storage, permissions and sessions.
8. Security review of Function invocation rules, action authorization, secrets, indexes/transactions, rate limiting and email/recovery redirects. No accidental public table permissions.
9. Test exact SHA: TypeScript, lint, all existing demo and migration suites, new Appwrite contract + adversarial integration tests, GitHub CI. Real Android production-backend APK signed, installed and tested; demo APK unaffected.
10. Record project ID, region, database/table/function IDs, schema, test counts, run IDs, EAS build ID, binaries, backend outage behavior, and blockers. Never mark customer READY without hosted passing results.

## Operational notes

- Before provisioning, verify whether the connected Appwrite account still has one free project slot; an unrelated paused project should **not** be deleted or reused.
- Appwrite Free projects can pause after inactivity (official pricing: one week). Plan for this operational risk and verify actual service availability before customer launch.
- New backend is empty by default. Historical Supabase contents are not copied without an explicit audited migration and owner approval.
- Retain `completion/consumer-release` and PR #1 untouched. Work on this feature branch and create a separate draft PR for review; do not merge or publish without permission.
