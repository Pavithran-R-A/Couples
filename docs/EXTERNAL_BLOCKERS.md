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

## 2. Hosted Supabase project access — **DEFERRED by the owner (2026-10-27)**

- **Owner decision:** all Supabase work is deferred to a separate future
  mission. This cycle must not attempt login, migrations, project creation,
  hosted auth/SMTP/redirect changes or production-record operations.
- **State when deferred:** no `.env`, no valid Supabase session (stored CLI
  token returned "Invalid access token"); the interactive
  `npx supabase login` browser flow cannot run headless.
- **Implementation preserved:** every Supabase-related source file and all
  11 migrations remain unchanged in the repository, ready for the future
  completion mission.

## 3. EAS project linkage and credentials

- **Observed (2026-10-27):** `npx eas-cli whoami` → "Not logged in";
  `extra.eas.projectId` in `app.json` is still the all-zeros placeholder.
- **Authentication is device-code based and ready:** a login daemon is
  running that continuously presents fresh device codes (written to the
  workspace file `.qa/eas-login-code.txt`). The owner approves the current
  code at **https://expo.dev/oauth/device** (logged in as the correct Expo
  account) and the login completes automatically — no credentials ever pass
  through the agent. Codes expire after a few minutes and are replaced
  automatically for up to ~2 hours per daemon run.
- **After login, the prepared sequence is:** `eas init` (or `eas project:list`
  to find an existing Couples project first) → replace the placeholder
  `projectId` → `eas env:create` for the preview environment (including
  `EXPO_PUBLIC_FORCE_DEMO=1`) →
  `npx eas build -p android --profile preview` (cloud runners; no local
  disk impact; CNG means native config is regenerated from `app.json`).
- **Consequences while blocked:** no EAS build and **no installable APK**
  exists. The Android evidence is the Expo Go runtime session
  (`ANDROID_DEVICE_QA.md`). A local gradle attempt was aborted at 103 MB
  free disk and produced no artifact.

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
