-- Corrective: align hosted schema with the application contract
-- (domain/types.ts + repositories). Applied 2026-10-17; see
-- backend_src/0001_initial_schema.sql for the canonical reference.
alter table public.pet_states rename column warmth to affection;
alter table public.pet_states rename column last_care to last_interaction_at;
alter table public.pet_states add column if not exists last_watered_at timestamptz;
alter table public.pet_states add column if not exists last_sunlit_at timestamptz;
alter table public.pet_states drop column if exists updated_at;
alter table public.pet_states drop constraint if exists pet_states_mood_check;
alter table public.pet_states alter column mood drop default;
alter table public.pet_states alter column mood set default 'idle';
alter table public.pet_states alter column affection set default 20;
alter table public.pet_states drop constraint if exists pet_states_affection_range;
alter table public.pet_states add constraint pet_states_affection_range check (affection between 0 and 100);

alter table public.memories rename column body to note;
alter table public.memories rename column happened_on to memory_date;
alter table public.memories add column if not exists photo_uri text;
alter table public.memories alter column memory_date set default current_date;

alter table public.milestones rename column created_at to achieved_at;
alter table public.milestones drop column if exists letter_id;
alter table public.milestones drop constraint if exists milestones_kind_check;

-- 90-prompt canonical question bank
delete from public.question_bank where id in ('q1','q2','q3','q4','q5','q6','q7','q8','q9','q10');
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

-- ---------- profile creation on signup ----------
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

grant execute on function private.handle_new_user() to service_role, supabase_auth_admin;
