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
