# Android Release Handoff — Project Two

Everything needed to take the app from this repository to an installable
Android build. Commands marked (blocked here) could not be run in this
environment — they require EAS authentication.

## What is already configured

- **Adaptive icon**: foreground + monochrome layers from the 1024px app icon,
  midnight-navy `#151D32` background (matches the Moonlit Garden theme).
- **Splash**: icon at 180pt width on `#151D32`, with an explicit dark variant
  on `#0E1526` so the launch screen never flashes white in dark mode.
- **Deep links**: `projecttwo://` custom scheme plus `https://projecttwo.app`
  App Links intent filter (`autoVerify: true`). Email confirmation and
  password-reset links should use this origin (set in Supabase Auth → URL
  Configuration).
- **Permissions**: only `POST_NOTIFICATIONS`. No location, camera, contacts,
  or storage permissions are requested — the app is deliberately minimal.
- **EAS profiles** (`eas.json`): `preview` builds an APK (`environment:
  "preview"`), `production` builds an App Bundle (`environment:
  "production"`). Both read `EXPO_PUBLIC_SUPABASE_URL` /
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from EAS environment variables —
  never from committed files.

## Secrets you must set once (blocked here)

```bash
npx eas login
npx eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value <your-project-url>
npx eas secret:create --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value <your-anon-key>
```

Set them per environment with `--environment preview` / `--environment
production` if the values differ (they normally do not — the publishable key
is safe for clients; the service-role key must never be added here).

## Build an installable APK (blocked here)

```bash
npx eas build -p android --profile preview
```

Produces a directly-installable APK at the URL EAS prints when finished.
For the Play Store:

```bash
npx eas build -p android --profile production
npx eas submit -p android --latest   # after configuring service account
```

## Compile locally instead (no EAS account needed)

```bash
npx expo prebuild -p android   # generates android/ from app.json
cd android && ./gradlew assembleRelease
```

Requires Android SDK 36 (Android 16) tooling: `ANDROID_HOME` set, SDK
Platform 36 + Build-Tools 36 installed via Android Studio's SDK Manager.
Expo SDK 57 targets API 36 per Google Play's current requirement.

## Post-build checklist (manual, on-device)

1. Install the APK → sign up with a real email → confirm via inbox → sign in.
2. Second device (or second account): join via the 6-character invite code.
3. Both answer today's letter → envelope opens → both answers visible.
4. Switch Android language/system dark mode → splash and theme stay coherent.
5. Kill the app cold → reopen → session persists (no forced re-login).
6. Airplane mode → open app → friendly backend notice with working retry
   (never a silent demo-mode fallback).
7. Weekly adventure: both partners complete their side → "Done together".
8. Deep link: open `projecttwo://` from a browser or another app → app opens.
