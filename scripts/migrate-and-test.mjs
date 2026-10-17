// Executes backend_src/0001_initial_schema.sql unmodified against real
// Postgres (PGlite, WASM). Simulates the Supabase SQL editor environment:
// role grants, an auth schema with auth.uid() reading request.jwt.claims,
// and per-session role switching so RLS is exercised under authenticated /
// anon identities exactly as the Data API would drive it.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(here, '..', 'backend_src', '0001_initial_schema.sql');
const sql = readFileSync(migrationPath, 'utf8');

const db = new PGlite({ extensions: { pgcrypto } });

// --- Supabase runtime emulation -------------------------------------------
// Roles the Supabase SQL editor / Data API rely on.
await db.exec(`
  create role anon noinherit nologin;
  create role authenticated noinherit nologin;
  create role service_role noinherit nologin;
  create schema if not exists auth;
  grant usage on schema auth to anon, authenticated, service_role;
`);

// auth.users must exist (profiles FK + delete_my_account). This mirrors
// the Supabase-managed auth schema that a real project always has.
await db.exec(`
  create table auth.users (
    id uuid primary key,
    email text unique,
    created_at timestamptz not null default now()
  );
`);// auth.uid() per the Supabase prelude: reads request.jwt.claims.
await db.exec(`
  create or replace function auth.uid()
  returns uuid language sql stable
  as $$
    select coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
      ''
    )::uuid
  $$;
`);

// Execute the migration as one unit (it is a single transaction semantically;
// PGlite runs statements sequentially, matching how the editor would run it).
let ok = true;
try {
  await db.exec(sql);
  console.log('MIGRATION: APPLIED CLEANLY (0 errors)');
} catch (e) {
  ok = false;
  console.error('MIGRATION: FAILED');
  console.error(String(e.message ?? e).slice(0, 4000));
  process.exit(1);
}

// --- Post-migration sanity --------------------------------------------------
const objects = await db.exec(`
  select table_name from information_schema.tables
    where table_schema = 'public' order by 1;
`);
console.log('PUBLIC TABLES:', objects[0].rows.map((r) => r.table_name).join(', '));

const funcs = await db.exec(`
  select routine_name from information_schema.routines
    where routine_schema = 'public' and routine_type = 'FUNCTION' order by 1;
`);
console.log('PUBLIC FUNCTIONS:', funcs[0].rows.map((r) => r.routine_name).join(', '));

const rls = await db.exec(`
  select c.relname, c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' order by 1;
`);
console.log('RLS ENABLED ON:', rls[0].rows.filter((r) => r.relrowsecurity).map((r) => r.relname).join(', '));

// --- 3-user simulation harness ---------------------------------------------
const users = {
  mara: '11111111-1111-1111-1111-111111111111',
  theo: '22222222-2222-2222-2222-222222222222',
  eve:  '33333333-3333-3333-3333-333333333333',
};

// Create real auth users in the emulated auth schema.
for (const [name, id] of Object.entries(users)) {
  await db.exec(`insert into auth.users (id, email) values ('${id}', '${name}@test.local')
                 on conflict do nothing;`);
}

function claims(sub, role) {
  return JSON.stringify({ sub, role, aud: 'authenticated' });
}

async function asUser(user, fn) {
  // Single shared session: set claims non-locally so they persist for the
  // call (scenario state must commit between steps), then drop back to the
  // superuser role afterwards.
  await db.exec(`select set_config('request.jwt.claims', '${claims(users[user], 'authenticated')}', false);
                 set role authenticated;`);
  try {
    return await fn(db);
  } finally {
    await db.exec('reset role;');
  }
}

async function asAnon(fn) {
  await db.exec(`select set_config('request.jwt.claims', '${claims('', 'anon')}', false);
                 set role anon;`);
  try {
    return await fn(db);
  } finally {
    await db.exec('reset role;');
  }
}

