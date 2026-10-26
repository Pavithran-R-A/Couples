# Android device QA — Couples (Project Two)

Session date: 2026-10-26 · Branch `completion/consumer-release` (commits
through the UI-hardening milestone). Evidence gathered on the local
Pixel_10 emulator (`sdk_gphone16k_x86_64`, API 16K image) with Expo Go
57.0.9 running the app's real JavaScript from this branch via Metro.

**Fidelity label (honest):** this is an **Expo Go runtime session on an
emulator**, not the packaged production APK. The JavaScript, navigation,
design system and all adapter logic are identical to the shipped app; the
native shell is Expo Go's, not `com.projecttwo.app`. A `gradlew
assembleDebug` attempt from the (then-committed, now CNG-untracked)
`android/` prebuild **ran out of disk** (~3 GB of gradle downloads +
intermediates on top of a 7.5 GB AVD image; C: dropped to 103 MB and the
build was aborted per the disk-safety rule) and produced **no APK**. The
packaged-APK gate remains open for a window with more free disk or an EAS
build (blocked on credentials — see `EXTERNAL_BLOCKERS.md`).

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
