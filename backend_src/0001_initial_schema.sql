-- ============================================================
-- Project Two — Migration 0001: schema, security, and functions
-- Portable: run against any fresh Supabase / Postgres project.
-- Design notes:
--   * Partner answers are invisible via the Data API until BOTH
--     partners have submitted (enforced in RLS, not client code).
--   * Pairing uses single-use expiring invitation codes consumed
--     atomically by a SECURITY DEFINER function.
--   * Companion state never punishes inactivity: affection only
--     grows with care actions and decays toward a calm baseline.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- tables ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  couple_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  partner_a_id uuid not null references public.profiles(id) on delete cascade,
  partner_b_id uuid references public.profiles(id) on delete cascade,
  anniversary date,
  created_at timestamptz not null default now(),
  constraint couples_two_max check (partner_a_id <> partner_b_id)
);

alter table public.profiles
  drop constraint if exists profiles_couple_fk;
alter table public.profiles
  add constraint profiles_couple_fk foreign key (couple_id) references public.couples(id) on delete set null;

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  couple_id uuid references public.couples(id) on delete cascade,
  expires_at timestamptz not null,
  consumed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.question_bank (
  id text primary key,
  category text not null,
  text text not null
);

create table if not exists public.daily_letters (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  letter_date date not null,
  question_id text references public.question_bank(id),
  question_text text not null,
  category text not null default 'Everyday',
  created_at timestamptz not null default now(),
  unique (couple_id, letter_date)
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references public.daily_letters(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  revealed_at timestamptz,
  unique (letter_id, author_id)
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.responses(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('heart','smile','spark')),
  created_at timestamptz not null default now(),
  unique (response_id, author_id)
);

create table if not exists public.pet_states (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  affection integer not null default 20 check (affection between 0 and 100),
  mood text not null default 'idle',
  last_interaction_at timestamptz not null default now(),
  last_watered_at timestamptz,
  last_sunlit_at timestamptz
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  note text not null default '',
  photo_uri text,
  memory_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  kind text not null,
  label text not null,
  achieved_at timestamptz not null default now()
);

create table if not exists public.mood_check_ins (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists responses_letter_idx on public.responses(letter_id);
create index if not exists letters_couple_date_idx on public.daily_letters(couple_id, letter_date desc);
create index if not exists memories_couple_idx on public.memories(couple_id, memory_date desc);

-- ---------- helpers ----------

create or replace function public.is_couple_member(p_couple uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $
  select exists (
    select 1 from public.couples c
    where c.id = p_couple and (c.partner_a_id = p_user or c.partner_b_id = p_user)
  );
$;

-- The caller's own couple id, resolved without reading profiles under RLS
-- (avoids recursive policy evaluation on the profiles table).
create or replace function public.my_couple_id()
returns uuid language sql stable security definer set search_path = public as $
  select couple_id from public.profiles where id = auth.uid();
$;

-- ---------- row level security ----------

alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.invitations enable row level security;
alter table public.question_bank enable row level security;
alter table public.daily_letters enable row level security;
alter table public.responses enable row level security;
alter table public.reactions enable row level security;
alter table public.pet_states enable row level security;
alter table public.memories enable row level security;
alter table public.milestones enable row level security;
alter table public.mood_check_ins enable row level security;

-- profiles: read only within your couple; write only your own row.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or couple_id = public.my_couple_id());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid() and couple_id = public.my_couple_id())
  with check (id = auth.uid() and couple_id = public.my_couple_id());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (id = auth.uid() and couple_id is null);

-- couples: members can see their own couple only.
drop policy if exists couples_select on public.couples;
create policy couples_select on public.couples for select to authenticated
  using (public.is_couple_member(id, auth.uid()));

drop policy if exists couples_update on public.couples;
create policy couples_update on public.couples for update to authenticated
  using (public.is_couple_member(id, auth.uid())) with check (public.is_couple_member(id, auth.uid()));

-- invitations: creator can read own; joining happens via RPC only.
drop policy if exists invitations_select on public.invitations;
create policy invitations_select on public.invitations for select to authenticated
  using (created_by = auth.uid());

drop policy if exists invitations_insert on public.invitations;
create policy invitations_insert on public.invitations for insert to authenticated
  with check (created_by = auth.uid());

-- question bank: readable by all authenticated users.
drop policy if exists question_bank_read on public.question_bank;
create policy question_bank_read on public.question_bank for select to authenticated using (true);

-- daily letters: couple members only.
drop policy if exists letters_select on public.daily_letters;
create policy letters_select on public.daily_letters for select to authenticated
  using (public.is_couple_member(couple_id, auth.uid()));

-- responses: THE critical rule.
--   * You always see your own row.
--   * You see your partner's row ONLY once BOTH of you have a row
--     for that letter (the reveal condition). Before that the row
--     is filtered out entirely — not just the body hidden.
drop policy if exists responses_select on public.responses;
create policy responses_select on public.responses for select to authenticated
  using (
    author_id = auth.uid()
    or (
      exists (
        select 1
        from public.responses mine
        join public.responses theirs
          on theirs.letter_id = mine.letter_id
         and theirs.author_id <> mine.author_id
        where mine.letter_id = responses.letter_id
          and mine.author_id = auth.uid()
      )
      and public.is_couple_member(
        (select couple_id from public.daily_letters l where l.id = responses.letter_id),
        auth.uid()
      )
    )
  );

drop policy if exists responses_insert on public.responses;
create policy responses_insert on public.responses for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_couple_member(
      (select couple_id from public.daily_letters l where l.id = responses.letter_id),
      auth.uid()
    )
  );

