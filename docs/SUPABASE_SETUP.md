# Supabase setup — ordered migration series is the only schema source

The database schema is defined by the **ordered migration series** in
`supabase/migrations/` (0000 → 0011, eleven files). It is the single source
of truth.

**Never apply the legacy monolithic `backend_src/0001_initial_schema.sql` to
any hosted database.** It predates migrations 0002–0011 (RLS hardening, the
app-contract alignment, RPC-only adventures, the append-only answer policy)
and applying it would produce an out-of-date, insecure schema.

## 1. Prefer the historical hosted project — verify before touching it

A hosted project was previously used for Couples acceptance testing. Before
creating anything new, verify its identity with several independent facts:

1. Project **reference** (the `ref` in `https://<ref>.supabase.co`).
2. Project **owner/organization** belongs to you.
3. API URL matches what the app expects.
4. The hosted **schema matches the Couples tables** (profiles, couples,
   invitations, daily_letters, responses, reactions, pet_states, memories,
   milestones, mood_check_ins, pocket_notes, weekly_adventures).
5. Hosted migration history matches the series **through 0010**
   (`npx supabase migration list` after linking, or the dashboard's
   migration history).
6. Application-specific functions exist (`create_my_invitation`,
   `join_couple_with_code`, `get_or_create_today_letter`,
   `complete_adventure_part`, `private.is_couple_member`, …).

If identity is not proven, **do not mutate that database** and do not
repurpose any other project's (e.g. DueWeave, ClaimKhoj, NinniNest).

## 2. Link and reconcile migrations (historical project)

```bash
npx supabase login                      # browser flow; never paste tokens in chat
npx supabase link --project-ref <ref>   # links the verified project
npx supabase migration list             # compare hosted vs local series
npx supabase db push                    # applies ONLY genuinely missing files, in order
```

- `db push` replays the ordered series; it must report the eleven local
  files and apply only the remote-missing ones (0011, and any others the
  hosted history lacks). **Do not "repair" history by guessing** — if the
  hosted history diverges, reconcile it in the dashboard first.
- Take a dashboard backup (or note the recovery point) before pushing.
- After applying, verify: policies via
  `select * from pg_policies where schemaname = 'public';`,
  privileges via `information_schema.role_table_grants`, the
  `responses_reveal_stamp` trigger via `pg_trigger`, and
  `select * from supabase_migrations.schema_migrations order by version;`.
- Run the security advisors (Dashboard → Security Advisor) and record
  findings.

Never replay the entire initial migration series against an existing
populated production database.

## 3. Creating a brand-new project (only when no verified historical project exists)

1. Create a **new** project at https://supabase.com (isolate it from every
   other application; note the database password).
2. Link it (`npx supabase link --project-ref <ref>`).
3. Apply the **ordered series** with `npx supabase db push` — never the
   monolithic file, never the dashboard with `0001` pasted in.

## 4. Configure the app

1. Dashboard → **Project Settings** → **API**: copy the **Project URL** and
   the **anon / publishable** key. Never copy the service-role key into the
   app.
2. Copy `.env.example` to `.env` and set:

```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon key>
```

3. Restart the dev server. The app now runs `SupabaseRepository`
   (sign-up, pairing, letters, companion, memories) instead of the demo.

## 5. Auth configuration — confirmation ON, redirects exact

- Sign-in method: **email/password**. **Keep email confirmation enabled**
  (do not disable it to simplify testing — the app is built for it: signup
  routes by whether the adapter session exists, and profiles are created
  server-side by the `on_auth_user_created` trigger). Configure an email
  sender (the built-in sender is fine for testing).
- **URL Configuration (Authentication → URL Configuration):**
  - Site URL: your app origin.
  - Redirect URLs must include **`projecttwo://reset-password`** (the
    password-recovery deep link the app requests) and your confirmation
    redirect.
- Recovery links must land on the custom scheme; if redirects do not work,
  check the email templates use the correct confirmation/redirect variables
  (`{{ .ConfirmationURL }}`).

## 6. Verify the security model (adversarial)

Run these checks from the dashboard SQL editor, signed in as
`authenticated` where noted:

1. **Sealed reveal (negative):** with only partner A submitted, run
   `backend_src/tests/0002_reveal_privacy_test.sql` as partner A.
   Expected: `partner_visible_count = 0`, verdict PASS.
2. **Third account (negative):** create a third account, attempt
   `select * from responses;`. Expected: only that account's own rows.
3. **Attempt direct insert into another couple's memory:** expected to
   fail the `memories_insert` policy.
4. **Anonymous call (negative):** call
   `select public.create_my_invitation();` with no session. Expected:
   permission denied (EXECUTE revoked from anon).
5. **Append-only (negative):** after both partners answered, attempt
   `update responses set body = 'x' where author_id = auth.uid();`
   Expected: permission denied (UPDATE revoked — migration 0011).
6. Run `node scripts/migrate-and-test.mjs` locally — 55/55 checks must pass
   against the same series before trusting the hosted result.

Record results in `docs/BOLT_ACCEPTANCE.md` with dates.

## 7. Data retention & deletion

- Account deletion (`delete_my_account`) removes the auth user; all app
  rows cascade via foreign keys.
- Export (`export_my_data`) returns a JSON bundle of the caller's own
  profile, letters, answers, memories, and check-ins only.
