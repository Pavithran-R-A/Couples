# Final release readiness — Couples (Project Two)

Branch `completion/consumer-release`, evidence recorded per commit. States:
**PASS** = independently demonstrated · **FAIL** = demonstrated defect ·
**BLOCKED** = missing external dependency · **NOT TESTED** = no trustworthy
evidence yet. Blocked items are tracked in `EXTERNAL_BLOCKERS.md`.

| Gate | State | Evidence |
| --- | --- | --- |
| A. Source & Git history intact | **PASS** | Recovery branch `b8821b5` preserved; linear completion commits on top; no force-push; `main` untouched; PR #1 open and mergeable. |
| B. Core feature completeness | **PASS (source+demo)** | All features implemented and exercised by the demo-world suites (letters with sealing/reveal, reactions, companion care, memories/milestones, moods, pocket notes, weekly adventures with 4 distinct stages, pairing, settings, theming). Photo keepsakes and notification reminders are documented non-features in this build. |
| C. Hosted database migration parity | **BLOCKED** | Local replay: 11/11 migrations clean, 55/55 authorization checks (PGlite). Hosted project identity/ownership unprovable here (no Supabase credentials); 0011 not yet applied to hosted. |
| D. Real Supabase authentication | **NOT TESTED** | Full auth source paths implemented (signup w/ server-side profile trigger, email-confirmation routing, sign-in with session refresh, live auth events, recovery deep-link completion). Requires hosted credentials + test inbox. |
| E. Two independent partner sessions | **PARTIAL — NOT TESTED on backend** | The authorization matrix proves the two-person contract at the database level (three identities, real roles/JWTs, 55 checks). A live two-account app session is NOT TESTED. |
| F. Privacy & RLS | **PASS (local)** | Append-only answers; privilege-level UPDATE/DELETE revocation; adversarial isolation checks; secrets scans clean. See `SECURITY_ACCEPTANCE.md`. |
| G. Response sealing/reveal correctness | **PASS (local)** | Sealed-until-both, byte-identical originals, server-side stamps, post-reveal immutability — asserted against real Postgres. |
| H. Memories, moods, companion, adventures | **PASS (local)** | Demo suites + memory edit wired end-to-end; adventure RPC matrix asserted; doodle serialization race fixed. |
| I. Offline behavior & error handling | **PASS (source-level)** | Per-action ErrorNote copy, retry affordances, blocking backend notice for configured builds, demo never silently replaces production. Full offline device scenarios NOT TESTED on hardware. |
| J. Mobile accessibility & device UI | **PASS (emulator, this cycle)** | Safe-area insets everywhere, Button a11y roles/state, OS reduce-motion honored; emulator walkthrough recorded in `ANDROID_DEVICE_QA.md`. Physical-device QA NOT TESTED. |
| K. Deep links & password recovery | **PASS (local parser)** | Parser: 11/11 regression checks (fragment/query/error/malformed forms). Hosted redirect allow-list + real email flow NOT TESTED. |
| L. GitHub CI | **BLOCKED** | Workflow healthy (3 jobs created — YAML fix proven). Jobs fail before any step on account billing. Local equivalents of every CI step pass. |
| M. Installable Android APK | **BLOCKED** | Local `gradlew assembleDebug` from the committed `android/` prebuild aborted at 103 MB free disk (gradle downloads + intermediates over a 7.5 GB AVD image); EAS cloud build blocked on credentials. Runtime QA ran via Expo Go 57 instead (see N). |
| N. On-device acceptance | **PASS (emulator, Expo Go runtime)** | Full demo two-person lifecycle executed and screenshotted: seal → pre-reveal blindness → reveal with byte-identical originals; cold-restart session restore; a11y tree verified; no fatal logcat errors (`docs/ANDROID_DEVICE_QA.md`). Physical-device and production-APK acceptance NOT TESTED. |
| O. Release documentation | **PASS** | This file, `SECURITY_ACCEPTANCE.md`, `EXTERNAL_BLOCKERS.md`, `ANDROID_DEVICE_QA.md`, `RELEASE_PROGRESS.md`. |

## Weighted completion estimate

Basis: the weights below reflect what a consumer release actually needs;
each gate's score is 100% only for independently demonstrated evidence.

- Implementation & code quality (B, F, G, H, I source work): 100% demonstrated locally → weighted ~35% of total: **full**.
- Database/backend correctness (C, F, G): local replay proven; hosted parity and advisors outstanding → weighted ~20%: **~70% earned**.
- Real authentication & two-person journeys (D, E, K-hosted): ~15%: **~25% earned** (parser + DB contract proven; live journeys not).
- CI (L): ~10%: **~60% earned** (pipeline healthy; verdict blocked on billing).
- Android artifact & device QA (M, N, J): ~20%: **~55% earned** (emulator runtime QA complete with real two-person flows; packaged APK and physical devices outstanding).

**Overall: ≈ 70% of verified consumer-release readiness.** The remaining
28% is dominated by owner-side external dependencies (GitHub billing, a
Supabase authorized session, EAS credentials); no open code defect is known
to block them.