drop policy if exists responses_update on public.responses;
create policy responses_update on public.responses for update to authenticated
  using (author_id = auth.uid() and revealed_at is null)
  with check (author_id = auth.uid());

-- reactions: visible once the underlying response is visible.
drop policy if exists reactions_select on public.reactions;
create policy reactions_select on public.reactions for select to authenticated
  using (exists (select 1 from public.responses r where r.id = reactions.response_id));

drop policy if exists reactions_insert on public.reactions;
create policy reactions_insert on public.reactions for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.responses r
      join public.daily_letters l on l.id = r.letter_id
      where r.id = reactions.response_id
        and r.author_id <> auth.uid()
        and public.is_couple_member(l.couple_id, auth.uid())
    )
  );

-- pet states: shared by the couple, mutated only via RPC.
drop policy if exists pet_select on public.pet_states;
create policy pet_select on public.pet_states for select to authenticated
  using (public.is_couple_member(couple_id, auth.uid()));

-- memories: couple-wide read, author-scoped write.
drop policy if exists memories_select on public.memories;
create policy memories_select on public.memories for select to authenticated
  using (public.is_couple_member(couple_id, auth.uid()));

drop policy if exists memories_insert on public.memories;
create policy memories_insert on public.memories for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_couple_member(couple_id, auth.uid())
  );

drop policy if exists memories_update on public.memories;
create policy memories_update on public.memories for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

drop policy if exists memories_delete on public.memories;
create policy memories_delete on public.memories for delete to authenticated
  using (author_id = auth.uid());

-- milestones: couple read only.
drop policy if exists milestones_select on public.milestones;
create policy milestones_select on public.milestones for select to authenticated
  using (public.is_couple_member(couple_id, auth.uid()));

-- mood check-ins: explicitly shared with the partner.
drop policy if exists moods_select on public.mood_check_ins;
create policy moods_select on public.mood_check_ins for select to authenticated
  using (public.is_couple_member(couple_id, auth.uid()));

drop policy if exists moods_insert on public.mood_check_ins;
create policy moods_insert on public.mood_check_ins for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_couple_member(couple_id, auth.uid())
  );

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

