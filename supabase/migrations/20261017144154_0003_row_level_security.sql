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
alter table public.pocket_notes enable row level security;

-- profiles: own row always; partner's row readable. couple_id changes only
-- through the SECURITY DEFINER pairing RPCs; own-row updates must keep it.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or couple_id = private.my_couple_id());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and couple_id = (select couple_id from public.profiles where id = auth.uid()));

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (id = auth.uid() and couple_id is null);

-- couples: members can see their own couple only.
drop policy if exists couples_select on public.couples;
create policy couples_select on public.couples for select to authenticated
  using (private.is_couple_member(id, auth.uid()));

-- couples: NO client-side UPDATE policy. Partner IDs and membership change
-- only through the SECURITY DEFINER pairing RPCs.

-- invitations: creator reads own; NO client INSERT policy — codes are
-- minted exclusively by create_my_invitation().
drop policy if exists invitations_select on public.invitations;
create policy invitations_select on public.invitations for select to authenticated
  using (created_by = auth.uid());

-- question bank: readable by all authenticated users.
drop policy if exists question_bank_read on public.question_bank;
create policy question_bank_read on public.question_bank for select to authenticated using (true);

-- daily letters: couple members only.
drop policy if exists letters_select on public.daily_letters;
create policy letters_select on public.daily_letters for select to authenticated
  using (private.is_couple_member(couple_id, auth.uid()));

-- responses: the critical reveal rule. Own row always; partner's row only
-- once BOTH partners have answered that letter, and only inside the couple.
drop policy if exists responses_select on public.responses;
create policy responses_select on public.responses for select to authenticated
  using (
    author_id = auth.uid()
    or (
      private.both_partners_answered(responses.letter_id, auth.uid())
      and private.is_couple_member(
        (select couple_id from public.daily_letters l where l.id = responses.letter_id),
        auth.uid()
      )
    )
  );

drop policy if exists responses_insert on public.responses;
create policy responses_insert on public.responses for insert to authenticated
  with check (
    author_id = auth.uid()
    and private.is_couple_member(
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
        and private.is_couple_member(l.couple_id, auth.uid())
    )
  );

-- pet states: shared by the couple.
drop policy if exists pet_select on public.pet_states;
create policy pet_select on public.pet_states for select to authenticated
  using (private.is_couple_member(couple_id, auth.uid()));

-- memories: couple-wide read, author-scoped write.
drop policy if exists memories_select on public.memories;
create policy memories_select on public.memories for select to authenticated
  using (private.is_couple_member(couple_id, auth.uid()));

drop policy if exists memories_insert on public.memories;
create policy memories_insert on public.memories for insert to authenticated
  with check (
    author_id = auth.uid()
    and private.is_couple_member(couple_id, auth.uid())
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
  using (private.is_couple_member(couple_id, auth.uid()));

-- mood check-ins: explicitly shared with the partner.
drop policy if exists moods_select on public.mood_check_ins;
create policy moods_select on public.mood_check_ins for select to authenticated
  using (private.is_couple_member(couple_id, auth.uid()));

drop policy if exists moods_insert on public.mood_check_ins;
create policy moods_insert on public.mood_check_ins for insert to authenticated
  with check (
    author_id = auth.uid()
    and private.is_couple_member(couple_id, auth.uid())
  );

-- pocket notes: couple-wide read, author-scoped insert; only the recipient
-- may mark read, restricted to the read_at column by the table-level grant.
drop policy if exists pocket_notes_select on public.pocket_notes;
create policy pocket_notes_select on public.pocket_notes for select to authenticated
  using (private.is_couple_member(couple_id, auth.uid()));

drop policy if exists pocket_notes_insert on public.pocket_notes;
create policy pocket_notes_insert on public.pocket_notes for insert to authenticated
  with check (
    author_id = auth.uid()
    and private.is_couple_member(couple_id, auth.uid())
  );

drop policy if exists pocket_notes_update_read on public.pocket_notes;
create policy pocket_notes_update_read on public.pocket_notes for update to authenticated
  using (
    author_id <> auth.uid()
    and private.is_couple_member(couple_id, auth.uid())
  )
  with check (
    author_id <> auth.uid()
    and private.is_couple_member(couple_id, auth.uid())
  );
