# External blockers register

Each blocker is recorded with its exact nature and what would unblock it.
Status is current as of 2026-10-27 (commit `6f93274`). Nothing here is a code
defect unless explicitly stated.

## 1. ~~GitHub Actions billing restriction~~ — RESOLVED by the owner

- **History:** every run before 2026-10-26 failed with zero jobs (a workflow
  YAML defect, fixed in `b9d3d2f`), and once jobs were created they failed
  before executing any step with GitHub's payment/spending-limit annotation.
- **Current:** the owner resolved the billing restriction; runners execute.
  Run **40380810505** at `6f93274` is the repository's first fully green run:
  `verify` ✅ · `SQL migration + authorization on real Postgres` ✅ ·
  `config-checks` ✅ (including `expo-doctor` 21/21 after the CNG workflow
  adoption in `e9ab64f`).

## 2. Hosted Supabase project access

- **Observed:** no `.env` and no Supabase access token exists in this
  environment; the `supabase` CLI is installed but unauthenticated.
- **Consequences (all recorded, not attempted):** hosted project identity
  cannot be proven from here; migration 0011 is not applied to the hosted
  database; Supabase security advisors not run; hosted auth E2E (signup,
  email confirmation, login, recovery email) unexecuted; hosted two-partner
  journeys unexecuted.
- **Unblock:** an authorized session for the Couples Supabase project
  (access token or project-linked login) plus an isolated test account and
  inbox access.

## 3. EAS project linkage and credentials

- **Observed:** `extra.eas.projectId` in `app.json` is the all-zeros
  placeholder; no EAS session exists on this machine.
- **Consequences:** no EAS cloud build has been produced; **no installable
  APK exists**. The Android evidence in this release cycle is an Expo Go
  runtime session on an emulator (`ANDROID_DEVICE_QA.md`) — JavaScript and
  app logic identical to the shipped app, native shell is Expo Go's.
- **Also:** a local `gradlew assembleDebug` attempt (from the then-committed
  prebuild tree) was **aborted at 103 MB free disk** and produced no
  artifact; `android/` is no longer tracked (CNG — `e9ab64f`), so EAS will
  regenerate native config from `app.json` at build time.
- **Unblock:** owner runs `eas login` + `eas init` and confirms the correct
  (Couples) EAS project; `app.json` then gets the real project ID; a preview
  APK can be built on EAS cloud runners without touching local disk.

## 4. ~~Hosted App Links domain ownership~~ — RESOLVED by removal (2026-10-27)

- **Verified:** `projecttwo.app` **does not exist** (DNS NXDOMAIN; both
  `https://projecttwo.app` and `/.well-known/assetlinks.json` fail to
  resolve). The domain is not registered or operated by the owner.
- **Action taken:** the `autoVerify` HTTPS App Links declaration
  (`https://projecttwo.app` intent filter) was **removed** from `app.json`
  rather than shipped misleadingly. The custom scheme **`projecttwo://`** is
  preserved and is the password-recovery deep-link path
  (`projecttwo://reset-password`). If the owner later registers and controls
  the domain, the App Links filter can be reinstated together with a
  `/.well-known/assetlinks.json` carrying the real signing fingerprint.

## 5. Local disk headroom

- **Observed:** C: dropped to 103 MB during the gradle attempt and sits
  around 1.9-2 GB free; the Pixel_10 AVD image alone is 7.5 GB.
- **Consequences:** heavyweight local native builds and long emulator
  sessions are unsafe until more headroom exists; device QA currently relies
  on Expo Go + Metro (light on disk).
- **Unblock:** owner frees space (or approves cleaning the AVD image /
  gradle caches). Never attempted without approval.