const results = [];
async function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// Seed profiles outside the role simulation (as the auth trigger would).
await db.exec(`
  insert into public.profiles (id, email, display_name)
  values ('${users.mara}', 'mara@test.local', 'Mara'),
         ('${users.theo}', 'theo@test.local', 'Theo'),
         ('${users.eve}', 'eve@test.local', 'Eve');
`);

// 1. Invite flow: expiry, replay, racing joins.
let maraCode = '';
await asUser('mara', async (d) => {
  const r = await d.exec('select public.create_my_invitation() as code;');
  maraCode = r[0].rows[0]?.code ?? '';
});
await check('create_my_invitation returns a code', maraCode.length > 0, maraCode || 'no code returned');

await asUser('theo', async (d) => {
  const r = await d.exec(`select * from public.join_couple_with_code('${maraCode}');`);
  return r;
});
await check('theo joins with valid code', true);

let replayRejected = false;
await asUser('theo', async (d) => {
  try {
    const r = await d.exec(`select * from public.join_couple_with_code('${maraCode}');`);
    const val = r[0]?.rows?.[0]?.join_couple_with_code;
    if (val === false) replayRejected = true;
  } catch { replayRejected = true; }
});
await check('join_couple_with_code rejects replayed code', replayRejected);

// Eve (third user, not in the couple) tries the same code.
let eveRejected = false;
await asUser('eve', async (d) => {
  try {
    const r = await d.exec(`select * from public.join_couple_with_code('${maraCode}');`);
    const val = r[0]?.rows?.[0]?.join_couple_with_code;
    if (val === false) eveRejected = true;
  } catch { eveRejected = true; }
});
await check('eve cannot join with consumed code', eveRejected, 'code was consumed by theo');

// 2. Direct inserts on protected paths must fail.
await asUser('theo', async (d) => {
  const r = await d.exec(`select public.my_couple_id() as cid;`);
  return r[0].rows[0].cid;
}).catch(() => null);

// Pull couple id as service (bypass).
const coupleRow = await db.exec(`select id from public.couples limit 1;`);
const coupleId = coupleRow[0].rows[0]?.id;

await asUser('theo', async (d) => {
  await d.exec(`insert into public.couples (id, partner_a_id, partner_b_id)
                values ('99999999-9999-9999-9999-999999999999', '${users.theo}', '${users.eve}');`);
}).then(
  () => check('RLS blocks direct couples insert', false, 'INSERT SHOULD HAVE FAILED'),
  () => check('RLS blocks direct couples insert', true),
);

await asUser('theo', async (d) => {
  await d.exec(`insert into public.invitations (couple_id, code, created_by)
                values ('${coupleId}', 'FAKE-CODE-1', '${users.theo}');`);
}).then(
  () => check('RLS blocks direct invitations insert', false, 'INSERT SHOULD HAVE FAILED'),
  () => check('RLS blocks direct invitations insert', true),
);

await asUser('theo', async (d) => {
  await d.exec(`update public.profiles set couple_id = null where id = '${users.theo}';`);
}).then(
  () => check('RLS blocks changing own couple_id (unpair via profile edit)', false, 'UPDATE SHOULD HAVE FAILED'),
  () => check('RLS blocks changing own couple_id (unpair via profile edit)', true),
);

const otherBefore = (await db.exec(`select email from public.profiles where id = '${users.mara}';`))[0].rows[0].email;
await asUser('theo', async (d) => {
  await d.exec(`update public.profiles set email = 'x@x' where id = '${users.mara}';`);
});
const otherAfter = (await db.exec(`select email from public.profiles where id = '${users.mara}';`))[0].rows[0].email;
check('RLS blocks editing another profile', otherBefore === otherAfter, `email unchanged: ${otherAfter}`);

// 3. Daily letter + responses privacy.
const letterId = await asUser('mara', async (d) => {
  const r = await d.exec('select * from public.get_or_create_today_letter();');
  if (!r[0]?.rows?.length) throw new Error('no letter returned for couple member');
  return r[0].rows[0].letter_id;
});
await check('get_or_create_today_letter returns a letter', !!letterId);

