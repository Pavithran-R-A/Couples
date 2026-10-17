# Project Two — architecture

## Layers

```
app/            Expo Router screens (native + web from one source)
  (tabs)/       Letters (daily ritual) · Companion · Us (moods/keepsakes) · Settings
  onboarding    Auth: sign up, sign in, password reset, demo entry
  pairing       Invitation create / redeem
components/     Original UI: LanternSeed (SVG companion), Ornaments, cards
domain/         Typed entities + the 90-question prompt bank
services/       BackendAdapter interface + two implementations
providers/      Session state and backend selection
theme/          Afterlight Atelier tokens, fonts, UI kit
backend_src/    Portable SQL migration + security tests (any Supabase/Postgres)
```

## Backend selection

`providers/AppProvider` picks the implementation at startup:

- `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  (or legacy `EXPO_PUBLIC_SUPABASE_ANON_KEY`) set → `SupabaseRepository`.
- Otherwise → `DemoRepository` (Mara & Theo, synthetic data, device-local).

Both implement the same `BackendAdapter`, so every screen works in either
mode with no code changes.

## Security boundaries

The governing rule: the client is untrusted. All authorization lives in
Postgres row-level security and security-definer functions — the UI's
hidden states are presentation only.

| Boundary | Enforcement point |
|---|---|
| Partner answer hidden until both submit | `responses_select` RLS policy: partner rows are filtered out entirely, not just masked |
| One couple per account, max two members | `couples` structure + atomic `join_couple_with_code` |
| Invitation codes single-use, expiring | Server-side generation (`create_my_invitation`), `FOR UPDATE` row lock, consumed flag |
| Couple-scoped reads | `is_couple_member(couple_id, auth.uid())` on every couple table |
| Author-scoped writes | INSERT/UPDATE/DELETE policies check `author_id = auth.uid()` |
| Pet mutations idempotent + bounded | `care_for_companion` clamps affection 0–100 server-side |
| No anonymous backend calls | EXECUTE revoked from `public`/`anon` on every definer function |
| Profiles not writable cross-couple | `profiles_update_own` pins `couple_id = my_couple_id()` |

`my_couple_id()` is a security-definer helper so profile policies never
read `profiles` recursively under RLS.

## Data model

`profiles` · `couples` · `invitations` · `question_bank` (90 prompts) ·
`daily_letters` (unique per couple per day) · `responses` (unique per
letter per author) · `reactions` · `pet_states` · `memories` ·
`milestones` · `mood_check_ins`.

## Deliberate exclusions

No live location, no phone/device monitoring, no streak punishments, no
compatibility scoring, no ads, no fake payments. Payment hooks are
architecturally reserved (BackendAdapter surface) for Google Play Billing
during release hardening.
