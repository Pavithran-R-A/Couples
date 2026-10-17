-- ---------- internal RLS helpers (private schema) ----------
-- Not exposed through the Data API (Supabase exposes only public / storage).
-- Each function pins a safe search_path and schema-qualifies every
-- reference, so nothing can be hijacked through the search path.

create or replace function private.is_couple_member(p_couple uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1 from public.couples c
    where c.id = p_couple and (c.partner_a_id = p_user or c.partner_b_id = p_user)
  );
$$;

create or replace function private.my_couple_id()
returns uuid language sql stable security definer set search_path = public, private as $$
  select couple_id from public.profiles where id = auth.uid();
$$;

create or replace function private.both_partners_answered(p_letter uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select (
    select count(distinct author_id) = 2
    from public.responses
    where letter_id = p_letter
      and author_id in (
        p_user,
        (select case when c.partner_a_id = p_user then c.partner_b_id else c.partner_a_id end
         from public.profiles p
         join public.couples c on c.id = p.couple_id
         where p.id = p_user
           and p_user in (c.partner_a_id, c.partner_b_id))
      )
  );
$$;

revoke all on schema private from public, anon;
grant usage on schema private to postgres, service_role;
