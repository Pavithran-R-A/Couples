-- ==========================================================================
-- Weekly adventures: small cooperative activities couples complete together.
-- One active adventure offer per couple per week; two-sided participation;
-- progress persists. Never punishes inactivity (no expiry penalties).
-- ==========================================================================

create table if not exists public.weekly_adventures (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  week_of date not null,                    -- Monday of the ISO week
  kind text not null check (kind in ('gratitude_exchange','tiny_date','playful_question','doodle_prompt')),
  title text not null,
  detail text not null,
  partner_a_done boolean not null default false,
  partner_b_done boolean not null default false,
  partner_a_entry text check (char_length(partner_a_entry) <= 500),
  partner_b_entry text check (char_length(partner_b_entry) <= 500),
  created_at timestamptz not null default now(),
  unique (couple_id, week_of, kind)
);

create index if not exists idx_weekly_adventures_couple_week
  on public.weekly_adventures (couple_id, week_of desc);

-- ---------- RLS ----------
alter table public.weekly_adventures enable row level security;

drop policy if exists adventures_select on public.weekly_adventures;
create policy adventures_select on public.weekly_adventures for select to authenticated
  using (private.is_couple_member(couple_id, auth.uid()));

drop policy if exists adventures_insert on public.weekly_adventures;
create policy adventures_insert on public.weekly_adventures for insert to authenticated
  with check (
    private.is_couple_member(couple_id, auth.uid())
    and partner_a_done = false and partner_b_done = false
  );

drop policy if exists adventures_update on public.weekly_adventures;
create policy adventures_update on public.weekly_adventures for update to authenticated
  using (
    (partner_a_done = false and auth.uid() = (select partner_a_id from public.couples c where c.id = couple_id))
    or (partner_b_done = false and auth.uid() = (select partner_b_id from public.couples c where c.id = couple_id))
  )
  with check (private.is_couple_member(couple_id, auth.uid()));

-- ---------- privileges ----------
grant select, insert, update on public.weekly_adventures to authenticated;

-- ---------- RPC: claim this week's adventure (idempotent, fair rotation) ----------
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

  select * into offer from public.weekly_adventures
   where couple_id = my_couple and week_of = monday
   limit 1;
  if found then return offer; end if;

  -- Fair rotation: one adventure kind per week per couple, chosen
  -- deterministically from the couple id + week so both partners agree.
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
  returning * into offer;

  return offer;
end;
$$;

grant execute on function public.get_this_weeks_adventure() to authenticated;
revoke execute on function public.get_this_weeks_adventure() from public, anon;

-- ---------- RPC: mark my participation (one-way, server-enforced) ----------
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

grant execute on function public.complete_adventure_part(uuid, text) to authenticated;
revoke execute on function public.complete_adventure_part(uuid, text) from public, anon;
