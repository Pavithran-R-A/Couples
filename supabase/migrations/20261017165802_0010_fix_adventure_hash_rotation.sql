-- ==========================================================================
-- Fix adventure rotation: hashtext() returns a signed int4. mod(negative, n)
-- yields a negative index in Postgres, so titles[idx + 1] evaluated to NULL
-- and adventure creation crashed for some (couple, week) pairs. Wrap in
-- abs() so the rotation index is always in range.
-- ==========================================================================

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
                [1 + mod(abs(hashtext(my_couple::text || monday::text)), 4)];

  idx := mod(abs(hashtext(my_couple::text || monday::text || kind_pick)), 6);

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
