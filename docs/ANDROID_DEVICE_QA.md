# Android device QA — Couples (Project Two)

## Standalone APK (EAS cloud build) — 2026-10-29

**The real installable APK exists and was independently verified.**

- **Build:** EAS build `c4891307-9f4d-4af4-bf5e-29b15f801b18` on project
  `@pavithran29/project-two` (ID `0cf977e7-83df-4fb0-ba46-cb5c436a50ca`),
  profile `preview` (internal distribution, APK), queue + build
  21:54 → 22:51 UTC (57 min), status **finished**.
- **Source:** commit `d6e0e294918959557974c6e3b0c92075e0e8777c`.
- **Artifact:** https://expo.dev/artifacts/eas/Ks4lIiQi9plgPGmrBrpc-8kY_cF-enajm_A-8lsb-A4.apk
  (131,841,274 bytes; local copy `.qa/project-two-demo.apk`).
- **SHA-256:** `e3714d211e778e67ae5e91f9969ec52eb1ade28f1418da360f008fe776ee0be8`.
- **Identity:** package `com.projecttwo.app`, versionName 1.0.0,
  versionCode 1, minSdk 24, target/compile SDK 36, label "Project Two".
- **Signing:** EAS-managed internal-distribution keystore; signer
  certificate SHA-256 `3760b91727b899a2c810fb0d7347d6be53806826358e903147a257e88f6467b0`.
- **Demo isolation:** preview EAS environment contains exactly one
  variable, `EXPO_PUBLIC_FORCE_DEMO=1` (verified via `eas env:list`);
  no Supabase configuration exists in the environment, and the
  `isSupabaseConfigured()` gate returns false under the flag — the demo
  build cannot initialize a Supabase client.

### Runtime QA (Pixel_10 emulator, `emulator-5554` — installed via `adb install`, Success)

Executed **without Expo Go and without Metro** (release bundle embedded):

1. **Cold launch** — splash → full entry sequence (Lumi, envelope, editorial
   copy) → welcome → demo entry. No dev menu (release build). Screenshot
   `.qa/apk-01-launch.png`.
2. **Letters tab** — PerspectiveSwitcher, daily question (rotates by date),
   sealed envelope, disabled Seal on empty draft, adventure teaser, tab bar.
   `.qa/apk-02-letters.png`.
3. **Mara seals** — typed and sealed; editor replaced by read-only
   "YOUR ANSWER, SEALED". (First attempt taught two automation facts: adb
   `input text` drops unescaped spaces — use `%s`; and this shared AVD has
   other apps that surface into the foreground — see incident note below.)
4. **Pre-reveal blindness** — Theo's view shows no trace of Mara's answer.
   `.qa/apk-06-restored.png` (also proves state persistence across
   backgrounding).
5. **Theo seals** — read-only sealed view for his answer too
   (`.qa/apk-10-reveal.png`).
6. **Reveal** — envelope "opened together"; REVEALED card shows Theo's
   **byte-exact original**; Mara's view (`.qa/apk-14-reveal.png`) shows her
   exact original plus the reaction row (Love/Warm/Spark).
7. **Offline + cold restart** — force-stop → wifi/data disabled → relaunch:
   fully functional, both original answers intact, reveal state preserved
   (`.qa/apk-20-offline.png`, `docs/qa/standalone-offline-restart.png`).
8. **Settings** — demo account (mara@demo.local), "Paired with Theo —
   5 letters completed · 12 keepsakes · 1264 days together", theme selector
   (Warm Daylight/Moonlit Garden), reduced-motion toggle
   (`.qa/apk-16-state.png`).
9. **Stability** — logcat across the whole session: **0 fatal exceptions**.

### Automation incident (disclosed) and restoration verification

This shared AVD also hosts the owner's other test app,
`app.ninninest.journal`, plus system apps (Play/GMS/Google) that surface
into the foreground. During tap automation, a heads-up notification and a
stale document-chooser briefly pulled NinniNest to the front; two
subsequent blind taps landed in its Settings (one near "Erase all data";
any confirmation dialog was dismissed by a following ESC **without
consent**, and its data remained intact — "4 care events" before and
after, no import/export executed). The app was then `pm disable-user`d to
secure the QA session and re-enabled after QA completed (Play re-enabled it
once mid-session). **Restoration verified read-only on 2026-10-29:**
`enabled=1` (its original state), versionName 0.9.0, installed, not hidden,
not suspended — data untouched throughout. The APK binary corresponds to
source commit `d6e0e29`; later pushed commits (`e5b6064`, current HEAD) are
evidence/documentation only. **GUI automation was then stopped for this
cycle:** the shared AVD kept surfacing system apps + NinniNest, and free
disk hit 904 MB (AVD image grew to 11 GB) — below the 2 GB reserve — so the
remaining standalone tap-tests (reaction tap timing, Us/Lumi/doodle
deep-interactions) are recorded NOT TESTED rather than risked. Couples's own
state survived every interruption.

