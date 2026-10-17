-- ---------- atomic pairing ----------

-- Create an invitation for the caller (one active at a time).
create or replace function public.create_my_invitation()
returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  my_couple uuid;
  new_code text;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select couple_id into my_couple from public.profiles where id = me;
  if my_couple is not null and exists (
    select 1 from public.couples where id = my_couple and partner_b_id is not null
  ) then
    raise exception 'already in a complete couple';
  end if;

  loop
    new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      insert into public.invitations (code, created_by, couple_id, expires_at)
      values (new_code, me, my_couple, now() + interval '7 days');
      exit;
    exception when unique_violation then
      continue;
    end;
  end loop;
  return new_code;
end;
$$;

-- Join with a code: atomic, single-use, expiring, max two members.
create or replace function public.join_couple_with_code(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  inv public.invitations%rowtype;
  new_couple uuid;
begin
  if me is null then return false; end if;

  select * into inv from public.invitations
   where upper(code) = upper(p_code)
     and consumed = false
     and expires_at > now()
   for update;
  if not found then return false; end if;

  select couple_id into new_couple from public.profiles where id = me;
  if new_couple is not null then return false; end if; -- already paired

  if inv.couple_id is null then
    -- Creator had no couple yet: create one now with creator as partner A.
    insert into public.couples (partner_a_id) values (inv.created_by) returning id into new_couple;
    update public.profiles set couple_id = new_couple where id = inv.created_by;
    insert into public.pet_states (couple_id) values (new_couple) on conflict do nothing;
  else
    new_couple := inv.couple_id;
    if exists (select 1 from public.couples where id = new_couple and partner_b_id is not null) then
      return false; -- couple already complete
    end if;
  end if;

  update public.couples set partner_b_id = me where id = new_couple and partner_b_id is null;
  if not found then return false; end if;

  update public.profiles set couple_id = new_couple where id = me;
  update public.invitations set consumed = true where id = inv.id;
  return true;
end;
$$;

-- Unlink: clears the couple for both partners, keeps data intact.
create or replace function public.unlink_partner()
returns boolean language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  my_couple uuid;
begin
  if me is null then return false; end if;
  select couple_id into my_couple from public.profiles where id = me;
  if my_couple is null then return false; end if;
  update public.profiles set couple_id = null where couple_id = my_couple;
  delete from public.pet_states where couple_id = my_couple;
  delete from public.couples where id = my_couple;
  return true;
end;
$$;

-- ---------- daily letter ----------

create or replace function public.get_or_create_today_letter()
returns table (letter_id uuid, question_id text, question_text text, category text)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  my_couple uuid;
  today date := current_date;
  existing record;
  picked record;
begin
  if me is null then return; end if;
  select couple_id into my_couple from public.profiles where id = me;
  if my_couple is null then return; end if;

  select * into existing from public.daily_letters
   where couple_id = my_couple and letter_date = today;
  if found then
    return query select existing.id, existing.question_id, existing.question_text, existing.category;
    return;
  end if;

  -- Deterministic rotation through the question bank per couple per day.
  select * into picked from public.question_bank
   order by hashtext(my_couple::text || today::text || id)
   limit 1;

  insert into public.daily_letters (couple_id, letter_date, question_id, question_text, category)
  values (
    my_couple, today, picked.id,
    coalesce(picked.text, 'What small moment from today is worth keeping?'),
    coalesce(picked.category, 'Everyday')
  )
  on conflict (couple_id, letter_date) do nothing
  returning * into existing;

  if existing is null then
    select * into existing from public.daily_letters where couple_id = my_couple and letter_date = today;
  end if;

  return query select existing.id, existing.question_id, existing.question_text, existing.category;
end;
$$;

-- ---------- companion ----------

create or replace function public.care_for_companion(p_kind text)
returns public.pet_states language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  my_couple uuid;
  st public.pet_states;
  delta integer;
  cooldown interval;
  now_ts timestamptz := now();
begin
  if me is null then raise exception 'not authenticated'; end if;
  select couple_id into my_couple from public.profiles where id = me;
  if my_couple is null then raise exception 'no couple'; end if;

  select * into st from public.pet_states where couple_id = my_couple for update;
  if not found then
    insert into public.pet_states (couple_id) values (my_couple) returning * into st;
  end if;

  case p_kind
    when 'water'   then delta := 4;  cooldown := interval '4 hours';
    when 'sunlight' then delta := 6; cooldown := interval '8 hours';
    when 'play'    then delta := 3;  cooldown := interval '2 hours';
    else raise exception 'unknown care kind';
  end case;

  if st.last_care is not null and now_ts - st.last_care < cooldown then
    raise exception 'care on cooldown';
  end if;

  update public.pet_states
     set warmth = least(100, st.warmth + delta),
         mood = case
                  when p_kind = 'play' then 'playful'
                  when p_kind = 'sunlight' then 'delighted'
                  else 'settled'
                end,
         last_care = now_ts,
         updated_at = now_ts
   where couple_id = my_couple
   returning * into st;

  return st;
end;
$$;

-- ---------- stats / export / delete ----------

create or replace function public.get_couple_stats()
returns json language sql stable security definer set search_path = public, private as $$
  select json_build_object(
    'letters', (select count(*) from public.daily_letters l
                 where l.couple_id = private.my_couple_id()),
    'responses', (select count(*) from public.responses r
                   join public.daily_letters l on l.id = r.letter_id
                   where l.couple_id = private.my_couple_id()),
    'revealed', (select count(*) from public.responses r
                  join public.daily_letters l on l.id = r.letter_id
                  where l.couple_id = private.my_couple_id() and r.revealed_at is not null),
    'memories', (select count(*) from public.memories m
                  where m.couple_id = private.my_couple_id()),
    'moods', (select count(*) from public.mood_check_ins mc
               where mc.couple_id = private.my_couple_id())
  );
$$;

create or replace function public.export_my_data()
returns json language sql stable security definer set search_path = public, private as $$
  select json_build_object(
    'profile', (select to_json(p) from public.profiles p where p.id = auth.uid()),
    'letters', (select coalesce(json_agg(to_json(l)), '[]'::json) from public.daily_letters l
                where l.couple_id = (select couple_id from public.profiles where id = auth.uid())),
    'responses', (select coalesce(json_agg(to_json(r)), '[]'::json) from public.responses r where r.author_id = auth.uid()),
    'memories', (select coalesce(json_agg(to_json(m)), '[]'::json) from public.memories m where m.author_id = auth.uid()),
    'moods', (select coalesce(json_agg(to_json(mc)), '[]'::json) from public.mood_check_ins mc where mc.author_id = auth.uid()),
    'pocket_notes', (select coalesce(json_agg(to_json(pn)), '[]'::json) from public.pocket_notes pn where pn.author_id = auth.uid())
  );
$$;

create or replace function public.delete_my_account()
returns boolean language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then return false; end if;
  -- All app data cascades via foreign keys; the auth user goes last.
  delete from auth.users where id = me;
  return true;
end;
$$;
