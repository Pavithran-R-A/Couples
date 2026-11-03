// Adversarial integration tests for the couples-api Appwrite Function.
// Runs the real function entrypoint against an in-memory mock of the
// Appwrite TablesDB REST API — asserting routes, payloads, verified-caller
// identity, couple membership, first-write-wins semantics, cross-couple
// isolation, transaction staging/commit/rollback and safe deletion.
// No network access; node:test runner.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.APPWRITE_ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';
process.env.APPWRITE_API_KEY = 'test-server-key';
process.env.APPWRITE_FUNCTION_PROJECT_ID = 'test-project';
process.env.APPWRITE_CODE_PEPPER = 'test-pepper';

// ---- In-memory Appwrite TablesDB REST simulation ---------------------------

const USER_SEED = () => ({
  'user-a': { $id: 'user-a', email: 'a@test.local', name: 'A' },
  'user-b': { $id: 'user-b', email: 'b@test.local', name: 'B' },
  'user-c': { $id: 'user-c', email: 'c@test.local', name: 'C' },
});
const users = USER_SEED();
const validJwts = { 'jwt-a': 'user-a', 'jwt-b': 'user-b', 'jwt-c': 'user-c' };
const DAY_MS = 86400000;
const tables = new Map();
const openTxns = new Map();
let txSeq = 0;
let forceCommitFailure = false;
const now = () => new Date().toISOString();

function tbl(t) { if (!tables.has(t)) tables.set(t, new Map()); return tables.get(t); }
function genId() { return `row-${Math.random().toString(36).slice(2, 10)}`; }

function applyFilters(rows, queries) {
  let out = rows;
  for (const q of queries) {
    const eq = q.match(/^equal\("([^"]+)",\s*(.+?)\)$/);
    if (eq) {
      const attr = eq[1];
      let val;
      try { val = JSON.parse(eq[2]); } catch { val = eq[2]; }
      out = out.filter((r) => String(r[attr]) === String(val));
    }
  }
  return out;
}

function jsonResponse(status, data) {
  return { ok: status < 400, status, json: async () => data, headers: { get: () => String(data?.total ?? 0) } };
}

