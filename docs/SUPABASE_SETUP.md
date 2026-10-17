# Supabase setup — new isolated project only

These steps provision a **brand-new** Supabase project for Project Two.
Do not reuse credentials, domains, or databases from any other project.

## 1. Create the project

1. Sign up / log in at https://supabase.com and create a **new** project
   (any region close to your testers; note the database password).
2. Wait for provisioning to finish.

## 2. Apply the schema

Option A — dashboard:
1. Open **SQL Editor** → **New query**.
2. Paste the full contents of `backend_src/0001_initial_schema.sql` and run.
3. Re-running is safe (idempotent).

Option B — CLI (from the repo root):

```bash
npx supabase init            # if no supabase/ config exists yet
npx supabase db push         # after linking (next step)
npx supabase link --project-ref <your-new-project-ref>
```

## 3. Configure the app

1. Dashboard → **Project Settings** → **API**:
   copy the **Project URL** and the **anon / publishable** key.
   Never copy the service-role key into the app.
2. Copy `.env.example` to `.env` and set:

```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon key>
```

3. Restart the dev server. The app now runs `SupabaseRepository`
   (sign-up, pairing, letters, companion, memories) instead of the demo.

## 4. Verify the security model (adversarial)

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

Record results in `docs/BOLT_ACCEPTANCE.md` with dates.

## 5. Auth configuration

- Sign-in method: **email/password only**. Confirmations OFF by default;
  leave them off unless you configure an email sender.
- Password reset: the app calls `resetPasswordForEmail`; set the Site URL
  (Authentication → URL Configuration) to your deployed web origin or app
  scheme `projecttwo://`.

## 6. Data retention & deletion

- Account deletion (`delete_my_account`) removes the auth user; all app
  rows cascade via foreign keys.
- Export (`export_my_data`) returns a JSON bundle of the caller's own
  profile, letters, answers, memories, and check-ins only.
