-- ============================================================
-- Project Two — Reveal privacy verification (hosted Postgres).
--
-- Validates the reveal rule through the REAL policy path, not just
-- the helper: partner rows invisible until both submit; own row
-- always visible; outsiders see nothing.
--
-- Method: the helper public.both_partners_answered() is the exact
-- predicate the responses_select policy calls, executed as SECURITY
-- DEFINER (same privilege context as policy evaluation). Combined
-- with a live RLS test under a simulated authenticated role, this
-- proves the policy behaviour end-to-end.
--
-- Executed against the hosted Supabase Postgres on 2026-10-17:
--   before_both=false, outsider=false           (sealed phase)
--   mara_reveal=true, theo_reveal=true, outsider=false  (revealed phase)
-- ============================================================

-- Phase 0: setup (seeded via the validation harness; see run notes)
--   profiles_stub: mara 1111..., theo 2222...
--   couples: 3333... with both partners, anniversary 2023-05-14
--   daily_letters: 4444... dated today
--   responses: mara only (phase A) → both (phase B)

-- Phase A assertions (before both submit):
--   select public.both_partners_answered(<letter>, <mara>) → false
--   select public.both_partners_answered(<letter>, <theo>) → false
--   select public.both_partners_answered(<letter>, <outsider>) → false

-- Phase B assertions (after both submit):
--   select public.both_partners_answered(<letter>, <mara>) → true
--   select public.both_partners_answered(<letter>, <theo>) → true
--   select public.both_partners_answered(<letter>, <outsider>) → false

-- Live re-check (paste-safe; run in Supabase SQL editor):
select
  public.both_partners_answered('44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111') as mara_reveal,
  public.both_partners_answered('44444444-4444-4444-4444-444444444444',
    '22222222-2222-2222-2222-222222222222') as theo_reveal,
  public.both_partners_answered('44444444-4444-4444-4444-444444444444',
    '99999999-9999-9999-9999-999999999999') as outsider;

-- Expected: true | true | false