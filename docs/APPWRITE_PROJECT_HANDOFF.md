# Couples Appwrite — verified project handoff (2026-11-01)

## Actual connected project (read-only verified)

- **Appwrite project name:** `couples`
- **Project ID:** `6ae6e1be00021a01c9ec`
- **Region:** Singapore (`sgp`)
- **API endpoint:** `https://sgp.cloud.appwrite.io/v1`
- **Organization:** Personal projects, Free (`tier-0`)
- **Appwrite project state:** `active`
- **Service census when checked:** 0 TablesDB databases; 0 authentication users; 0 Storage buckets; 0 Functions. This is **not** a provisioned backend yet.
- **Existing unrelated project:** `SonaMark Dev`. Never read, modify, restore, or delete its resources when working on Couples.
- **Android application ID:** `com.projecttwo.app` (verified in `app.json`).
- **Public non-secret CLI configuration:** repository-root `appwrite.config.json`, committed to `feature/appwrite-account-backend`.
- **Sensitive credentials:** None committed. Client project ID and regional URL are public identifiers, **not** administrative keys.

## Current execution blocker

The Appwrite connector authenticated to the console and verified the project, but the current chat's Appwrite operator exposes the read/discovery invocation and does **not** expose the separate write-execution action needed to create database resources or platforms. A write attempt was rejected before executing. Consequently, **no platform, database, schema, Function, account, or token has been created by ChatGPT**.

The owner created the empty Appwrite project directly in the browser. Avoid recreating it, and do not assume that the previous ZCode CLI login succeeded. Verify `appwrite whoami` interactively in ZCode's terminal before provisioning. The browser session and local CLI login are separate authentication states.

## ZCode continuation — in the existing workspace

1. Check out `feature/appwrite-account-backend` without replacing any local uncommitted work. Inspect `docs/APPWRITE_BACKEND_MIGRATION.md` and existing `services/BackendAdapter.ts`, `domain/types.ts`, `services/SupabaseRepository.ts` and ordered migrations. Do not touch the frozen `completion/consumer-release` branch / PR #1 / demo APK.
2. Verify current CLI version (`appwrite -v`) and `appwrite whoami`. If signed out or rejected, use `appwrite login` in an interactive terminal with owner's secure login. Do not type or paste passwords, cookies, access tokens or API keys into chat. Never run `appwrite init project` to create a **third** project; link to the existing project ID above and inspect the committed config.
3. `appwrite projects get --project-id "6ae6e1be00021a01c9ec"` as a read-only identity check. Confirm endpoint and region match the Appwrite console. Inspect any existing resource state before adding anything.
4. Register an Android platform for `com.projecttwo.app`. Create one Free/shared `couples_main` TablesDB database and review schema and unique constraints before mutations. Table-level permissions must be **default deny** for private couple rows. The application must not directly query entire protected tables.
5. Security-sensitive operations (pairing, unique response insert, mutual reveal, partner-only adventure parts, data export/delete) must be in trusted server-side Appwrite Functions with **verified caller identity**, constrained authority, atomic transaction/uniqueness checks and negative-authorization tests. Do not copy the PostgreSQL RLS/SECURITY DEFINER rules and assume Appwrite enforces them.
6. React Native integration: follow official Appwrite Expo guide using compatible `react-native-appwrite`, `expo-file-system` and existing polyfills. Keep UI intact and `BackendAdapter` contract stable. Configure the new Appwrite mode explicitly, never fall back silently to local demo for real customer accounts. The current demonstration APK must remain unchanged.
7. Prefer Appwrite's native six-digit **email verification and recovery codes**, supported on React Native in October 2026; verify the precise SDK methods against the installed SDK version. Enforce verified-email requirements in backend authorization, not only a UI flag. Do not send real email to arbitrary third parties.
8. Prove all data writes are remote and survive restart and a second device session. Only minimum secure session data, theme and accessibility preferences may remain on device. Avoid storing letters, memories or adventure text in AsyncStorage/SQLite; don't claim a phone stores literally zero bytes.
9. Independently test accounts A and B plus unauthorized account C: pairing expiration/replay, no third-member access, sealed-answer privacy **before** both submit, immutable original answers, concurrent final submissions, no cross-couple reads, separate adventure drafts, reset/verification, account delete/export and server privacy. Test API/SDK bypass attempts, not just screens.
10. Keep work on `feature/appwrite-account-backend` and draft PR #2; require passing CI and hosted acceptance before any merge. A new Appwrite-enabled Android APK is required; the existing demo-only APK is not production backend proof. No paid upgrades authorized.

## References

- Official Appwrite CLI installation and project config: https://appwrite.io/docs/tooling/command-line/installation
- Official Expo/React Native quick-start: https://appwrite.io/docs/quick-starts/react-native
- TablesDB permissions: https://appwrite.io/docs/products/databases/tablesdb/permissions
- TablesDB atomic transactions: https://appwrite.io/docs/products/databases/tablesdb/transactions
- Server-side execution identity: https://appwrite.io/docs/products/functions/develop
- Email code update (October 22, 2026): https://appwrite.io/changelog/entry/2026-10-22

**Readiness:** New Appwrite project verified, configuration linked; provisioning and production acceptance are **NOT DONE**.
