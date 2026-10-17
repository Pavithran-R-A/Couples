-- ============================================================
-- Negative-access test: reveal privacy
-- Run as any authenticated partner A after writing a response
-- where partner B has NOT yet replied.
--
-- EXPECTED RESULT (must pass):
--   partner_visible_count = 0   <- partner B's row is NOT readable
--   own_visible_count     = 1   <- you can still see your own answer
--
-- If partner_visible_count returns 1, the reveal guarantee is
-- BROKEN and must not ship.
--
-- Usage: run in the Supabase SQL editor while signed in as
-- partner A via the SQL editor's "switch role" to authenticated,
-- or wrap in a test harness that sets request.jwt_claims.
-- ============================================================

with me as (
  select id, couple_id from public.profiles where id = auth.uid()
),
today_letter as (
  select l.id
  from public.daily_letters l
  join me on me.couple_id = l.couple_id
  order by l.letter_date desc
  limit 1
),
visible_responses as (
  select r.author_id
  from public.responses r
  where r.letter_id in (select id from today_letter)
),
counts as (
  select
    count(*) filter (where author_id = (select id from me)) as own_visible_count,
    count(*) filter (where author_id <> (select id from me)) as partner_visible_count
  from visible_responses
)
select
  own_visible_count,
  partner_visible_count,
  case
    when partner_visible_count = 0 then 'PASS: partner answer hidden before both submit'
    else 'FAIL: REVEAL PRIVACY BROKEN'
  end as verdict
from counts;