function fakeAppwrite(method, url, parsedBody, headers) {
  // Appwrite Cloud endpoints carry the /v1 API prefix in the pathname.
  const path = new URL(url).pathname.replace(/^\/v1/, '');
  const txnId = headers['X-Appwrite-Transaction-Id'];
  const staging = Boolean(txnId && openTxns.has(txnId));

  if (path === '/account' && method === 'GET') {
    const jwt = headers['X-Appwrite-JWT'];
    return validJwts[jwt]
      ? jsonResponse(200, { $id: validJwts[jwt], email: '', name: '' })
      : jsonResponse(401, { error: 'invalid jwt' });
  }
  if (path.startsWith('/users/')) {
    const uid = path.split('/users/')[1];
    if (method === 'GET') return users[uid] ? jsonResponse(200, users[uid]) : jsonResponse(404, { error: 'nf' });
    if (method === 'DELETE') { delete users[uid]; return jsonResponse(204, null); }
  }
  if (path === '/tablesdb/transactions' && method === 'POST') {
    const id = `txn-${++txSeq}`;
    openTxns.set(id, []);
    return jsonResponse(200, { $id: id, status: 'created' });
  }
  const commit = path.match(/^\/tablesdb\/transactions\/(txn-\d+)\/commit$/);
  if (commit && method === 'POST') {
    if (forceCommitFailure) return jsonResponse(500, { error: 'commit failed' });
    const ops = openTxns.get(commit[1]) ?? [];
    openTxns.delete(commit[1]);
    // Atomicity: validate every staged operation before applying any, so a
    // conflict fails the whole commit without partial application.
    for (const op of ops) {
      const t = tbl(op.tableId);
      if (op.action === 'create' && t.has(op.rowId)) return jsonResponse(409, { error: 'duplicate' });
      if (op.action === 'update' && !t.has(op.rowId)) return jsonResponse(404, { error: 'row missing' });
    }
    for (const op of ops) {
      const t = tbl(op.tableId);
      if (op.action === 'create') t.set(op.rowId, { $id: op.rowId, ...op.data });
      if (op.action === 'update') t.set(op.rowId, { ...t.get(op.rowId), ...op.data });
      if (op.action === 'delete') t.delete(op.rowId);
    }
    return jsonResponse(200, { status: 'committed' });
  }
  const create = path.match(/^\/tablesdb\/[^/]+\/tables\/([^/]+)\/rows$/);
  if (create && method === 'POST') {
    const t = tbl(create[1]);
    const rowId = parsedBody.rowId === 'unique()' ? genId() : parsedBody.rowId;
    if (staging) { openTxns.get(txnId).push({ action: 'create', tableId: create[1], rowId, data: parsedBody.data ?? {} }); return jsonResponse(201, { $id: rowId, ...parsedBody.data }); }
    if (t.has(rowId)) return jsonResponse(409, { error: 'duplicate' });
    const rowData = { $id: rowId, ...parsedBody.data };
    t.set(rowId, rowData);
    return jsonResponse(201, rowData);
  }
  const rowPath = path.match(/^\/tablesdb\/[^/]+\/tables\/([^/]+)\/rows\/([^/?]+)/);
  if (rowPath) {
    const t = tbl(rowPath[1]);
    const cur = t.get(rowPath[2]);
    if (!cur) return jsonResponse(404, { error: 'not found' });
    if (method === 'GET') return jsonResponse(200, cur);
    if (method === 'PATCH') {
      if (staging) { openTxns.get(txnId).push({ action: 'update', tableId: rowPath[1], rowId: rowPath[2], data: parsedBody.data ?? {} }); return jsonResponse(200, { ...cur, ...parsedBody.data }); }
      const upd = { ...cur, ...parsedBody.data };
      t.set(rowPath[2], upd);
      return jsonResponse(200, upd);
    }
    if (method === 'DELETE') {
      if (staging) { openTxns.get(txnId).push({ action: 'delete', tableId: rowPath[1], rowId: rowPath[2] }); return jsonResponse(204, null); }
      t.delete(rowPath[2]);
      return jsonResponse(204, null);
    }
  }
  const list = path.match(/^\/tablesdb\/[^/]+\/tables\/([^/]+)\/rows$/);
  if (list && method === 'GET') {
    const queries = new URL(url).searchParams.getAll('queries[]');
    let rows = [...tbl(list[1]).values()];
    rows = applyFilters(rows, queries);
    return jsonResponse(200, { rows, total: rows.length });
  }
  return jsonResponse(404, { error: 'unknown route' });
}

globalThis.fetch = async (url, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const headers = options.headers || {};
  let parsed = options.body;
  if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch { /* keep */ } }
  const path = new URL(url).pathname.replace(/^\/v1/, '');
  if (path === '/account' && method === 'GET') {
    const jwt = headers['X-Appwrite-JWT'];
    return validJwts[jwt] ? jsonResponse(200, { $id: validJwts[jwt] }) : jsonResponse(401, { error: 'invalid jwt' });
  }
  return fakeAppwrite(method, url, parsed, headers);
};

// ---- Function harness -------------------------------------------------------

let captured = null;
function makeRes() {
  return { json(data, code) { captured = { ...data, code: code ?? 200 }; return captured; } };
}
const req = (action, jwt, bodyJson) => ({
  headers: { 'x-action': action, 'x-appwrite-user-jwt': jwt || '' },
  bodyJson: bodyJson ?? {},
  body: bodyJson ? JSON.stringify(bodyJson) : '',
});
const log = (...a) => { if (process.env.QA_DEBUG) console.error('[fn.log]', ...a.map(String)); };
const error = (...a) => { if (process.env.QA_DEBUG) console.error('[fn.error]', ...a.map(String)); };
async function call(action, jwt, body) {
  captured = null;
  const mod = await import('../src/main.js');
  await mod.default({ req: req(action, jwt, body), res: makeRes(), log, error });
  return captured;
}