-- Seed the question bank (idempotent, mirrors domain/questions.ts).
insert into public.question_bank (id, category, text) values
  ('q01','Everyday','What is one ordinary moment you would like to relive together?'),
  ('q02','Everyday','What tiny sound instantly makes you think of home?'),
  ('q03','Everyday','What is the most comforting smell you know?'),
  ('q04','Everyday','Which chair in our home is secretly the best one?'),
  ('q05','Everyday','What is your favorite hour of the whole day, and why?'),
  ('q06','Everyday','What small habit of mine do you find quietly charming?'),
  ('q07','Everyday','What is one thing you looked forward to this week?'),
  ('q08','Everyday','What is your ideal slow morning, step by step?'),
  ('q09','Everyday','Which meal tastes like celebration to you?'),
  ('q10','Everyday','What is one errand you would happily never do again?'),
  ('q11','Memory','What was the weather like on a day you will never forget?'),
  ('q12','Memory','What is the funniest thing you have ever overheard?'),
  ('q13','Memory','What childhood snack would you bring back for one day?'),
  ('q14','Memory','What was your first impression of me, in one sentence?'),
  ('q15','Memory','What song takes you straight back to being fifteen?'),
  ('q16','Memory','What is a trip you took that still visits you in dreams?'),
  ('q17','Memory','What is the kindest thing a stranger has done for you?'),
  ('q18','Memory','What is one object you own that carries a whole story?'),
  ('q19','Memory','Which photograph from your life deserves a frame?'),
  ('q20','Memory','What was the best day of this past year for you?'),
  ('q21','Dreams','If we vanished for a weekend, where should we reappear?'),
  ('q22','Dreams','What is a skill you would love us to learn together?'),
  ('q23','Dreams','What does our dream kitchen look like at 7 a.m.?'),
  ('q24','Dreams','What is one place you want to show me before anything else?'),
  ('q25','Dreams','What kind of old person do you hope we both become?'),
  ('q26','Dreams','If money were no object, what would tomorrow look like?'),
  ('q27','Dreams','What is a tradition you would like us to invent?'),
  ('q28','Dreams','What garden, real or imagined, would you love to keep?'),
  ('q29','Dreams','What project would you start if you knew you could not fail?'),
  ('q30','Dreams','What does a perfect ordinary Tuesday look like for us?'),
  ('q31','Us','What do you think we argue about that is secretly cute?'),
  ('q32','Us','When did you last feel proud of us as a team?'),
  ('q33','Us','What is something I do that deserves more thank-yous?'),
  ('q34','Us','What inside joke has aged the best between us?'),
  ('q35','Us','What is our best shared meal so far, and what made it so?'),
  ('q36','Us','What is one promise you would like to renew this year?'),
  ('q37','Us','What moment made you think: yes, this is my person?'),
  ('q38','Us','What should we do more of on Sunday evenings?'),
  ('q39','Us','What is something you want to ask me but keep forgetting?'),
  ('q40','Us','What small ritual of ours would you protect at all costs?'),
  ('q41','Tender','What do you need more of this week?'),
  ('q42','Tender','What is one worry you are carrying that I can help hold?'),
  ('q43','Tender','What does comfort feel like to you, physically?'),
  ('q44','Tender','When you are sad, what do you wish someone would do?'),
  ('q45','Tender','What is a kind thing you could say to yourself today?'),
  ('q46','Tender','What boundary are you proud of keeping lately?'),
  ('q47','Tender','What helps you fall asleep on a restless night?'),
  ('q48','Tender','What is something you forgave and never mentioned?'),
  ('q49','Tender','What do you hope I never stop telling you?'),
  ('q50','Tender','What is one small victory from this month?'),
  ('q51','Playful','If we were a two-person band, what are our instruments?'),
  ('q52','Playful','What animal would our companion be if it had a secret life?'),
  ('q53','Playful','What is the worst movie you secretly love?'),
  ('q54','Playful','If our home had one ridiculous rule, what should it be?'),
  ('q55','Playful','What superpower would be completely wasted on you?'),
  ('q56','Playful','What snack combination do you defend against all criticism?'),
  ('q57','Playful','What would our companion name us if it could talk?'),
  ('q58','Playful','What is your most irrational kitchen opinion?'),
  ('q59','Playful','Which fictional couple are we most like, honestly?'),
  ('q60','Playful','What is a talent you have that never gets an audience?'),
  ('q61','Senses','What is the most beautiful thing you saw this week?'),
  ('q62','Senses','Which season smells the best when it first arrives?'),
  ('q63','Senses','What texture makes you instantly calm?'),
  ('q64','Senses','What is the perfect temperature for a room?'),
  ('q65','Senses','What song should play during our next slow dance?'),
  ('q66','Senses','What is the best light of the day, morning or golden hour?'),
  ('q67','Senses','What is your favorite thing to hear first thing in the morning?'),
  ('q68','Senses','What taste reminds you of being loved?'),
  ('q69','Senses','What is the coziest thing you have ever worn?'),
  ('q70','Senses','What sound do you never want us to stop hearing?'),
  ('q71','Gratitude','Who deserves a thank-you note from you this week?'),
  ('q72','Gratitude','What part of your body deserves appreciation today?'),
  ('q73','Gratitude','What everyday luxury do you never want to take for granted?'),
  ('q74','Gratitude','What is one thing your younger self would be proud of?'),
  ('q75','Gratitude','What small kindness did you witness recently?'),
  ('q76','Gratitude','What tool or object in your life never lets you down?'),
  ('q77','Gratitude','What part of this week are you glad is over?'),
  ('q78','Gratitude','What is something you got for free that changed your day?'),
  ('q79','Gratitude','Who taught you something you still use every day?'),
  ('q80','Gratitude','What are three tiny things that went right today?'),
  ('q81','Future','What is one habit you want us to build before winter?'),
  ('q82','Future','What should our home feel like five years from now?'),
  ('q83','Future','What trip are we taking in the next two years?'),
  ('q84','Future','What do you hope we laugh about a decade from now?'),
  ('q85','Future','What is one thing to finally stop postponing?'),
  ('q86','Future','What would make next month a success for you?'),
  ('q87','Future','What tradition from your family should we carry forward?'),
  ('q88','Future','What is a letter you want to write to your future self?'),
  ('q89','Future','What should we celebrate that we have not yet?'),
  ('q90','Future','What is one word you want to define our next chapter?')
