-- ---------- table privileges ----------
-- RLS filters rows; the calling role must also hold DML grants.
grant usage on schema public to anon, authenticated, service_role;
grant select on public.question_bank to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.couples to authenticated;
grant select on public.invitations to authenticated;
grant select, insert, update, delete on public.daily_letters to authenticated;
grant select, insert, update, delete on public.responses to authenticated;
grant select, insert on public.reactions to authenticated;
grant select on public.pet_states to authenticated;
grant select, insert, update, delete on public.memories to authenticated;
grant select on public.milestones to authenticated;
grant select, insert on public.mood_check_ins to authenticated;
grant select, insert on public.pocket_notes to authenticated;
-- anon (logged out) can read the question bank only.
grant select on public.question_bank to anon;

-- pocket notes: the recipient may set read_at only — every other column is
-- write-protected at the privilege level, independent of RLS.
grant update (read_at) on public.pocket_notes to authenticated;

-- ---------- helper EXECUTE ----------
-- private schema is not exposed through the Data API, so clients cannot call
-- these directly; authenticated needs EXECUTE for policy evaluation only.
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_couple_member(uuid, uuid) to authenticated, service_role;
grant execute on function private.my_couple_id() to authenticated, service_role;
grant execute on function private.both_partners_answered(uuid, uuid) to authenticated, service_role;

-- ---------- user-facing RPCs: authenticated only ----------
revoke execute on function public.create_my_invitation() from public, anon;
revoke execute on function public.join_couple_with_code(text) from public, anon;
revoke execute on function public.unlink_partner() from public, anon;
revoke execute on function public.get_or_create_today_letter() from public, anon;
revoke execute on function public.care_for_companion(text) from public, anon;
revoke execute on function public.get_couple_stats() from public, anon;
revoke execute on function public.export_my_data() from public, anon;
revoke execute on function public.delete_my_account() from public, anon;

grant execute on function public.create_my_invitation() to authenticated;
grant execute on function public.join_couple_with_code(text) to authenticated;
grant execute on function public.unlink_partner() to authenticated;
grant execute on function public.get_or_create_today_letter() to authenticated;
grant execute on function public.care_for_companion(text) to authenticated;
grant execute on function public.get_couple_stats() to authenticated;
grant execute on function public.export_my_data() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