function freshWorld() {
  // Fresh isolated world per test — the mock store is module-level, so a
  // reset here prevents cross-test couple/id pollution.
  tables.clear();
  openTxns.clear();
  forceCommitFailure = false;
  for (const k of Object.keys(users)) delete users[k];
  Object.assign(users, USER_SEED());
  tbl('profiles').set('user-a', { $id: 'user-a', email: 'a@test.local', display_name: 'A', couple_id: null, created_at: now() });
  tbl('profiles').set('user-b', { $id: 'user-b', email: 'b@test.local', display_name: 'B', couple_id: null, created_at: now() });
  tbl('question_bank').set('q1', { $id: 'q1', category: 'everyday', text: 'Question one?' });
  tbl('question_bank').set('q2', { $id: 'q2', category: 'memory', text: 'Question two?' });
}

// A fully paired world: A and B share one couple; C remains unpaired until a
// test pairs them explicitly.
function seedCouple() {
  freshWorld();
  const coupleId = 'couple-1';
  tbl('couples').set(coupleId, { $id: coupleId, partner_a_id: 'user-a', partner_b_id: 'user-b', created_at: now() });
  tbl('profiles').get('user-a').couple_id = coupleId;
  tbl('profiles').get('user-b').couple_id = coupleId;
  return coupleId;
}

// Pairs user-c into their own fresh couple (so membership denials exercise
// the real couple comparison, not just the unpaired guard).
async function pairC() {
  const r = await call('pair.start', 'jwt-c', {});
  assert.equal(r.code, 200, `pairC failed: ${JSON.stringify(r)}`);
  return r.data.coupleId;
}

// ---- Identity and module tests ----------------------------------------------

test('module loads and exports a callable entrypoint', async () => {
  const mod = await import('../src/main.js');
  assert.equal(typeof mod.default, 'function');
});

test('unauthenticated requests are rejected with 401', async () => {
  const r = await call('profile.get', '', {});
  assert.equal(r.code, 401);
});

test('invalid JWT is rejected with 401', async () => {
  const r = await call('profile.get', 'jwt-forged', {});
  assert.equal(r.code, 401);
});

test('unknown action is rejected with 404', async () => {
  const r = await call('no.such.action', 'jwt-a', {});
  assert.equal(r.code, 404);
});

test('profile.bootstrap creates the profile row keyed by the verified user id', async () => {
  freshWorld();
  const r = await call('profile.bootstrap', 'jwt-c', {});
  assert.equal(r.code, 200);
  assert.equal(r.data.profile.$id, 'user-c');
});

// ---- Pairing ------------------------------------------------------------------

test('pair.start creates a couple and a single-use hashed invitation', async () => {
  freshWorld();
  const r = await call('pair.start', 'jwt-a', {});
  assert.equal(r.code, 200, JSON.stringify(r));
  assert.match(r.data.code, /^[A-Z0-9-]{9}$/);
  const couple = tbl('couples').get(r.data.coupleId);
  assert.equal(couple.partner_a_id, 'user-a');
  assert.equal(tbl('profiles').get('user-a').couple_id, r.data.coupleId);
  assert.equal([...tbl('invitations').values()].length, 1);
  const invite = [...tbl('invitations').values()][0];
  assert.notEqual(invite.code_digest, r.data.code, 'invitation stores only the digest');
});

test('pair.join links partner B inside one transaction', async () => {
  freshWorld();
  const start = await call('pair.start', 'jwt-a', {});
  const r = await call('pair.join', 'jwt-b', { code: start.data.code });
  assert.equal(r.code, 200, JSON.stringify(r));
  assert.equal(r.data.coupleId, start.data.coupleId);
  assert.equal(tbl('couples').get(start.data.coupleId).partner_b_id, 'user-b');
  assert.equal(tbl('profiles').get('user-b').couple_id, start.data.coupleId);
  const invite = [...tbl('invitations').values()][0];
  assert.ok(invite.consumed_at, 'invitation consumed');
});

