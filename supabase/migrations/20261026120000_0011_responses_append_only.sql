-- ==========================================================================
-- 0011 responses append-only
-- ==========================================================================
-- A partner may submit exactly one final answer per daily letter, and once
-- written it cannot be modified or removed through the client.
--
-- Before this migration three surfaces allowed mutation:
--   * 0006 granted UPDATE (and an unused DELETE) on responses to
--     authenticated;
--   * 0003's responses_update policy allowed the author to rewrite the body
--     whenever revealed_at was null — and nothing ever stamped revealed_at,
--     so that gate never closed;
--   * the client used .upsert(), silently overwriting the original body.
--
-- This migration removes the client UPDATE/DELETE surface entirely, stamps
-- revealed_at server-side the moment both partners have answered, and
-- backfills the stamp for pairs completed earlier. Row visibility keeps
-- using the live both_partners_answered rule from 0003, so existing data
-- stays exactly as visible as before — the stamp is bookkeeping, not the
-- privacy gate.
--
-- The stamping function lives in the private schema (never exposed through
-- the Data API), uses a restricted search_path and fully qualified object
-- references, following current Supabase guidance for privileged functions.
-- ==========================================================================

-- 1. No client can modify or remove an answer once written. RLS had no
-- delete policy (already denied), but the privilege itself was dead attack
-- surface; UPDATE had a live policy that this migration removes together
-- with the grant.
drop policy if exists responses_update on public.responses;
revoke update on public.responses from authenticated;
revoke delete on public.responses from authenticated;

-- 2. Trusted reveal stamping. SECURITY DEFINER is justified because after
-- (1) the inserting client holds no UPDATE privilege at all, yet the pair
-- must be stamped atomically with the second insert; a SECURITY INVOKER
-- trigger would fail. Guardrails:
--   * lives in the private schema, which the Data API does not expose, so
--     the function is not callable, let alone listable, from any client;
--   * invoked only by the AFTER INSERT trigger — EXECUTE is revoked from
--     public/anon/authenticated (trigger invocation does not require
--     EXECUTE), so even a direct SQL call is permission-denied;
--   * restricted search_path plus fully qualified references — a hijacked
--     or attacker-controlled search path cannot redirect privileged
--     execution to a hostile object;
--   * validates that the letter exists and the author is one of its
--     couple's two partners; it trusts nothing about the caller beyond
--     what RLS already enforced on the INSERT;
--   * touches only revealed_at, only on rows of that one letter, and only
--     while null, so re-entry is a no-op;
--   * an xact-scoped advisory lock serializes the two concurrent first
--     inserts (the same pattern as 0009), so the race where both
--     transactions see only one row cannot leave the pair unstamped;
--   * the trigger runs inside the inserting transaction: insert + stamp
--     commit together or not at all. No client clock or client-provided
--     value is involved.
create or replace function private.stamp_response_reveal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_couple uuid;
begin
  select l.couple_id into v_couple
    from public.daily_letters l
   where l.id = new.letter_id;
  if v_couple is null then
    raise exception 'responses: letter % does not exist', new.letter_id;
  end if;
  if not private.is_couple_member(v_couple, new.author_id) then
    raise exception 'responses: author is not a member of the letter couple';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('response_reveal' || new.letter_id::text)
  );

  update public.responses r
     set revealed_at = pg_catalog.now()
   where r.letter_id = new.letter_id
     and r.revealed_at is null
     and (select pg_catalog.count(*) from public.responses c
           where c.letter_id = new.letter_id) >= 2;
  return new;
end;
$$;

revoke execute on function private.stamp_response_reveal() from public, anon, authenticated;

drop trigger if exists responses_reveal_stamp on public.responses;
create trigger responses_reveal_stamp
  after insert on public.responses
  for each row execute function private.stamp_response_reveal();

-- 3. Backfill: pairs that completed before this migration get their stamp.
-- Visibility never depended on the column, so this only aligns stored state;
-- already-stamped rows are untouched (coalesce guards). Idempotent on rerun.
update public.responses r
   set revealed_at = coalesce(r.revealed_at, pg_catalog.now())
 where r.revealed_at is null
   and (select count(*) from public.responses c
         where c.letter_id = r.letter_id) >= 2;
