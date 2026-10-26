// Replays the ENTIRE ordered migration series from supabase/migrations/
// (0000 runtime prelude → 0009 adventures RPC-only) against real Postgres
// (PGlite, WASM), starting from an empty database. Simulates the Supabase
// runtime: anon / authenticated / service_role roles, an auth schema with
// auth.users + auth.uid() reading request.jwt.claims, and per-session role
// switching so RLS is exercised under authenticated / anon identities
// exactly as the Data API would drive it.
//
// Then drives the authorization matrix under three identities (mara, theo,
// eve): invite expiry / replay / racing, blocked direct writes, reveal
// privacy, cross-couple isolation, pocket-note rules, anon denial, unlink,
// account deletion, and the RPC-only weekly-adventures path.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'supabase', 'migrations');

// Filenames carry zero-padded timestamps, so lexicographic order IS the
// intended application order (0000 prelude → 0009 adventures RPC-only).
const migrationFiles = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
if (migrationFiles.length === 0) {
  console.error('No migration files found in supabase/migrations — refusing to run.');
  process.exit(1);
}
console.log('MIGRATION SERIES (' + migrationFiles.length + ' files, in order):');
for (const f of migrationFiles) console.log('  ' + f);

const db = new PGlite({ extensions: { pgcrypto } });

// --- Supabase runtime emulation -------------------------------------------
// Roles the Supabase SQL editor / Data API rely on.
await db.exec(`
  create role anon noinherit nologin;
  create role authenticated noinherit nologin;
  create role service_role noinherit nologin;
  create role supabase_auth_admin noinherit nologin;
  create schema if not exists auth;
  grant usage on schema auth to anon, authenticated, service_role;
`);

// auth.users must exist (profiles FK + delete_my_account + the signup
// trigger). raw_user_meta_data mirrors the real auth schema column that
// on_auth_user_created reads display_name from.
await db.exec(`
  create table auth.users (
    id uuid primary key,
    email text unique,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );
`);
// auth.uid() per the Supabase prelude: reads request.jwt.claims.
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

// --- Apply the ordered series ---
let applied = 0;
for (const file of migrationFiles) {
  const sql = readFileSync(join(migrationsDir, file), 'utf8');
  try {
    await db.exec(sql);
    applied += 1;
    console.log('  OK  ' + file);
  } catch (e) {
    console.error('MIGRATION SERIES: FAILED at ' + file);
    console.error(String(e.message ?? e).slice(0, 4000));
    process.exit(1);
  }
}
console.log(`MIGRATION: ALL ${applied}/${migrationFiles.length} APPLIED CLEANLY (0 errors)`);

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