test('a replayed invitation is rejected', async () => {
  freshWorld();
  const start = await call('pair.start', 'jwt-a', {});
  const r1 = await call('pair.join', 'jwt-b', { code: start.data.code });
  assert.equal(r1.code, 200);
  const r2 = await call('pair.join', 'jwt-c', { code: start.data.code });
  assert.equal(r2.code, 409);
  assert.equal(tbl('couples').get(start.data.coupleId).partner_b_id, 'user-b');
});

test('an expired invitation is rejected', async () => {
  freshWorld();
  const start = await call('pair.start', 'jwt-a', {});
  const invite = [...tbl('invitations').values()][0];
  invite.expires_at = new Date(Date.now() - DAY_MS).toISOString();
  const r = await call('pair.join', 'jwt-b', { code: start.data.code });
  assert.equal(r.code, 410);
});

test('a third user cannot join a complete couple', async () => {
  freshWorld();
  const start = await call('pair.start', 'jwt-a', {});
  await call('pair.join', 'jwt-b', { code: start.data.code });
  const r = await call('pair.join', 'jwt-c', { code: start.data.code });
  assert.equal(r.code, 409);
  assert.equal(tbl('couples').get(start.data.coupleId).partner_b_id, 'user-b');
});

test('an already-paired user cannot join another couple', async () => {
  freshWorld();
  const start = await call('pair.start', 'jwt-a', {});
  await pairC();
  const r = await call('pair.join', 'jwt-c', { code: start.data.code });
  assert.equal(r.code, 409);
  assert.equal(tbl('couples').get(start.data.coupleId).partner_b_id ?? null, null);
});

test('a transaction commit failure rejects the join without partial state', async () => {
  freshWorld();
  const start = await call('pair.start', 'jwt-a', {});
  forceCommitFailure = true;
  const r = await call('pair.join', 'jwt-b', { code: start.data.code });
  forceCommitFailure = false;
  assert.equal(r.code, 409);
  assert.equal(tbl('couples').get(start.data.coupleId).partner_b_id ?? null, null);
  assert.equal(tbl('profiles').get('user-b').couple_id ?? null, null);
  assert.equal(tbl('invitations').values().next().value.consumed_at, undefined);
});

test('concurrent pair.start from the same user yields exactly one couple', async () => {
  freshWorld();
  const r1 = await call('pair.start', 'jwt-a', {});
  assert.equal(r1.code, 200);
  const r2 = await call('pair.start', 'jwt-a', {});
  assert.equal(r2.code, 409);
  assert.equal([...tbl('couples').values()].length, 1);
});

// ---- Letters, sealed responses, reveal ----------------------------------------

test('letter.today get-or-creates one letter per couple per day', async () => {
  const coupleId = seedCouple();
  const r1 = await call('letter.today', 'jwt-a', {});
  assert.equal(r1.code, 200, JSON.stringify(r1));
  const r2 = await call('letter.today', 'jwt-b', {});
  assert.equal(r2.data.letter.$id, r1.data.letter.$id);
  assert.equal([...tbl('daily_letters').values()].filter((l) => l.couple_id === coupleId).length, 1);
});

test('a sealed answer is immutable (first-write-wins)', async () => {
  seedCouple();
  const letter = (await call('letter.today', 'jwt-a', {})).data.letter;
  const r1 = await call('response.submit', 'jwt-a', { letter_id: letter.$id, body: 'first and final' });
  assert.equal(r1.code, 200);
  const r2 = await call('response.submit', 'jwt-a', { letter_id: letter.$id, body: 'overwrite attempt' });
  assert.equal(r2.data.alreadySealed, true);
  assert.equal(r2.data.response.body, 'first and final');
});

test('partner body stays invisible before both partners answer', async () => {
  seedCouple();
  const letter = (await call('letter.today', 'jwt-a', {})).data.letter;
  await call('response.submit', 'jwt-a', { letter_id: letter.$id, body: 'secret until reveal' });
  const state = await call('response.state', 'jwt-b', { letter_id: letter.$id });
  assert.equal(state.data.revealed, false);
  assert.equal(state.data.partner, null);
  assert.equal(state.data.mine, null);
});

