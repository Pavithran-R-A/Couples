# Project Two — private daily ritual space for two

A mobile-first couples app built with Expo, React Native, TypeScript and Expo
Router. Two partners connect accounts, open one daily letter, answer
independently, and discover both answers only after each has written. They
care for an original animated companion (the lantern-seed), keep shared
memories and milestones, and share explicit mood check-ins — all in an
intimate, editorial visual style ("Afterlight Atelier").

## Modes

- **Demo mode (default):** a fully interactive demonstration starring two
  fictional partners, Mara and Theo, with isolated synthetic data. No real
  accounts are created. Perfect for reviewing every flow end-to-end.
- **Production mode:** set `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env` (see `.env.example`) and the app
  automatically switches to the real backend — authentication, pairing,
  daily letters, and all persistence via Supabase with row-level security.

## Getting started

```bash
npm install
npm run dev          # Expo dev server (press w for web, a for Android)
npm run typecheck    # TypeScript strict check
npm run build:web    # Static web export
```

## Backend setup (for production)

1. Create a project at [supabase.com](https://supabase.com).
2. Run the SQL in `backend_src/0001_initial_schema.sql` in the SQL editor.
   It creates all tables, row-level security policies, and the pairing,
   letter and companion functions.
3. Copy `.env.example` to `.env` and add your project URL and anon key.
4. Optional: run `backend_src/tests/0002_reveal_privacy_test.sql` to verify
   that partner answers are unreadable before both partners have submitted.

## Architecture

- `domain/` — typed entities and the 90-question prompt bank.
- `services/` — `BackendAdapter` interface, `DemoRepository` (synthetic),
  `SupabaseRepository` (production), Supabase client factory.
- `providers/` — app-wide state, session and backend selection.
- `theme/` — design tokens (Afterlight Atelier palette), fonts, UI kit.
- `components/` — bespoke UI: the SVG lantern-seed companion, ornaments,
  reaction chips, memory cards.
- `app/` — Expo Router screens: onboarding, pairing, tabbed daily ritual.
- `backend_src/` — portable SQL migration, privacy tests, for any Supabase
  or Postgres project outside this repo.

## Privacy guarantees

- Partner answers are invisible through the data API until **both** partners
  have submitted — enforced by a row-level security policy, not client logic.
  See `backend_src/tests/0002_reveal_privacy_test.sql`.
- Pairing uses single-use, expiring invitation codes consumed atomically in
  one server function; at most two members per couple.
- Mood check-ins are shared only when explicitly posted.
- The companion never punishes inactivity — warmth only grows with care.

## Roadmap to Google Play

- Android packaging via EAS, release config in `app.json` (package
  `com.projecttwo.app`, notification permission declared).
- Cosmetic themes, keepsake exports and companion environments are designed
  as premium-ready extensions; no payments are wired in this build.