// Create real auth users in the emulated auth schema. The on_auth_user_created
// trigger (migration 0007) must create the profile rows server-side — the
// same path a confirmed signup follows when no client session exists.
const names = { mara: 'Mara', theo: 'Theo', eve: 'Eve' };
for (const [name, id] of Object.entries(users)) {
  await db.exec(
    `insert into auth.users (id, email, raw_user_meta_data)
     values ('${id}', '${name}@test.local', '{"display_name":"${names[name]}"}');`
  );
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

// 0. Signup trigger: profiles were created server-side from auth metadata.
const profileNames = (
  await db.exec(`select id, display_name from public.profiles order by id;`)
)[0].rows;
check(
  'on_auth_user_created trigger creates all three profiles with display names',
  profileNames.length === 3 &&
    profileNames.some((p) => p.id === users.mara && p.display_name === 'Mara') &&
    profileNames.some((p) => p.id === users.theo && p.display_name === 'Theo') &&
    profileNames.some((p) => p.id === users.eve && p.display_name === 'Eve'),
  `got ${profileNames.length} profiles: ${profileNames.map((p) => p.display_name || '(blank)').join(', ')}`
);

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

// 3b. Response append-only finality (migration 0011). A second letter for
// the same couple lets us test both sides of the reveal boundary without
// disturbing the section-3 assertions above.
const letter2Id = (
  await db.exec(`
    insert into public.daily_letters (couple_id, letter_date, question_id, question_text, category)
    values ('${coupleId}', current_date - 1, (select id from public.question_bank limit 1),
            'What made you laugh this week?', 'playful')
    returning id;
  `)
)[0].rows[0].id;

// A submits a valid final answer; assert the stored body explicitly.
await asUser('mara', async (d) => {
  await d.exec(`insert into public.responses (letter_id, author_id, body)
                values ('${letter2Id}', '${users.mara}', 'Mara final answer v1');`);
});
const maraStored = (
  await db.exec(`select body from public.responses where letter_id = '${letter2Id}' and author_id = '${users.mara}';`)
)[0].rows;
check(
  'partner A submission stores the exact final answer',
  maraStored.length === 1 && maraStored[0].body === 'Mara final answer v1',
  `rows=${maraStored.length}`
);

// B cannot read A's answer before answering (RLS both_partners_answered).
const theoRowsBefore = await asUser('theo', async (d) => {
  const r = await d.exec(`select body from public.responses where letter_id = '${letter2Id}';`);
  return r[0].rows.length;
});
check('partner B reads zero responses before answering', theoRowsBefore === 0, `saw ${theoRowsBefore}`);

// A attempts a second submission with different text: unique(letter_id,
// author_id) must reject it with 23505 and the original must survive.
await asUser('mara', async (d) => {
  await d.exec(`insert into public.responses (letter_id, author_id, body)
                values ('${letter2Id}', '${users.mara}', 'Mara TAMPERED v2');`);
}).then(
  () => check('second submission by same author is rejected', false, 'SHOULD HAVE FAILED'),
  (e) => {
    const code = e?.code ?? '';
    check(
      'second submission by same author is rejected',
      code === '23505' || String(e?.message ?? '').includes('duplicate key'),
      `sqlstate=${code || 'n/a'}`
    );
  },
);
const afterResubmit = (
  await db.exec(`select body, (select count(*)::int from public.responses where letter_id = '${letter2Id}') as n
                 from public.responses where letter_id = '${letter2Id}' and author_id = '${users.mara}';`)
)[0].rows[0];
check(
  'original answer unchanged and unduplicated after rejected resubmission',
  afterResubmit.body === 'Mara final answer v1' && afterResubmit.n === 1,
  `rows=${afterResubmit.n}`
);

// UPDATE privilege is revoked entirely (0011): body, revealed_at and DELETE
// all fail at the privilege level, independent of any policy.
await asUser('mara', async (d) => {
  await d.exec(`update public.responses set body = 'rewritten' where letter_id = '${letter2Id}' and author_id = '${users.mara}';`);
}).then(
  () => check('direct UPDATE on answer body denied', false, 'SHOULD HAVE FAILED'),
  () => check('direct UPDATE on answer body denied', true),
);
await asUser('mara', async (d) => {
  await d.exec(`update public.responses set revealed_at = now() where letter_id = '${letter2Id}' and author_id = '${users.mara}';`);
}).then(
  () => check('direct revealed_at manipulation denied', false, 'SHOULD HAVE FAILED'),
  () => check('direct revealed_at manipulation denied', true),
);
await asUser('mara', async (d) => {
  await d.exec(`delete from public.responses where letter_id = '${letter2Id}' and author_id = '${users.mara}';`);
}).then(
  () => check('direct DELETE of an answer denied', false, 'SHOULD HAVE FAILED'),
  () => check('direct DELETE of an answer denied', true),
);

// Explicit grant-surface assertion, not inferred from error behaviour.
const privs = (
  await db.exec(`select
    has_table_privilege('authenticated', 'public.responses', 'SELECT')  as can_select,
    has_table_privilege('authenticated', 'public.responses', 'INSERT')  as can_insert,
    has_table_privilege('authenticated', 'public.responses', 'UPDATE')  as can_update,
    has_table_privilege('authenticated', 'public.responses', 'DELETE')  as can_delete;`)
)[0].rows[0];
check(
  'responses grant surface is select+insert only for authenticated',
  privs.can_select === true && privs.can_insert === true &&
    privs.can_update === false && privs.can_delete === false,
  `select=${privs.can_select} insert=${privs.can_insert} update=${privs.can_update} delete=${privs.can_delete}`
);

// B submits; both originals become visible to the couple, stamped by the
// trigger, and neither partner can edit afterwards.
await asUser('theo', async (d) => {
  await d.exec(`insert into public.responses (letter_id, author_id, body)
                values ('${letter2Id}', '${users.theo}', 'Theo final answer v1');`);
});
const pairRows = (
  await db.exec(`select author_id, body, revealed_at from public.responses
                 where letter_id = '${letter2Id}' order by author_id;`)
)[0].rows;
check(
  'both originals intact after both submitted (stored truth)',
  pairRows.length === 2 &&
    pairRows.some((r) => r.author_id === users.mara && r.body === 'Mara final answer v1') &&
    pairRows.some((r) => r.author_id === users.theo && r.body === 'Theo final answer v1'),
  `rows=${pairRows.length}`
);
check(
  'revealed_at stamped server-side on both rows (non-null, identical)',
  pairRows.every((r) => r.revealed_at !== null) &&
    String(pairRows[0].revealed_at) === String(pairRows[1].revealed_at),
  `stamps=${pairRows.map((r) => (r.revealed_at ? 'set' : 'null')).join(',')}`
);
await asUser('theo', async (d) => {
  const r = await d.exec(`select body from public.responses where letter_id = '${letter2Id}' order by body;`);
  const bodies = r[0].rows.map((x) => x.body);
  if (!(bodies.includes('Mara final answer v1') && bodies.includes('Theo final answer v1'))) {
    throw new Error('post-reveal visibility broken');
  }
});
await check('both partners read both originals after reveal (RLS)', true);
await asUser('theo', async (d) => {
  await d.exec(`update public.responses set body = 'theo rewrite' where letter_id = '${letter2Id}' and author_id = '${users.theo}';`);
}).then(
  () => check('no partner can edit an answer after reveal', false, 'SHOULD HAVE FAILED'),
  () => check('no partner can edit an answer after reveal', true),
);

// Third account: cannot view, join, alter or spoof anything on the letter.
await asUser('eve', async (d) => {
  const r = await d.exec(`select body from public.responses where letter_id = '${letter2Id}';`);
  if (r[0].rows.length > 0) throw new Error('cross-couple leak');
});
await check('third account reads zero responses', true);
await asUser('eve', async (d) => {
  await d.exec(`insert into public.responses (letter_id, author_id, body)
                values ('${letter2Id}', '${users.eve}', 'eve intrusion');`);
}).then(
  () => check('third account cannot join the letter conversation', false, 'SHOULD HAVE FAILED'),
  () => check('third account cannot join the letter conversation', true),
);
await asUser('eve', async (d) => {
  await d.exec(`update public.responses set body = 'eve was here' where letter_id = '${letter2Id}';`);
}).then(
  () => check('third account cannot alter responses', false, 'SHOULD HAVE FAILED'),
  () => check('third account cannot alter responses', true),
);
await asUser('mara', async (d) => {
  await d.exec(`insert into public.responses (letter_id, author_id, body)
                values ('${letter2Id}', '${users.theo}', 'mara spoofing theo');`);
}).then(
  () => check('spoofed author_id insert rejected by RLS', false, 'SHOULD HAVE FAILED'),
  () => check('spoofed author_id insert rejected by RLS', true),
);

// The stamping function is trigger-only: it lives in the non-exposed private
// schema and EXECUTE is revoked from every role, so even direct SQL fails.
await asUser('mara', async (d) => {
  await d.exec('select private.stamp_response_reveal();');
}).then(
  () => check('reveal stamping function is not client-callable', false, 'SHOULD HAVE FAILED'),
  () => check('reveal stamping function is not client-callable', true),
);
const fnMeta = (
  await db.exec(`select
    (select count(*)::int from information_schema.routines
      where routine_schema = 'public' and routine_name = 'stamp_response_reveal') as in_public,
    (select count(*)::int from information_schema.routines
      where routine_schema = 'private' and routine_name = 'stamp_response_reveal') as in_private,
    has_function_privilege('authenticated', 'private.stamp_response_reveal()', 'EXECUTE') as auth_can_execute,
    (select coalesce(array_to_string(proconfig, ','), '') from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private' and p.proname = 'stamp_response_reveal') as fn_config,
    (select tgenabled from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      where t.tgname = 'responses_reveal_stamp' and c.relname = 'responses') as trig_state;`)
)[0].rows[0];
check(
  'stamp function: private schema only, EXECUTE revoked, restricted search_path, trigger enabled',
  fnMeta.in_public === 0 &&
    fnMeta.in_private === 1 &&
    fnMeta.auth_can_execute === false &&
    fnMeta.fn_config.includes('search_path=') &&
    !fnMeta.fn_config.includes('search_path=public') &&
    fnMeta.trig_state === 'O',
  `public=${fnMeta.in_public} private=${fnMeta.in_private} exec=${fnMeta.auth_can_execute} ` +
    `config="${fnMeta.fn_config}" trigger=${fnMeta.trig_state}`
);

// Anonymous clients hold no INSERT grant on responses at all.
await asAnon(async (d) => {
  await d.exec(`insert into public.responses (letter_id, author_id, body)
                values ('${letter2Id}', '${users.mara}', 'anon forgery');`);
}).then(
  () => check('anon cannot submit responses', false, 'SHOULD HAVE FAILED'),
  () => check('anon cannot submit responses', true),
);

// Legacy backfill: a pair created in the pre-0011 shape (revealed_at null,
// trigger temporarily disabled to simulate migrated data) is stamped by the
// migration's backfill statement, while a solo answer stays unstamped.
const letter3Id = (
  await db.exec(`
    insert into public.daily_letters (couple_id, letter_date, question_id, question_text, category)
    values ('${coupleId}', current_date - 2, (select id from public.question_bank offset 1 limit 1),
            'Legacy completed pair', 'playful')
    returning id;
  `)
)[0].rows[0].id;
const letter4Id = (
  await db.exec(`
    insert into public.daily_letters (couple_id, letter_date, question_id, question_text, category)
    values ('${coupleId}', current_date - 3, (select id from public.question_bank offset 2 limit 1),
            'Legacy solo answer', 'playful')
    returning id;
  `)
)[0].rows[0].id;
await db.exec(`alter table public.responses disable trigger responses_reveal_stamp;`);
await db.exec(`insert into public.responses (letter_id, author_id, body) values
  ('${letter3Id}', '${users.mara}', 'legacy mara'),
  ('${letter3Id}', '${users.theo}', 'legacy theo'),
  ('${letter4Id}', '${users.mara}', 'legacy solo');`);
await db.exec(`alter table public.responses enable trigger responses_reveal_stamp;`);
await db.exec(`update public.responses r
   set revealed_at = coalesce(r.revealed_at, now())
 where r.revealed_at is null
   and (select count(*) from public.responses c where c.letter_id = r.letter_id) >= 2;`);
const legacyRows = (
  await db.exec(`select letter_id, author_id, revealed_at is not null as stamped
                 from public.responses where letter_id in ('${letter3Id}', '${letter4Id}')
                 order by letter_id, author_id;`)
)[0].rows;
check(
  'backfill stamps legacy completed pairs, leaves solo answers unstamped',
  legacyRows.length === 3 &&
    legacyRows.filter((r) => r.letter_id === letter3Id).every((r) => r.stamped === true) &&
    legacyRows.filter((r) => r.letter_id === letter4Id).every((r) => r.stamped === false),
  `stamped=${legacyRows.map((r) => (r.stamped ? 'y' : 'n')).join(',')}`
);

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

// 5b. Weekly adventures: RPC-only writes, concurrency-safe single offer,
// adversarial coverage. Runs BEFORE unlink/delete (the couple must exist).
let advRow = null;
await asUser('mara', async (d) => {
  const r = await d.exec('select * from public.get_this_weeks_adventure();');
  advRow = r[0].rows[0] ?? null;
});
check(
  'get_this_weeks_adventure returns one offer with title and detail',
  !!advRow && typeof advRow.title === 'string' && advRow.title.length > 0 && !!advRow.detail,
  advRow ? `${advRow.kind}: ${advRow.title}` : 'no row returned',
);

const theoAdv = await asUser('theo', async (d) => {
  const r = await d.exec('select * from public.get_this_weeks_adventure();');
  return r[0].rows[0] ?? null;
});
check(
  'theo sees the same single adventure (idempotent claim)',
  !!theoAdv && theoAdv.id === advRow.id,
  theoAdv ? `same id ${theoAdv.id}` : 'no row for theo',
);

const advCount = (
  await db.exec(`select count(*)::int as n from public.weekly_adventures where couple_id = '${coupleId}';`)
)[0].rows[0].n;
check('exactly one adventure row exists for the couple', advCount === 1, `count=${advCount}`);

// Concurrency backstop: a second insert for the same couple+week must hit
// the unique constraint even from a privileged context.
await db.exec(
  `insert into public.weekly_adventures (couple_id, week_of, kind, title, detail)
   values ('${coupleId}', (select week_of from public.weekly_adventures where couple_id = '${coupleId}' limit 1),
           'tiny_date', 'duplicate', 'should be impossible');`
).then(
  () => check('unique(couple_id, week_of) blocks duplicate weekly adventure', false, 'SHOULD HAVE FAILED'),
  () => check('unique(couple_id, week_of) blocks duplicate weekly adventure', true),
);

// Direct client writes are revoked after migration 0009 — even the row
// owner's side. All four must be permission-denied.
await asUser('mara', async (d) => {
  await d.exec(`insert into public.weekly_adventures (couple_id, week_of, kind, title, detail)
                values ('${coupleId}', current_date, 'tiny_date', 'forged', 'forged');`);
}).then(
  () => check('adventures: direct INSERT denied (RPC-only)', false, 'SHOULD HAVE FAILED'),
  () => check('adventures: direct INSERT denied (RPC-only)', true),
);
await asUser('mara', async (d) => {
  await d.exec(`update public.weekly_adventures set partner_b_done = true where id = '${advRow.id}';`);
}).then(
  () => check('adventures: partner A cannot forge partner B completion flag', false, 'SHOULD HAVE FAILED'),
  () => check('adventures: partner A cannot forge partner B completion flag', true),
);
await asUser('mara', async (d) => {
  await d.exec(`update public.weekly_adventures set partner_b_entry = 'hijacked' where id = '${advRow.id}';`);
}).then(
  () => check('adventures: partner A cannot write partner B entry directly', false, 'SHOULD HAVE FAILED'),
  () => check('adventures: partner A cannot write partner B entry directly', true),
);
await asUser('mara', async (d) => {
  await d.exec(`update public.weekly_adventures set title = 'edited by client' where id = '${advRow.id}';`);
}).then(
  () => check('adventures: metadata (title) edit denied', false, 'SHOULD HAVE FAILED'),
  () => check('adventures: metadata (title) edit denied', true),
);
await asUser('eve', async (d) => {
  await d.exec(`select * from public.weekly_adventures;`);
}).then(
  (r) => {
    const n = (r?.[0]?.rows ?? []).length;
    check('adventures: third user (eve) sees zero rows (RLS)', n === 0, `rows=${n}`);
  },
  () => check('adventures: third user (eve) sees zero rows (RLS)', true, 'permission denied also acceptable'),
);
await asUser('eve', async (d) => {
  await d.exec(`select * from public.complete_adventure_part('${advRow.id}', 'eve was here');`);
}).then(
  () => check('adventures: cross-couple completion blocked', false, 'SHOULD HAVE FAILED'),
  () => check('adventures: cross-couple completion blocked', true),
);
await asUser('eve', async (d) => {
  await d.exec('select * from public.get_this_weeks_adventure();');
}).then(
  () => check('adventures: user without couple cannot claim an adventure', false, 'SHOULD HAVE FAILED'),
  () => check('adventures: user without couple cannot claim an adventure', true),
);
await asUser('mara', async (d) => {
  await d.exec(`select * from public.complete_adventure_part('${advRow.id}', '${'x'.repeat(501)}');`);
}).then(
  () => check('adventures: entry over 500 chars rejected', false, 'SHOULD HAVE FAILED'),
  () => check('adventures: entry over 500 chars rejected', true),
);

// Happy path: each side completes with an entry; sides stay isolated.
const afterMara = await asUser('mara', async (d) => {
  const r = await d.exec(
    `select * from public.complete_adventure_part('${advRow.id}', 'Mara kept the promise');`
  );
  return r[0].rows[0];
});
check(
  'mara completes her side via RPC (partner_a_done, entry saved)',
  afterMara && afterMara.partner_a_done === true &&
    afterMara.partner_a_entry === 'Mara kept the promise' &&
    afterMara.partner_b_done === false && afterMara.partner_b_entry === null,
  afterMara ? `a_done=${afterMara.partner_a_done} b_done=${afterMara.partner_b_done}` : 'no row',
);

const afterTheo = await asUser('theo', async (d) => {
  const r = await d.exec(
    `select * from public.complete_adventure_part('${advRow.id}', 'Theo brought the blanket');`
  );
  return r[0].rows[0];
});
check(
  'theo completes his side; mara entry untouched; both done',
  afterTheo && afterTheo.partner_b_done === true &&
    afterTheo.partner_b_entry === 'Theo brought the blanket' &&
    afterTheo.partner_a_entry === 'Mara kept the promise' &&
    afterTheo.partner_a_done === true && afterTheo.partner_b_done === true,
  afterTheo ? `a_entry intact=${afterTheo.partner_a_entry === 'Mara kept the promise'}` : 'no row',
);

// Replay: completing again must not clear flags or the partner's data.
await asUser('mara', async (d) => {
  await d.exec(`select * from public.complete_adventure_part('${advRow.id}', NULL);`);
});
const afterReplay = (
  await db.exec(`select partner_a_done, partner_b_done, partner_a_entry, partner_b_entry
                 from public.weekly_adventures where id = '${advRow.id}';`)
)[0].rows[0];
check(
  'adventure replay is safe: flags stay true, entries intact',
  afterReplay.partner_a_done === true && afterReplay.partner_b_done === true &&
    afterReplay.partner_a_entry === 'Mara kept the promise',
  `state preserved after replay`,
);

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