test('reveal exposes both byte-exact originals only after both submit', async () => {
  seedCouple();
  const letter = (await call('letter.today', 'jwt-a', {})).data.letter;
  await call('response.submit', 'jwt-a', { letter_id: letter.$id, body: 'original A' });
  const midway = await call('response.state', 'jwt-b', { letter_id: letter.$id });
  assert.equal(midway.data.revealed, false);
  await call('response.submit', 'jwt-b', { letter_id: letter.$id, body: 'original B' });
  const revealed = await call('response.state', 'jwt-b', { letter_id: letter.$id });
  assert.equal(revealed.data.revealed, true);
  assert.equal(revealed.data.mine.body, 'original B');
  assert.equal(revealed.data.partner.body, 'original A');
  for (const row of tbl('responses').values()) assert.ok(row.revealed_at, 'server stamped revealed_at');
});

test('an unpaired user C cannot read couple letter state', async () => {
  seedCouple();
  const letter = (await call('letter.today', 'jwt-a', {})).data.letter;
  const r = await call('response.state', 'jwt-c', { letter_id: letter.$id });
  assert.equal(r.code, 403);
});

test('a paired outsider C is denied another couple letter state', async () => {
  seedCouple();
  const letter = (await call('letter.today', 'jwt-a', {})).data.letter;
  await pairC();
  const r = await call('response.state', 'jwt-c', { letter_id: letter.$id });
  assert.equal(r.code, 403);
});

test('a crafted foreign letter id is rejected', async () => {
  freshWorld();
  await pairC();
  const r = await call('response.state', 'jwt-c', { letter_id: 'coupleA-letter-1' });
  assert.equal(r.code, 403);
});

test('missing letter id returns 400, not a server error', async () => {
  seedCouple();
  const r1 = await call('response.state', 'jwt-a', {});
  assert.equal(r1.code, 400);
  const r2 = await call('response.submit', 'jwt-a', { body: 'x' });
  assert.equal(r2.code, 400);
});

test('an empty answer is rejected with 400', async () => {
  seedCouple();
  const letter = (await call('letter.today', 'jwt-a', {})).data.letter;
  const r = await call('response.submit', 'jwt-a', { letter_id: letter.$id, body: '   ' });
  assert.equal(r.code, 400);
});

// ---- Memories -----------------------------------------------------------------

test('an outsider C cannot update or delete another couple memory', async () => {
  seedCouple();
  const created = await call('memory.create', 'jwt-a', { title: 'Private', note: 'secret', memory_date: '2026-10-01' });
  const memoryId = created.data.memory.$id;
  await pairC();
  const denied1 = await call('memory.update', 'jwt-c', { id: memoryId, title: 'hacked' });
  assert.equal(denied1.code, 403);
  const denied2 = await call('memory.delete', 'jwt-c', { id: memoryId });
  assert.equal(denied2.code, 403);
  assert.equal(tbl('memories').get(memoryId).title, 'Private');
});

test('memory.create rejects an invalid date shape', async () => {
  seedCouple();
  const r = await call('memory.create', 'jwt-a', { title: 'x', note: '', memory_date: '2026-13-45' });
  assert.equal(r.code, 400);
  assert.match(r.error, /YYYY-MM-DD/);
});

// ---- Adventures ----------------------------------------------------------------

test('a paired outsider C cannot read another couple adventure part', async () => {
  seedCouple();
  tbl('weekly_adventures').set('adv-foreign', { $id: 'adv-foreign', couple_id: 'couple-other', week_of: '2026-11-02', kind: 'tiny_date', created_at: now() });
  tbl('adventure_parts').set('part-foreign', { $id: 'part-foreign', adventure_id: 'adv-foreign', author_id: 'user-x', entry: 'secret part', created_at: now() });
  await pairC();
  const r = await call('adventure.part.get', 'jwt-c', { adventure_id: 'adv-foreign' });
  assert.equal(r.code, 403);
  assert.equal(r.data ?? null, null, 'no partner content leaked');
});