on conflict (id) do nothing;

-- ---------- companion care (server-side, non-punitive) ----------

create or replace function public.care_for_companion(p_kind text)
returns public.pet_states language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  my_couple uuid;
  st public.pet_states;
  gain int;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select couple_id into my_couple from public.profiles where id = me;
  if my_couple is null then raise exception 'no couple'; end if;
  if p_kind not in ('water','sunlight','play') then raise exception 'invalid care kind'; end if;

  gain := case p_kind when 'play' then 6 else 4 end;

  insert into public.pet_states (couple_id) values (my_couple)
  on conflict (couple_id) do nothing;

  update public.pet_states set
    affection = least(100, affection + gain),
    mood = 'delighted',
    last_interaction_at = now(),
    last_watered_at = case when p_kind = 'water' then now() else last_watered_at end,
    last_sunlit_at = case when p_kind = 'sunlight' then now() else last_sunlit_at end
  where couple_id = my_couple
  returning * into st;

  return st;
end;
$$;

-- ---------- stats, export, deletion ----------

create or replace function public.get_couple_stats()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'letters_completed', (
      select count(*) from public.daily_letters l
      where l.couple_id = (select couple_id from public.profiles where id = auth.uid())
        and 2 = (select count(distinct r.author_id) from public.responses r where r.letter_id = l.id)
    ),
    'memories_count', (
      select count(*) from public.memories m
      where m.couple_id = (select couple_id from public.profiles where id = auth.uid())
    ),
    'days_together', coalesce((
      select current_date - c.anniversary from public.couples c
      where c.id = (select couple_id from public.profiles where id = auth.uid())
        and c.anniversary is not null
    ), 0)
  );
$$;

create or replace function public.export_my_data()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'profile', (select to_json(p) from public.profiles p where p.id = auth.uid()),
    'letters', (select coalesce(json_agg(to_json(l)), '[]'::json) from public.daily_letters l
                where l.couple_id = (select couple_id from public.profiles where id = auth.uid())),
    'responses', (select coalesce(json_agg(to_json(r)), '[]'::json) from public.responses r where r.author_id = auth.uid()),
    'memories', (select coalesce(json_agg(to_json(m)), '[]'::json) from public.memories m where m.author_id = auth.uid()),
    'moods', (select coalesce(json_agg(to_json(mc)), '[]'::json) from public.mood_check_ins mc where mc.author_id = auth.uid())
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
$;

-- ---------- function access ----------
-- Every SECURITY DEFINER function is a public endpoint by default in
-- Postgres. Restrict them all to authenticated sessions; the anon role
-- (unauthenticated Data API traffic) gets nothing.

revoke execute on function public.is_couple_member(uuid, uuid) from public, anon;
revoke execute on function public.my_couple_id() from public, anon;
revoke execute on function public.create_my_invitation() from public, anon;
revoke execute on function public.join_couple_with_code(text) from public, anon;
revoke execute on function public.unlink_partner() from public, anon;
revoke execute on function public.get_or_create_today_letter() from public, anon;
revoke execute on function public.care_for_companion(text) from public, anon;
revoke execute on function public.get_couple_stats() from public, anon;
revoke execute on function public.export_my_data() from public, anon;
revoke execute on function public.delete_my_account() from public, anon;

grant execute on function public.is_couple_member(uuid, uuid) to authenticated;
grant execute on function public.my_couple_id() to authenticated;
grant execute on function public.create_my_invitation() to authenticated;
grant execute on function public.join_couple_with_code(text) to authenticated;
grant execute on function public.unlink_partner() to authenticated;
grant execute on function public.get_or_create_today_letter() to authenticated;
grant execute on function public.care_for_companion(text) to authenticated;
grant execute on function public.get_couple_stats() to authenticated;
grant execute on function public.export_my_data() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
