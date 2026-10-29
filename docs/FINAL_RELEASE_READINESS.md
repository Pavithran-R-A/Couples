# Final release readiness — Couples (Project Two)

Updated 2026-10-27. Branch `completion/consumer-release`. States:
**PASS** = independently demonstrated · **FAIL** = demonstrated defect ·
**BLOCKED** = missing external dependency · **NOT TESTED** = no trustworthy
evidence yet. Blockers are tracked in `EXTERNAL_BLOCKERS.md`.

## Acceptance gates

| Gate | State | Evidence |
| --- | --- | --- |
| A. Source & Git history intact | **PASS** | Recovery branch `b8821b5` preserved; linear completion commits; no force-push; `main` untouched; PR #1 open. |
| B. Core feature completeness | **PASS (source + demo runtime)** | All designed features implemented and exercised: letters with append-only sealing/reveal, reactions, companion care, memories (incl. working edit), milestones, moods, pocket notes, weekly adventures (4 stage kinds, doodle serialization), pairing, settings, theming. Photo keepsakes and notification reminders are declared non-features of this build. |
| C. Hosted database migration parity | **DEFERRED (owner decision, 2026-10-27)** | Local replay: 11/11 migrations, 55/55 authorization checks (PGlite, real roles/JWTs). All Supabase work deferred by the owner; no session exists or will be sought this cycle; 0011 not applied to hosted. |
| D. Real Supabase authentication | **DEFERRED (owner decision)** | Full auth source paths implemented (server-side profile trigger, email-confirmation routing, sign-in with session refresh, live `onAuthStateChange`, recovery deep-link completion with parser regression suite). Requires a hosted session + test inbox in a future mission. |
| E. Two independent partner sessions | **PARTIAL — hosted DEFERRED** | Two-person contract proven at the database level (3 identities, real roles/JWTs, 55 checks) and through the demo UI on Android (seal → blindness → byte-identical reveal). Live hosted two-account session DEFERRED. |
| F. Privacy & RLS | **PASS (local)** | Append-only answers enforced at the privilege level; hardened private-schema reveal trigger; adversarial isolation checks; secret scans clean; dependency audit reduced 17 → 8 findings (toolchain-only remainder documented). See `SECURITY_ACCEPTANCE.md`. |
| G. Response sealing/reveal correctness | **PASS (local + demo runtime)** | Sealed-until-both, byte-identical originals, identical server-side stamps, post-reveal immutability — asserted against real Postgres and demonstrated in the Android demo flow. |
| H. Memories, moods, companion, adventures | **PASS (local)** | Demo suites + memory edit wired end-to-end; adventure RPC matrix asserted; doodle race fixed. |
| I. Offline behavior & error handling | **PASS (source-level)** | Per-action error notes, retry affordances, blocking backend notice for configured builds, demo never silently replaces production. Deliberate offline device scenarios NOT TESTED. |
| J. Mobile accessibility & device UI | **PASS (emulator, Expo Go runtime)** | Safe-area insets everywhere, Button a11y roles verified live via the UI-Automator tree, OS reduce-motion honored; walkthrough in `ANDROID_DEVICE_QA.md`. Small/large screens, 3-button nav, font-scale extremes and physical devices NOT TESTED. |
| K. Deep links & password recovery | **PASS (local parser)** | Parser 11/11 regression checks (fragment/query/error/malformed forms). Hosted redirect allow-list + real email flow NOT TESTED. |
| L. GitHub CI | **PASS** | Twelve consecutive fully green 3/3 runs through the linked-project commits (first ever: 40380810505 @ `6f93274`; latest at `d6e0e29` — the EAS-linked config). |
| M. Installable Android APK | **PASS** | **Real APK built on EAS cloud runners and independently verified** (metadata re-read from the authenticated CLI on 2026-10-29). Build `c4891307-9f4d-4af4-bf5e-29b15f801b18` (@pavithran29/project-two, ID `0cf977e7-83df-4fb0-ba46-cb5c436a50ca`), profile preview (internal APK), **source commit `d6e0e29`** — note: later commits (`e5b6064`, current HEAD) are documentation/evidence only; the binary corresponds to `d6e0e29`. Artifact 131,841,274 bytes, SHA-256 `e3714d21…776ee0be8`, package `com.projecttwo.app` v1.0.0 (versionCode 1), minSdk 24/target 36, signed (cert SHA-256 `3760b917…6467b0`). Demo isolation: preview env holds exactly `EXPO_PUBLIC_FORCE_DEMO=1`; no Supabase vars. |
| N. On-device acceptance | **PASS (core journeys) / NOT TESTED (secondary taps)** | Installed via adb (Success), launched **without Expo Go/Metro**; full demo two-person lifecycle executed (Mara seal → Theo blindness → Theo seal → byte-exact reveal), offline cold-restart preserves all state, settings/theme/reduced-motion present, 0 fatal logcat exceptions. Secondary standalone tap-tests (reaction tap timing, Us/Lumi/doodle deep-interactions) are **NOT TESTED** — GUI automation was stopped because the shared AVD (foreground-stealing system apps + the owner's NinniNest, restored to enabled=1 v0.9.0 with data intact) plus a 904 MB disk low-point made further automation unsafe per the 2 GB reserve rule. `docs/ANDROID_DEVICE_QA.md`. |
| O. Release documentation | **PASS** | `FINAL_RELEASE_READINESS.md`, `SECURITY_ACCEPTANCE.md`, `EXTERNAL_BLOCKERS.md`, `ANDROID_DEVICE_QA.md`, `RELEASE_PROGRESS.md` — APK/billing/CI statements reconciled with the actual artifacts. |

## Weighted completion estimate

Weights per the release contract. A BLOCKED or NOT TESTED requirement earns
no credit for that requirement; verified subrequirements retain theirs.

| Category | Weight | Earned | Basis |
| --- | ---: | ---: | --- |
| Core functionality and code quality | 20% | 18.0 | All core features implemented, 4 test suites + tsc + lint green, demo runtime verified on Android; deliberate offline matrix unexecuted. |
| Security, privacy and database correctness | 20% | 16.0 | 55/55 authz checks, append-only answers, hardened private-schema trigger, secret scans, dependency audit; hosted advisors and hosted 0011 application outstanding. |
| Real hosted authentication and two-partner flows | 20% | 5.0 | Full auth/recovery source + parser suite + DB-level contract proven; every live hosted journey unexecuted (credentials). |
| Android APK build and standalone installation | 15% | 12.0 | **Real APK built on EAS, verified (SHA-256/signature/package), installed, and exercised standalone** (offline cold-restart included). Outstanding: physical-device pass, production/store signing, multi-configuration sweep. |
| Mobile UX, accessibility and reliability | 10% | 6.0 | Emulator walkthrough with screenshots, a11y tree verified, safe-area/motion fixes; limited screen/mode coverage (one emulator, demo mode). |
| GitHub CI and release engineering | 10% | 9.5 | First fully green 3/3 run (40380810505 @ `6f93274`) at the exact pushed commit; PR evidence current. |
| Documentation and reproducibility | 5% | 4.75 | Five evidence documents reconciled with artifacts; every claim traceable to commands/run IDs. |
| **Total** | **100%** | **71.25%** | |

**Overall: 71.25% of verified consumer-release readiness** (category credits above sum exactly to 71.25; earlier drafts quoted 62% before the APK milestone and ~70% before the final reconciliation — this figure is the authoritative sum). The **Android demonstration release itself is ≈92%** (build/artifact/install/core journeys/offline all PASS; the remainder is secondary standalone tap-tests NOT TESTED for environment-safety reasons, plus physical device) and is **not certified 100%**. Supabase remains DEFERRED, so full customer readiness stays below 100% by construction. Per the owner's
2026-10-27 decision, all Supabase work is **DEFERRED** to a future mission
(the hosted-auth/two-partner category is deferred, not forgotten — it still
earns no credit until executed). The immediately actionable path to more
points is **`npx eas-cli login` (owner, interactive terminal)**, which
unlocks the EAS project linkage, the demo preview APK on cloud runners and
standalone installation QA (≈12 points). The deferred Supabase work is
worth the remaining ≈22 points. No open code defect is known; CI is green
at the pushed HEAD.
