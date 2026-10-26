# External blockers register

Each blocker is recorded once, with its exact nature and what would unblock
it. Nothing here is a code defect; all local equivalents of the blocked work
pass (see `FINAL_RELEASE_READINESS.md`).

## 1. GitHub Actions billing restriction

- **Observed:** runs create all three jobs (verify / migration /
  config-checks — the workflow YAML defect from `b9d3d2f` is fixed), then
  every job fails in 1–4s having executed zero steps, with GitHub's
  annotation: "The job was not started because recent account payments have
  failed or your spending limit needs to be increased."
- **Runs:** 40361520101 (a3f5122), 40355077838 (3827c42) — same signature.
- **Scope:** account-level; other private repos of this account show the
  identical instant-failure pattern.
- **Not attempted:** rerunning jobs in a loop, disabling checks, making the
  repo public, changing billing. All explicitly out of scope.
- **Unblock:** repository owner resolves Settings → Billing & plans (failed
  payment or spending limit), then reruns the PR checks once.
- **Local equivalent:** every CI step passes locally at the pushed SHA
  (commands and exit codes in `FINAL_RELEASE_READINESS.md`).

## 2. Hosted Supabase project access

- **Observed:** no `.env` and no Supabase access token exists in this
  environment; `npx supabase` CLI is installed but unauthenticated.
- **Consequences (all recorded, not attempted):** hosted project identity
  cannot be proven from here; migration 0011 is not applied to the hosted
  database; Supabase security advisors not run; hosted auth E2E (signup,
  email confirmation, login, recovery email) unexecuted.
- **Unblock:** an authorized session for the Couples Supabase project
  (access token or project-linked login) plus an isolated test account and
  inbox access.

## 3. EAS project linkage and credentials

- **Observed:** `extra.eas.projectId` in `app.json` is the all-zeros
  placeholder; no EAS session exists on this machine.
- **Consequences:** EAS cloud builds cannot run from here; the APK evidence
  in this release cycle comes from a **local** `gradlew assembleDebug` build
  (see `ANDROID_DEVICE_QA.md`) instead of an EAS artifact.
- **Unblock:** owner runs `eas login` + `eas init` and confirms the correct
  (Couples) EAS project; `app.json` then gets the real project ID.

## 4. Hosted App Links domain ownership

- **Observed:** `app.json` declares an `https://projecttwo.app` App Links
  intent filter with autoVerify. Domain ownership (assetlinks.json) cannot
  be proven from this environment.
- **Position:** the custom scheme `projecttwo://` is the primary deep-link
  path (password recovery uses it); the HTTPS App Link must be treated as
  unverified until the domain association is proven.