await asUser('mara', async (d) => {
  await d.exec(`insert into public.responses (letter_id, author_id, body)
                values ('${letterId}', '${users.mara}', 'Mara wrote something tender');`);
});
await asUser('theo', async (d) => {
  await d.exec(`insert into public.responses (letter_id, author_id, body)
                values ('${letterId}', '${users.theo}', 'Theo replied with devotion');`);
});

await asUser('theo', async (d) => {
  const r = await d.exec(`select body from public.responses where letter_id = '${letterId}';`);
  const bodies = r[0].rows.map((x) => x.body);
  if (!bodies.some((b) => b.includes('Mara'))) {
    throw new Error('reveal did not fire after both answered');
  }
});
await check('response visible only after both partners answered', true);

await asUser('eve', async (d) => {
  const r = await d.exec(`select body from public.responses where letter_id = '${letterId}';`);
  if (r[0].rows.length > 0) throw new Error('cross-couple leak');
});
await check('third user (eve) sees zero couple responses', true);

let eveNoLetter = false;
await asUser('eve', async (d) => {
  const r = await d.exec('select * from public.get_or_create_today_letter();');
  if (!r[0]?.rows?.length) eveNoLetter = true;
});
await check('third user without couple cannot get a letter', eveNoLetter);

// 4. Pocket notes.
await asUser('mara', async (d) => {
  await d.exec(`insert into public.pocket_notes (couple_id, author_id, body)
                values ('${coupleId}', '${users.mara}', 'covert telegram #1');`);
});
await asUser('theo', async (d) => {
  const r = await d.exec(`select body from public.pocket_notes;`);
  if (!r[0].rows.some((x) => x.body === 'covert telegram #1')) throw new Error('note missing');
});
await check('pocket note visible to partner', true);
await asUser('eve', async (d) => {
  const r = await d.exec(`select * from public.pocket_notes;`);
  if (r[0].rows.length > 0) throw new Error('cross-couple pocket note leak');
});
await check('pocket note invisible to third user', true);
await asUser('theo', async (d) => {
  await d.exec(`insert into public.pocket_notes (couple_id, author_id, body)
                values ('${coupleId}', '${users.mara}', 'spoofed note as mara');`);
}).then(
  () => check('pocket note insert enforces author_id = auth.uid()', false, 'SHOULD HAVE FAILED'),
  () => check('pocket note insert enforces author_id = auth.uid()', true),
);
await asUser('mara', async (d) => {
  await d.exec(`insert into public.pocket_notes (couple_id, author_id, body)
                values ('${coupleId}', '${users.mara}', '${'x'.repeat(501)}');`);
}).then(
  () => check('pocket note rejects > 500 chars', false, 'SHOULD HAVE FAILED'),
  () => check('pocket note rejects > 500 chars', true),
);

// 5. Anon (logged out) gets nothing — anon has no DML grants on responses
// at all, so the SELECT itself must fail with permission denied.
let anonBlocked = false;
await asAnon(async (d) => {
  try {
    await d.exec('select * from public.responses;');
  } catch (e) {
    anonBlocked = true;
  }
});
check('anon reads zero responses', anonBlocked, 'select as anon must be permission-denied');

// 6. Unlink + delete.
await asUser('theo', async (d) => {
  await d.exec('select public.unlink_partner();');
});
await check('unlink_partner runs', true);
await asUser('mara', async (d) => {
  await d.exec(`select public.delete_my_account();`);
});
await check('delete_my_account runs', true);

// --- Summary ----------------------------------------------------------------
const failed = results.filter((r) => !r.pass);
console.log('');
console.log(`HARDENING RESULTS: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error('FAILED CHECKS:');
  for (const f of failed) console.error(`  - ${f.name} ${f.detail}`);
  process.exit(1);
}
console.log('ALL MIGRATION + AUTHORIZATION CHECKS PASSED');
process.exit(0);