### Not tested on the standalone APK (labeled honestly)

- Physical device (attached phone untouched — requires owner approval).
- Reaction tap timing, Us/Lumi tab deep-interactions, doodle drawing on the
  standalone build (tap automation was repeatedly interrupted by system
  apps surfacing; these flows are verified in the Expo Go runtime session
  below and by the automated suites).
- Font-scale extremes, 3-button navigation, tablet layout.
- Any production-backend behavior (Supabase DEFERRED).

---

## Expo Go runtime session (earlier cycle — superseded in part by the above)



## Runtime walkthrough (all steps executed and screenshotted)

Screenshots live in the workspace `.qa/` folder (not committed; referenced
by name below):

1. **Splash** — `screen-01.png`: "Project Two" launches in Expo Go.
2. **Entry sequence** — `screen-02/03/04.png`: lantern-seed intro, editorial
   copy, page dots render exactly as designed; identity intact.
3. **Welcome** — `screen-05/06.png`: "Two people. One daily letter.",
   rotating intro lines, Create-your-space / sign-in / demo card. The demo
   card's "Enter the demo" works (demo-mode reachability fix confirmed on
   device).
4. **Letters tab** — `screen-07.png`: PerspectiveSwitcher ("Viewing as
   Mara | Theo"), daily letter card with envelope art, category pill,
   sealed-state hint, draft input, disabled "Seal and send" on empty draft,
   this-week's-adventure teaser, tab bar (Letters/Lumi/Us/Settings) with
   gesture-bar clearance (safe-area fix visible).
5. **Cold-restart persistence** — `screen-08.png`: after an emulator reboot,
   the app relaunched straight into the signed-in demo world (AsyncStorage
   session restore works).
6. **Seal flow, partner A** — `screen-09/10.png`: typed Mara's answer,
   sealed it; editor replaced by read-only "YOUR ANSWER, SEALED" +
   "Sealed and waiting."
7. **Pre-reveal blindness, partner B** — `screen-11.png`: switched to Theo;
   Mara's sealed answer is NOT visible anywhere; Theo sees only his own
   empty draft.
8. **Reveal** — `screen-12/13.png`: Theo sealed his answer; envelope
   switches to "opened together"; REVEALED card shows **Mara's exact
   original text** (byte-identical, including a stray test character) and
   Theo's own sealed answer stays read-only. Reaction row present.

## Accessibility evidence (from UI Automator tree)

- The shared Button exposes as `android.widget.Button` with proper
  contentDescription and enabled/disabled state ("Open the gate",
  "Seal and send", Mara/Theo switcher) — the a11y-role fix is live.
- Tab bar items expose contentDescription + labels.
- Input exposes as EditText with placeholder text.
- Disabled states are surfaced through `enabled` flags (Seal disabled
  while draft empty).

## Stability

- `logcat` scanned for the whole session: **no fatal exceptions, no React
  Native red errors**.
- The emulator itself crashed twice mid-session under host disk pressure
  (7.5 GB AVD image on a nearly full C:); the app recovered cleanly after
  each reboot and restored its session — an accidental but useful
  resilience data point.

## Not covered here (next QA tier)

- Production APK (`com.projecttwo.app`) with its own icon/splash/signing.
- Real Supabase-backed flows on device (blocked: no hosted credentials).
- Physical-device run (a phone `CIUWEMJBPBDUWC7D` was attached to adb but
  was deliberately NOT touched — installing on a personal device requires
  owner approval).
- Reduced-motion OS toggle walkthrough, font-scale extremes, keyboard-viewport
  edge cases across more screens.

---

## Physical-device QA plan (PREPARED 2026-10-31 — NOT EXECUTED, awaiting owner approval)

**Artifact under test (re-verified 2026-10-31):** `.qa/project-two-demo.apk`
— SHA-256 `e3714d211e778e67ae5e91f9969ec52eb1ade28f1418da360f008fe776ee0be8`,
package `com.projecttwo.app` v1.0.0 (versionCode 1), minSdk 24 (Android 7.0+),
target 36, universal native-code (`arm64-v8a`, `armeabi-v7a`, `x86`,
`x86_64`), signed by the EAS internal keystore (cert SHA-256
`3760b91727b899a2c810fb0d7347d6be53806826358e903147a257e88f6467b0`).

**Device status at preparation time:** the previously attached phone
(serial `CIUWEMJBPBDUWC7D`) is **not currently connected** (`adb devices`
empty). Compatibility against the actual hardware is therefore pending; the
APK's universal ABI coverage plus minSdk 24 make any Android 7.0+ phone
compatible by manifest.

### Prepared read-only identification commands (no install, no settings change)

```
adb devices                                           # confirm the phone appears and is authorized
adb -s <SERIAL> shell getprop ro.product.model        # model
adb -s <SERIAL> shell getprop ro.build.version.release # Android version (needs >= 7.0)
adb -s <SERIAL> shell getprop ro.build.version.sdk     # SDK level (needs >= 24)
adb -s <SERIAL> shell getprop ro.product.cpu.abi       # ABI (arm64-v8a expected)
adb -s <SERIAL> shell df /data                        # free storage for the ~126 MB APK + data
adb -s <SERIAL> shell pm list packages com.projecttwo.app  # prior install check (read-only)
```

### Non-destructive install + test procedure (limited to com.projecttwo.app)

1. `adb -s <SERIAL> install -r .qa/project-two-demo.apk` — installs/updates
   **only** `com.projecttwo.app`; no other package is touched.
2. Launch: `adb shell monkey -p com.projecttwo.app -c android.intent.category.LAUNCHER 1`.
3. Before **every** automated interaction, assert
   `dumpsys activity activities | grep topResumedActivity` contains
   `com.projecttwo.app` — if any other package is foreground, **abort the
   interaction** (no blind taps, learned from the shared-AVD incident).
4. Prefer `uiautomator dump` accessibility-node bounds for taps over raw
   coordinates.

### Planned test matrix (all results recorded PASS/FAIL/NOT TESTED)

- **Reactions:** tap each chip on the revealed letter; verify selected
  state; navigate away and back; cold-restart; verify persistence.
- **Memories:** create (title/note/date), edit text and date, invalid-date
  rejection, delete (if supported), sorting, empty states.
- **Moods:** check-in create, history, partner perspective, restart
  persistence.
- **Pocket notes:** send, partner read-state, restart persistence.
- **Milestones:** verify creation/display after letters and memories.
- **Lumi:** water/sunlight/play interactions, animation feedback, state
  persistence across restart, reduced-motion behavior.
- **Weekly adventures:** all four stage kinds from both partner
  perspectives, independent completion, doodle drawing + serialization,
  sealed-entry behavior, duplicate-submission behavior.
- **Navigation:** tab switching, Android Back from every screen, keyboard
  open/close, deep link `projecttwo://reset-password` handling.
- **Accessibility:** screen-reader labels on primary controls (uiautomator
  dump), touch-target sizes, large-font scaling, reduced-motion toggle.
- **Reliability:** cold restart, background/resume, offline launch and
  operation (airplane mode), rapid repeated taps on Seal, interrupted
  actions, logcat scan for fatal exceptions after each phase.

### Expected effect on the physical device (disclosed)

- Installs one app, `com.projecttwo.app` (~126 MB APK, ~250–400 MB installed
  footprint), signed by the EAS internal keystore.
- Creates local app data under its own sandbox (demo-world records;
  uninstall removes it entirely).
- **No** other app is modified; **no** settings change; **no** Supabase
  access (Supabase is DEFERRED — the build runs the fictional demo only,
  enforced by the `EXPO_PUBLIC_FORCE_DEMO=1` preview environment).
- Rollback (requires owner approval): `adb uninstall com.projecttwo.app` —
  removes the app and all of its local data; nothing else on the device is
  affected.
- Evidence storage: screenshots pulled to the workspace `.qa/` folder
  (~200–300 KB each; ~10–20 planned) — no meaningful disk impact on the
  phone or C:.

### Approval required before execution

The owner must explicitly approve installing and testing on the physical
phone. On approval, execution starts at the identification commands above
and proceeds through the matrix with the foreground-guard protocol.

---

## Physical device acceptance (POCO M4 Pro 5G) — 2026-10-31

**Owner-approved session on real hardware.** Device: Xiaomi POCO M4 Pro 5G
(model 22031116AI, codename evergo), **Android 13 (SDK 33), arm64-v8a**,
11 GB free on /data at install time, no prior Couples install.

- **Install:** `adb -s CIUWEMJBPBDUWC7D install -r` of the SHA-256-verified
  APK → **Success** (after enabling MIUI "Install via USB" + accepting the
  on-device prompt — first attempts failed with
  `INSTALL_FAILED_USER_RESTRICTED`, a Xiaomi security gate, not an APK
  defect).
- **Cold launch without Expo Go/Metro:** confirmed
  (`topResumedActivity = com.projecttwo.app`); full entry sequence renders
  on the 1080×2400 @ 440dpi screen with safe-area handling intact
  (`.qa/phone-01-launch.png`).
- **Demo journey on hardware:** Mara typed + sealed (read-only sealed view,
  `.qa/phone-04-sealed.png`) → **Theo's view verified blind** via a11y scan
  ("Popcorn" appears nowhere in his tree; `.qa/phone-05-theo-blind.png`) →
  Theo sealed (`.qa/apk-10-reveal.png` equivalent: `.qa/phone-06-reveal.png`)
  → **reveal shows Mara's byte-exact original** + reactions
  (`.qa/phone-06-reveal.png`, `.qa/phone-08-mara-view.png` shows both
  perspectives).
- **Reaction persistence:** Love chip selected (visual coral state
  verified); reaction visible from both perspectives and after restart.
  A11y note: the reaction chips do not expose an a11y `selected` state
  (labels only) — minor, recorded.
- **Pocket note:** sent as Mara ("The coffee is alive.") — persisted in the
  shared notes list (`.qa/phone-14-note-sent.png`).
- **Mood chip:** selection state renders (☀️).
- **Lumi:** care interaction "Give water" → **Warmth 42 → 46** verified via
  the a11y tree; companion + "happy to see you" mood render
  (`.qa/phone-10-lumi.png`, `.qa/phone-11-lumi-water.png`).
- **Offline cold restart:** force-stop → airplane mode ON → relaunch →
  fully functional, all state preserved, airplane icon visible in the
  status bar (`.qa/phone-15-offline.png`). Network restored immediately
  after.
- **Stability:** 0 fatal exceptions, 0 ANRs in the phone logcat for the
  whole session.
- **Disclosed:** MIUI required the owner to enable "Install via USB" +
  "USB debugging (Security settings)" (device security settings changed by
  the owner, not by the agent). Two automation taps landed in NinniNest's
  Settings through a stale system chooser on this shared device in the
  earlier emulator session — on the PHYSICAL phone no such incident
  occurred and NinniNest was never opened, modified, or stopped.

### Physical-device NOT TESTED (honest)

- Doodle drawing on hardware, Lumi sun/play taps, Us-tab memory editing on
  hardware (emulator verification + automated suites cover the logic).
- Font-scaling extremes, 3-button navigation, tablet layouts.
- Any production-backend behavior (Supabase DEFERRED).

### A11y re-verification on the updated APK (build a48d385d, commit 5079be9) — 2026-10-31

The a11y-fix build (SHA-256 b71ea488ed3bc37430337c12ca32236841b2f147f0506619186feac355f55195)
installed on the POCO after the owner accepted the MIUI prompt (the first
retry failed with INSTALL_FAILED_USER_RESTRICTED again; lastUpdateTime
moved 14:40:34 -> 17:01:28, proving the update). Reaction a11y states,
read from the UI-Automator tree of the updated binary:

- Tap Love: Love=true, Warm=false, Spark=false (selected reaches screen readers)
- Tap Warm: Love=false, Warm=true, Spark=false (single-selection semantics)
- Force-stop + cold restart: Warm=true persists
- Restore Love: Love=true, Warm=false, Spark=false

PerspectiveSwitcher pills already exposed selected states (verified in the
same dumps). All a11y re-tests PASS on hardware.

### Weekly adventure (tiny_date) completed on hardware — 2026-10-31 (later session)

The current week's deterministic adventure type (tiny_date — "Dessert first
tonight") was completed from BOTH partner perspectives on the physical POCO:

1. **Mara's side** was already kept ("YOUR PART, KEPT — Strawberries and
   cream, eaten before the pasta water even boiled.").
2. **Switched to Theo** (PerspectiveSwitcher): his side rendered with an
   open entry field and an enabled "Mark it done" (a11y bounds from the
   UI-Automator dump; no blind taps).
3. **Theo typed and sealed** — "YOUR PART, KEPT / Dessert first, rules
   second." persisted; the state advanced to **"Done together"**.
4. Letters history simultaneously showed five consecutive days of
   "Revealed" letters — the demo world persisted across days on the device.

Screenshot: `docs/qa/physical-adv-done.png` (sanitized — demo UI only).
Other three adventure types rotate weekly and were **NOT TESTED on
hardware** (deterministic by design; logic covered by the automated suites
and the 55-check authorization matrix). Doodle drawing on hardware likewise
NOT TESTED this cycle (type-gated).