test('adventure part stays partner-private until both submit', async () => {
  seedCouple();
  const adv = (await call('adventure.current', 'jwt-a', {})).data.adventure;
  const kept = await call('adventure.complete', 'jwt-a', { adventure_id: adv.$id, entry: 'my half' });
  assert.equal(kept.code, 200, JSON.stringify(kept));
  const view = await call('adventure.part.get', 'jwt-a', { adventure_id: adv.$id });
  assert.equal(view.data.revealed, false);
  assert.equal(view.data.partner, null);
  assert.equal(view.data.mine.entry, 'my half');
});

// ---- Reactions ------------------------------------------------------------------

test('reaction.set rejects a revealed response from another couple', async () => {
  seedCouple();
  tbl('daily_letters').set('letter-foreign', { $id: 'letter-foreign', couple_id: 'couple-other', letter_date: '2026-11-02', created_at: now() });
  tbl('responses').set('resp-foreign', { $id: 'resp-foreign', letter_id: 'letter-foreign', author_id: 'user-x', body: 'x', created_at: now(), revealed_at: now() });
  const r = await call('reaction.set', 'jwt-a', { response_id: 'resp-foreign', kind: 'heart' });
  assert.equal(r.code, 403);
  assert.equal([...tbl('reactions').values()].length, 0);
});

test('reaction.set creates then updates the caller own reaction after reveal', async () => {
  seedCouple();
  const letter = (await call('letter.today', 'jwt-a', {})).data.letter;
  await call('response.submit', 'jwt-a', { letter_id: letter.$id, body: 'A final' });
  const second = await call('response.submit', 'jwt-b', { letter_id: letter.$id, body: 'B final' });
  const targetId = (await call('response.state', 'jwt-b', { letter_id: letter.$id })).data.partner.$id
    ?? (await call('response.state', 'jwt-a', { letter_id: letter.$id })).data.partner.$id;
  const r1 = await call('reaction.set', 'jwt-b', { response_id: targetId, kind: 'heart' });
  assert.equal(r1.code, 200, JSON.stringify(r1));
  const r2 = await call('reaction.set', 'jwt-b', { response_id: targetId, kind: 'smile' });
  assert.equal(r2.code, 200);
  assert.equal([...tbl('reactions').values()].length, 1, 'one reaction row per author per response');
  assert.equal([...tbl('reactions').values()][0].kind, 'smile');
  assert.ok(second.data.revealed !== undefined);
});

// ---- Account lifecycle ------------------------------------------------------------

test('safe account deletion removes only the caller rows and retains partner content', async () => {
  const coupleId = seedCouple();
  const letter = (await call('letter.today', 'jwt-a', {})).data.letter;
  await call('response.submit', 'jwt-a', { letter_id: letter.$id, body: 'A final' });
  await call('response.submit', 'jwt-b', { letter_id: letter.$id, body: 'B final' });
  await call('memory.create', 'jwt-a', { title: 'Shared memory', note: '', memory_date: '2026-10-01' });
  const r = await call('account.delete', 'jwt-b', {});
  assert.equal(r.code, 200, JSON.stringify(r));
  const couple = tbl('couples').get(coupleId);
  assert.equal(couple.partner_b_id, null, 'caller slot cleared');
  assert.equal(couple.partner_a_id, 'user-a', 'partner keeps the couple');
  assert.ok([...tbl('memories').values()].find((m) => m.title === 'Shared memory'));
  assert.ok([...tbl('responses').values()].find((x) => x.author_id === 'user-a'));
  assert.equal([...tbl('responses').values()].find((x) => x.author_id === 'user-b'), undefined);
  assert.ok([...tbl('daily_letters').values()].find((l) => l.$id === letter.$id), 'shared letter retained');
  assert.equal(tbl('profiles').get('user-b'), undefined);
  assert.equal(users['user-b'], undefined, 'auth user deleted');
});
