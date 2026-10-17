-- ---------- tables ----------
create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  partner_a_id uuid not null references auth.users(id) on delete cascade,
  partner_b_id uuid references auth.users(id) on delete cascade,
  anniversary date,
  created_at timestamptz not null default now(),
  constraint couples_distinct_partners check (partner_a_id <> partner_b_id)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  couple_id uuid references public.couples(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  consumed boolean not null default false,
  expires_at timestamptz not null,
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
  question_id text not null,
  question_text text not null,
  category text not null,
  unique (couple_id, letter_date)
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references public.daily_letters(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) <= 4000),
  created_at timestamptz not null default now(),
  revealed_at timestamptz,
  unique (letter_id, author_id)
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.responses(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('heart','sparkle','smile','tear','hug')),
  created_at timestamptz not null default now(),
  unique (response_id, author_id)
);

create table if not exists public.pet_states (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  name text not null default 'Lumi',
  warmth integer not null default 40 check (warmth between 0 and 100),
  mood text not null default 'settled' check (mood in ('settled','playful','sleepy','delighted','wistful')),
  last_care timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) <= 120),
  body text not null check (char_length(body) <= 2000),
  happened_on date,
  created_at timestamptz not null default now()
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  kind text not null check (kind in ('first_letter','both_replied','reveal','anniversary')),
  label text not null,
  letter_id uuid references public.daily_letters(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.mood_check_ins (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);

create table if not exists public.pocket_notes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

insert into public.question_bank (id, category, text) values
  ('q1','Everyday','What small moment from today is worth keeping?'),
  ('q2','Everyday','What made you smile today, even for a second?'),
  ('q3','Memory','What is a sound that instantly takes you back to us?'),
  ('q4','Memory','Describe a place you want us to return to together.'),
  ('q5','Dreams','If we could leave next Friday anywhere, where would you take us?'),
  ('q6','Dreams','What is something new you want us to try this month?'),
  ('q7','Senses','What scent feels like home to you?'),
  ('q8','Senses','What song should play during our next slow dance?'),
  ('q9','Gratitude','What did I do recently that you appreciated but maybe never mentioned?'),
  ('q10','Gratitude','What everyday luxury do you never want to take for granted?')
on conflict (id) do nothing;

-- ---------- indexes ----------
create index if not exists idx_letters_couple_date on public.daily_letters (couple_id, letter_date desc);
create index if not exists idx_responses_letter on public.responses (letter_id);
create index if not exists idx_reactions_response on public.reactions (response_id);
create index if not exists idx_memories_couple on public.memories (couple_id, created_at desc);
create index if not exists idx_moods_couple on public.mood_check_ins (couple_id, created_at desc);
create index if not exists idx_pocket_notes_couple on public.pocket_notes (couple_id, created_at desc);
