-- ==========================================================================
-- Weekly adventures v2: RPC-only mutation path.
-- Removes the client INSERT/UPDATE policies; drops and recreates the
-- completion RPC as the sole write path; unique (couple_id, week_of)
-- plus an advisory lock enforce exactly one adventure per week even
-- under concurrent requests from both partners.
-- ==========================================================================

-- Tighten uniqueness: one adventure per couple per week regardless of kind.
alter table public.weekly_adventures
  drop constraint if exists weekly_adventures_couple_id_week_of_kind_key;
alter table public.weekly_adventures
  add constraint weekly_adventures_couple_week_unique unique (couple_id, week_of);

-- Remove direct client write policies entirely.
drop policy if exists adventures_insert on public.weekly_adventures;
drop policy if exists adventures_update on public.weekly_adventures;

-- Remove direct DML privileges: SELECT only. Mutations go through RPCs.
revoke insert, update, delete on public.weekly_adventures from authenticated;
grant select on public.weekly_adventures to authenticated;

-- ---------- RPC: claim this week's adventure (concurrency-safe) ----------
create or replace function public.get_this_weeks_adventure()
returns public.weekly_adventures
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  my_couple uuid;
  monday date;
  offer public.weekly_adventures;
  kind_pick text;
  titles text[];
  details text[];
  idx integer;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select couple_id into my_couple from public.profiles where id = me;
  if my_couple is null then raise exception 'no couple'; end if;

  monday := date_trunc('week', current_date)::date;

  -- Serialize per-couple creation so two simultaneous calls cannot both
  -- insert; the unique constraint is the backstop if the lock is bypassed.
  perform pg_advisory_xact_lock(hashtext('weekly_adventure' || my_couple::text));

  select * into offer from public.weekly_adventures
   where couple_id = my_couple and week_of = monday
   limit 1;
  if found then return offer; end if;

  kind_pick := (array['gratitude_exchange','tiny_date','playful_question','doodle_prompt'])
                [1 + mod(hashtext(my_couple::text || monday::text), 4)];

  idx := mod(hashtext(my_couple::text || monday::text || kind_pick), 6);

  titles := case kind_pick
    when 'gratitude_exchange' then array[
      'Two thank-yous, no repeats',
      'The small-things exchange',
      'Hidden effort, seen',
      'Thank-you note swap',
      'Quiet kindness callout',
      'The appreciate-anything round'
    ]
    when 'tiny_date' then array[
      'Fifteen-minute picnic',
      'Sunset walk, phones away',
      'Dessert first tonight',
      'Kitchen dance break',
      'Balcony tea for two',
      'One-song slow dance'
    ]
    when 'playful_question' then array[
      'What tiny thing made you laugh today?',
      'Which snack are you defending this week?',
      'What would our companion say about us?',
      'Most overrated food, go',
      'Your secret useless talent?',
      'Best worst movie, together?'
    ]
    else array[
      'Doodle our week in one picture',
      'Draw the view from your window',
      'Sketch each other in 60 seconds',
      'One-line comic about today',
      'Draw our companion a friend',
      'Map of an imagined town'
    ]
  end;

  details := case kind_pick
    when 'gratitude_exchange' then array[
      'Each of you writes two genuine thank-yous. Nothing too small counts as too small.',
      'Share one thing the other did this week that made your day lighter.',
      'Name one effort your partner made that usually goes unnoticed — and thank them for it.',
      'Write a short thank-you note and read it to each other tonight.',
      'Call out one quiet kindness you noticed. Specific beats grand.',
      'Say thank you for anything at all — the sillier, the better.'
    ]
    when 'tiny_date' then array[
      'Lay out a blanket anywhere — floor counts. Fifteen minutes, just you two.',
      'Take a short walk together and leave the phones behind.',
      'Eat your dessert before dinner tonight. Rules are suspended.',
      'Put on one song and dance in the kitchen. No audience required.',
      'Brew tea, sit together, watch the light change for a few minutes.',
      'Choose a song, hold each other, and let it play twice.'
    ]
    when 'playful_question' then array[
      'Answer honestly, then ask each other a follow-up question.',
      'Defend your worst snack combination proudly. Loser buys the next one.',
      'Imagine your companion could talk for one minute. What would it say?',
      'Name the most overrated food you can think of and defend it.',
      'Show off your most useless talent. Bonus points for commentary.',
      'Pick a so-bad-it-is-good film and pitch it to each other.'
    ]
    else array[
      'Draw one shared picture that captures your week together. Anything goes.',
      'Draw what you can see from where you are right now. Trade drawings.',
      'Draw your partner in one minute, no erasing. Reveal at the end.',
      'Make a one-line comic about something funny from today.',
      'Design a little friend for your companion. Give it a name.',
      'Draw a tiny town where you would both love to live. Label one street.'
    ]
  end;

  insert into public.weekly_adventures (couple_id, week_of, kind, title, detail)
  values (my_couple, monday, kind_pick, titles[idx + 1], details[idx + 1])
  on conflict (couple_id, week_of) do nothing
  returning * into offer;

  if offer is null then
    select * into offer from public.weekly_adventures
     where couple_id = my_couple and week_of = monday
     limit 1;
  end if;

  return offer;
end;
$$;

revoke execute on function public.get_this_weeks_adventure() from public, anon;
grant execute on function public.get_this_weeks_adventure() to authenticated;

-- ---------- RPC: mark my participation (sole write path) ----------
create or replace function public.complete_adventure_part(p_id uuid, p_entry text)
returns public.weekly_adventures
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  my_couple uuid;
  adv public.weekly_adventures;
  entry text := nullif(trim(coalesce(p_entry, '')), '');
begin
  if me is null then raise exception 'not authenticated'; end if;
  select couple_id into my_couple from public.profiles where id = me;
  if my_couple is null then raise exception 'no couple'; end if;

  select * into adv from public.weekly_adventures
   where id = p_id and couple_id = my_couple
   for update;
  if not found then raise exception 'adventure not found'; end if;

  if entry is not null and char_length(entry) > 500 then
    raise exception 'entry too long';
  end if;

  if me = (select partner_a_id from public.couples where id = my_couple) then
    update public.weekly_adventures
       set partner_a_done = true, partner_a_entry = coalesce(entry, partner_a_entry)
     where id = p_id;
  else
    update public.weekly_adventures
       set partner_b_done = true, partner_b_entry = coalesce(entry, partner_b_entry)
     where id = p_id;
  end if;

  select * into adv from public.weekly_adventures where id = p_id;
  return adv;
end;
$$;

revoke execute on function public.complete_adventure_part(uuid, text) from public, anon;
grant execute on function public.complete_adventure_part(uuid, text) to authenticated;
