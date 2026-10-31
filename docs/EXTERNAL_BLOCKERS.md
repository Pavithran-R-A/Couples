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

## 3. ~~EAS project linkage and credentials~~ — RESOLVED (2026-10-29)

- **The owner completed Expo device authentication** (account `pavithran29`,
  Owner; also owns `pavithran29s-team`). No credentials passed through any
  agent.
- **Project created and linked:** `@pavithran29/project-two`
  (ID `0cf977e7-83df-4fb0-ba46-cb5c436a50ca`) — the all-zero placeholder in
  `app.json` was replaced by `eas init --account pavithran29`.
- **Preview environment:** exactly one variable, `EXPO_PUBLIC_FORCE_DEMO=1`
  (project-scoped; verified via `eas env:list`) — the demo build cannot
  reach any Supabase backend.
- **Real APK produced:** build `c4891307-9f4d-4af4-bf5e-29b15f801b18`,
  profile `preview` (internal APK), source commit `d6e0e29`, status
  **finished**; artifact SHA-256
  `e3714d211e778e67ae5e91f9969ec52eb1ade28f1418da360f008fe776ee0be8`,
  installed and QA'd on the emulator (`ANDROID_DEVICE_QA.md`).
- **Remaining (not blockers for the demo artifact):** physical-device QA,
  production/store signing, and the deferred Supabase milestone (§2).

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

## 5. Local disk exhaustion — OWNER ACTION REQUIRED (2026-10-30)

- **C: free space reached 0 GB.** Read-only diagnostics identified where the
  space went; nothing was deleted or altered:
  - `Pixel_10.avd` total **11 GB**: `userdata-qemu.img.qcow2` **5.5 GB**,
    emulator **snapshots 4.1 GB**, `sdcard.img` 512 MB, cache 197 MB.
  - `%TEMP%` ~1.06 GB (mixed system files), npm caches ~0.2 GB (cleaned),
    project `node_modules` 785 MB (required for development),
    `.gradle` 136 MB, `.qa` evidence 132 MB (incl. the APK local copy).
- **No second drive exists** on this machine, so AVD migration to another
  volume is not possible locally; an external/USB drive would be needed.
- **The emulator is not running** — nothing is actively writing; the disk
  state is static.
- **Approval-required reclaim levers (owner decision, none executed):**
  1. Delete the AVD **snapshots** (4.1 GB) — data-preserving (userdata is a
     separate image) but it alters the shared AVD's quick-boot state;
  2. Move the AVD to external storage and repoint `ANDROID_AVD_HOME`;
  3. Free space elsewhere on C:.
- **Consequence:** GUI automation of the standalone APK is paused — it both
  requires and grows disk. Standalone tap-tests already executed remain
  valid (see `ANDROID_DEVICE_QA.md`); the rest are NOT TESTED.

### 5b. Safe-recovery session (2026-10-31) and the approval-ready snapshot plan

**Rechecked:** C: at 1.4 GB free; emulator fully stopped (0 qemu/emulator
processes — nothing actively writing); AVD components unchanged (userdata
5.5 GB, snapshots 4.1 GB, sdcard 512 MB, cache 197 MB).

**Cleaned this session (explicitly disposable, verified by inspection):**

| Path | Size | What it was |
| --- | --- | --- |
| `%TEMP%\DockerDesktopUpdates\Docker Desktop Updater-240920 (244584).exe` | 383 MB | Stale Docker Desktop updater download (re-downloadable) |
| `%TEMP%\DiagOutputDir\RdClientAutoTrace` | 156 MB | Remote Desktop client diagnostic traces |
| `%TEMP%irestick-phase4-temurin17-linux.tar.gz` | 193 MB | Downloaded JDK archive (re-downloadable) |
| `%TEMP%
ode-compile-cache`, `%TEMP%\metro-cache` | 155 MB | Node/Metro compile caches (regenerate automatically) |
| npm cache (`%LOCALAPPDATA%
pm-cache`) | ~330 MB | Package download cache (re-downloads on demand) |

**Identified as NOT disposable and preserved:** `%TEMP%\opencode`
(receiptlab live/qa/pgtest work directories — possibly a Postgres data dir),
`%TEMP%c2review`, `%TEMP%\cutlyla-accept` (other in-flight project
reviews), the AVD entirely, `.qa` evidence incl. the APK local copy,
`node_modules`, `.gradle`.

**Result: 1.4 GB → ~2.5 GB free.** The 8–10 GB target is **not achievable
without touching the shared AVD** — so destructive operations stopped here.

**Approval-ready snapshot plan (NOT executed — requires owner approval):**
1. Close the emulator (already stopped).
2. Delete `Pixel_10.avd/snapshots/` (4.1 GB) via the AVD Manager
   ("Delete AVD snapshot") or by removing the `snapshots` directory — this
   discards saved quick-boot restore points; the **userdata disk image
   (5.5 GB) is a separate file and is not touched**, but app/data state
   rollback points are lost and the next boot is a cold start.
3. Optional companion: delete `cache.img.qcow2` (197 MB, rebuilt
   automatically).
4. Expected recovery: ~4.3 GB immediately (total ~6.8 GB free); combined
   with the userdata image the AVD remains the largest consumer, so the
   durable fix is an external/USB drive for `ANDROID_AVD_HOME` (no second
   internal drive exists).
**No zero-data-loss guarantee is offered:** deleting snapshots can lose
snapshot-dependent state; only the userdata image preserves installed apps
and their data.


- **Observed:** C: dropped to 103 MB during the gradle attempt and sits
  around 1.9-2 GB free; the Pixel_10 AVD image alone is 7.5 GB.
- **Consequences:** heavyweight local native builds and long emulator
  sessions are unsafe until more headroom exists; device QA currently relies
  on Expo Go + Metro (light on disk).
- **Unblock:** owner frees space (or approves cleaning the AVD image /
  gradle caches). Never attempted without approval.
