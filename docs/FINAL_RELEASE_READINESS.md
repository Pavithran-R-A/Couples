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
| C. Hosted database migration parity | **BLOCKED** | Local replay: 11/11 migrations, 55/55 authorization checks (PGlite, real roles/JWTs). No Supabase credentials exist in this environment; hosted project identity unproven; 0011 not applied to hosted. |
| D. Real Supabase authentication | **NOT TESTED (hosted)** | Full auth source paths implemented (server-side profile trigger, email-confirmation routing, sign-in with session refresh, live `onAuthStateChange`, recovery deep-link completion with parser regression suite). Requires hosted credentials + test inbox. |
| E. Two independent partner sessions | **PARTIAL — hosted NOT TESTED** | Two-person contract proven at the database level (3 identities, real roles/JWTs, 55 checks) and through the demo UI on Android (seal → blindness → byte-identical reveal). Live hosted two-account session NOT TESTED. |
| F. Privacy & RLS | **PASS (local)** | Append-only answers enforced at the privilege level; hardened private-schema reveal trigger; adversarial isolation checks; secret scans clean; dependency audit reduced 17 → 8 findings (toolchain-only remainder documented). See `SECURITY_ACCEPTANCE.md`. |
| G. Response sealing/reveal correctness | **PASS (local + demo runtime)** | Sealed-until-both, byte-identical originals, identical server-side stamps, post-reveal immutability — asserted against real Postgres and demonstrated in the Android demo flow. |
| H. Memories, moods, companion, adventures | **PASS (local)** | Demo suites + memory edit wired end-to-end; adventure RPC matrix asserted; doodle race fixed. |
| I. Offline behavior & error handling | **PASS (source-level)** | Per-action error notes, retry affordances, blocking backend notice for configured builds, demo never silently replaces production. Deliberate offline device scenarios NOT TESTED. |
| J. Mobile accessibility & device UI | **PASS (emulator, Expo Go runtime)** | Safe-area insets everywhere, Button a11y roles verified live via the UI-Automator tree, OS reduce-motion honored; walkthrough in `ANDROID_DEVICE_QA.md`. Small/large screens, 3-button nav, font-scale extremes and physical devices NOT TESTED. |
| K. Deep links & password recovery | **PASS (local parser)** | Parser 11/11 regression checks (fragment/query/error/malformed forms). Hosted redirect allow-list + real email flow NOT TESTED. |
| L. GitHub CI | **PASS** | Run **40380810505** at `6f93274` — the repository's first fully green run: `verify` ✅, `SQL migration + authorization on real Postgres` ✅, `config-checks` ✅ (expo-doctor 21/21 after CNG adoption `e9ab64f` + secrets-step quoting fix `6f93274`). |
| M. Installable Android APK | **BLOCKED** | **No APK exists.** Local gradle attempt aborted at 103 MB free disk (no artifact); EAS blocked on credentials/`eas init` (`extra.eas.projectId` still placeholder). CNG workflow adopted so EAS regenerates native config from `app.json`. |
| N. On-device acceptance | **PASS (emulator, Expo Go runtime — labeled)** | Full demo two-person lifecycle: seal → pre-reveal blindness → byte-identical reveal; cold-restart session restore; no fatal logcat errors (`docs/ANDROID_DEVICE_QA.md`). Standalone-APK and physical-device acceptance NOT TESTED. |
| O. Release documentation | **PASS** | `FINAL_RELEASE_READINESS.md`, `SECURITY_ACCEPTANCE.md`, `EXTERNAL_BLOCKERS.md`, `ANDROID_DEVICE_QA.md`, `RELEASE_PROGRESS.md` — APK/billing/CI statements reconciled with the actual artifacts. |

## Weighted completion estimate

Weights per the release contract. A BLOCKED or NOT TESTED requirement earns
no credit for that requirement; verified subrequirements retain theirs.

| Category | Weight | Earned | Basis |
| --- | ---: | ---: | --- |
| Core functionality and code quality | 20% | 18.0 | All core features implemented, 4 test suites + tsc + lint green, demo runtime verified on Android; deliberate offline matrix unexecuted. |
| Security, privacy and database correctness | 20% | 16.0 | 55/55 authz checks, append-only answers, hardened private-schema trigger, secret scans, dependency audit; hosted advisors and hosted 0011 application outstanding. |
| Real hosted authentication and two-partner flows | 20% | 5.0 | Full auth/recovery source + parser suite + DB-level contract proven; every live hosted journey unexecuted (credentials). |
| Android APK build and standalone installation | 15% | 3.0 | CNG configuration complete and CI-validated; **no APK artifact, no signature, no standalone install** (disk + EAS credentials). Expo Go runtime credit counted under UX. |
| Mobile UX, accessibility and reliability | 10% | 6.0 | Emulator walkthrough with screenshots, a11y tree verified, safe-area/motion fixes; limited screen/mode coverage (one emulator, demo mode). |
| GitHub CI and release engineering | 10% | 9.5 | First fully green 3/3 run (40380810505 @ `6f93274`) at the exact pushed commit; PR evidence current. |
| Documentation and reproducibility | 5% | 4.75 | Five evidence documents reconciled with artifacts; every claim traceable to commands/run IDs. |
| **Total** | **100%** | **≈ 62%** | |

**Overall: ≈ 62% of verified consumer-release readiness.** The remaining
38% is dominated by two owner-side dependencies — an authorized Couples
Supabase session (unlocks hosted migration, advisors, real auth and
two-partner journeys ≈ 22 points) and EAS credentials/disk headroom for a
packaged APK (≈ 12 points). No open code defect is known to block them;
CI is fully green and stays green at the pushed HEAD.
