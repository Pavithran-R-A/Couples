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
process.env.APPWRITE_CODE_PEPPER = 'test-pepper-0123456789abcdef';

// ---- In-memory Appwrite TablesDB REST simulation ---------------------------

const USER_SEED = () => ({
  'user-a': { $id: 'user-a', email: 'a@test.local', name: 'A', emailVerification: true },
  'user-b': { $id: 'user-b', email: 'b@test.local', name: 'B', emailVerification: true },
  'user-c': { $id: 'user-c', email: 'c@test.local', name: 'C', emailVerification: true },
  'user-u': { $id: 'user-u', email: 'u@test.local', name: 'U', emailVerification: false },
});
const users = USER_SEED();
const validJwts = { 'jwt-a': 'user-a', 'jwt-b': 'user-b', 'jwt-c': 'user-c', 'jwt-u': 'user-u' };
const DAY_MS = 86400000;
const tables = new Map();
const openTxns = new Map();
// Every request through the mock is captured so tests can assert the exact
// wire format (methods, paths, payloads) against the official API.
const capturedRequests = [];
let txSeq = 0;
let forceCommitFailure = false;
let failStagedCreateFor = null;
let failDeleteFor = null;
let throwOnStagedPatch = false;
let failRollback = false;
const now = () => new Date().toISOString();

function tbl(t) { if (!tables.has(t)) tables.set(t, new Map()); return tables.get(t); }
function genId() { return `row-${Math.random().toString(36).slice(2, 10)}`; }

// Parses ONLY the official Appwrite Query serialization:
// JSON.stringify({ method, attribute?, values }) — e.g.
// {"method":"equal","attribute":"name","values":["John"]} and
// {"method":"limit","values":[6]}. The legacy human-readable function-call
// strings (`equal("x","y")`, `limit(6)`) are NOT part of the REST contract
// and are rejected exactly like the real API rejects malformed queries.
function applyFilters(rows, queries) {
  let out = rows;
  let limit = rows.length;
  for (const q of queries) {
    let parsed;
    try { parsed = JSON.parse(q); } catch { throw new Error(`malformed query (not JSON): ${q}`); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
      || typeof parsed.method !== 'string'
      || !Array.isArray(parsed.values)
      || (parsed.method !== 'limit' && typeof parsed.attribute !== 'string')) {
      throw new Error(`unsupported or malformed query: ${q}`);
    }
    if (parsed.method === 'equal') {
      out = out.filter((r) => parsed.values.some((v) => String(r[parsed.attribute]) === String(v)));
    } else if (parsed.method === 'limit') {
      limit = Math.min(limit, Number(parsed.values[0]) || 0);
    } else {
      throw new Error(`unsupported query method: ${parsed.method}`);
    }
  }
  return out.slice(0, limit);
}

function jsonResponse(status, data) {
  return { ok: status < 400, status, json: async () => data, headers: { get: () => String(data?.total ?? 0) } };
}

function fakeAppwrite(method, url, parsedBody, headers) {
  // Appwrite Cloud endpoints carry the /v1 API prefix in the pathname.
  const path = new URL(url).pathname.replace(/^\/v1/, '');
  // Transaction staging travels in the request BODY per the official API
  // (row operations carry { transactionId }); there is no transaction header.
  const stageTxn = parsedBody && parsedBody.transactionId;
  const staging = Boolean(stageTxn && openTxns.has(stageTxn));

  if (path === '/account' && method === 'GET') {
    const jwt = headers['X-Appwrite-JWT'];
    const uid = validJwts[jwt];
    return uid
      ? jsonResponse(200, { $id: uid, email: users[uid]?.email || '', name: users[uid]?.name || '', emailVerification: Boolean(users[uid]?.emailVerification) })
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
  // Official transaction update: PATCH /tablesdb/transactions/{id} with
  // { commit: true } or { rollback: true }. The old invented
  // `POST .../commit` route is intentionally NOT implemented here — hitting
  // it falls through to the 404 below, so any regression fails loudly.
  const txnRoute = path.match(/^\/tablesdb\/transactions\/(txn-\d+)$/);
  if (txnRoute && method === 'PATCH') {
    const ops = openTxns.get(txnRoute[1]) ?? [];
    if (parsedBody && parsedBody.rollback) {
      if (failRollback) return jsonResponse(500, { error: 'rollback failed' });
      openTxns.delete(txnRoute[1]);
      return jsonResponse(200, { $id: txnRoute[1], status: 'rolled back' });
    }
    if (parsedBody && parsedBody.commit) {
      if (forceCommitFailure) return jsonResponse(500, { error: 'commit failed' });
      openTxns.delete(txnRoute[1]);
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
      return jsonResponse(200, { $id: txnRoute[1], status: 'committed' });
    }
    return jsonResponse(200, { $id: txnRoute[1], status: 'open' });
  }
  const create = path.match(/^\/tablesdb\/[^/]+\/tables\/([^/]+)\/rows$/);
  if (create && method === 'POST') {
    const t = tbl(create[1]);
    const rowId = parsedBody.rowId === 'unique()' ? genId() : parsedBody.rowId;
    if (staging) {
      if (failStagedCreateFor === create[1]) return jsonResponse(500, { error: 'injected stage failure' });
      openTxns.get(stageTxn).push({ action: 'create', tableId: create[1], rowId, data: parsedBody.data ?? {} });
      return jsonResponse(201, { $id: rowId, ...parsedBody.data });
    }
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
      if (staging) {
        if (throwOnStagedPatch) throw new Error('network interruption');
        openTxns.get(stageTxn).push({ action: 'update', tableId: rowPath[1], rowId: rowPath[2], data: parsedBody.data ?? {} });
        return jsonResponse(200, { ...cur, ...parsedBody.data });
      }
      const upd = { ...cur, ...parsedBody.data };
      t.set(rowPath[2], upd);
      return jsonResponse(200, upd);
    }
    if (method === 'DELETE') {
      if (staging) { openTxns.get(stageTxn).push({ action: 'delete', tableId: rowPath[1], rowId: rowPath[2] }); return jsonResponse(204, null); }
      if (failDeleteFor === rowPath[1]) return jsonResponse(500, { error: 'injected delete failure' });
      t.delete(rowPath[2]);
      return jsonResponse(204, null);
    }
  }
  const list = path.match(/^\/tablesdb\/[^/]+\/tables\/([^/]+)\/rows$/);
  if (list && method === 'GET') {
    const queries = new URL(url).searchParams.getAll('queries[]');
    let rows;
    try {
      rows = applyFilters([...tbl(list[1]).values()], queries);
    } catch (e) {
      return jsonResponse(400, { error: String(e.message) });
    }
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
  capturedRequests.push({
    method,
    path,
    body: parsed ?? null,
    transactionHeader: Boolean(headers['X-Appwrite-Transaction-Id']),
    queries: new URL(url).searchParams.getAll('queries[]'),
  });
  if (path === '/account' && method === 'GET') {
    const jwt = headers['X-Appwrite-JWT'];
    const uid = validJwts[jwt];
    return uid
      ? jsonResponse(200, { $id: uid, emailVerification: Boolean(users[uid]?.emailVerification) })
      : jsonResponse(401, { error: 'invalid jwt' });
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
  failStagedCreateFor = null;
  failDeleteFor = null;
  throwOnStagedPatch = false;
  failRollback = false;
  capturedRequests.length = 0;
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

// ---- Transaction wire format (official API contract) -------------------------

test('the invented POST commit endpoint does not exist in the API', async () => {
  const h = { 'X-Appwrite-Project': 'test-project', 'X-Appwrite-Key': 'test-server-key', 'Content-Type': 'application/json' };
  const created = await (await fetch('https://sgp.cloud.appwrite.io/v1/tablesdb/transactions', { method: 'POST', headers: h, body: '{}' })).json();
  assert.match(created.$id, /^txn-\d+$/);
  const wrong = await fetch(`https://sgp.cloud.appwrite.io/v1/tablesdb/transactions/${created.$id}/commit`, { method: 'POST', headers: h, body: '{}' });
  assert.equal(wrong.status, 404, 'POST .../commit is not a real route');
  const right = await fetch(`https://sgp.cloud.appwrite.io/v1/tablesdb/transactions/${created.$id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ commit: true }) });
  assert.equal(right.status, 200, 'commit is a PATCH on the transaction resource');
  const rolledBack = await (await fetch(`https://sgp.cloud.appwrite.io/v1/tablesdb/transactions/${created.$id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ rollback: true }) })).json();
  assert.match(rolledBack.status, /committed|rolled back/);
});

test('pairing uses the official transaction wire format end to end', async () => {
  freshWorld();
  const start = await call('pair.start', 'jwt-a', {});
  assert.equal(start.code, 200, JSON.stringify(start));
  const join = await call('pair.join', 'jwt-b', { code: start.data.code });
  assert.equal(join.code, 200, JSON.stringify(join));
  const commits = capturedRequests.filter((r) => r.method === 'PATCH' && /^\/tablesdb\/transactions\/txn-\d+$/.test(r.path) && r.body && r.body.commit);
  assert.ok(commits.length >= 2, 'pair.start and pair.join both commit via PATCH {commit:true}');
  assert.ok(!capturedRequests.some((r) => r.method === 'POST' && r.path.endsWith('/commit')), 'no invented POST commit route is ever called');
  assert.ok(!capturedRequests.some((r) => r.transactionHeader), 'no transaction header is ever sent');
  const staged = capturedRequests.filter((r) => r.body && r.body.transactionId);
  assert.ok(staged.length >= 6, 'row operations stage via body transactionId');
});

test('rollback discards staged operations after a failed stage', async () => {
  freshWorld();
  failStagedCreateFor = 'invitations';
  const r = await call('pair.start', 'jwt-a', {});
  failStagedCreateFor = null;
  assert.equal(r.code, 500);
  assert.equal([...tbl('couples').values()].length, 0, 'no orphan couple');
  assert.equal([...tbl('invitations').values()].length, 0, 'no orphan invitation');
  assert.equal(tbl('profiles').get('user-a').couple_id ?? null, null, 'profile not linked');
  const rollbacks = capturedRequests.filter((r2) => r2.method === 'PATCH' && /^\/tablesdb\/transactions\/txn-\d+$/.test(r2.path) && r2.body && r2.body.rollback);
  assert.ok(rollbacks.length >= 1, 'an explicit rollback was issued');
});

test('a failed commit in pair.start applies nothing', async () => {
  freshWorld();
  forceCommitFailure = true;
  const r = await call('pair.start', 'jwt-a', {});
  forceCommitFailure = false;
  assert.equal(r.code, 500);
  assert.equal([...tbl('couples').values()].length, 0);
  assert.equal(tbl('profiles').get('user-a').couple_id ?? null, null);
});

// ---- Email verification gate -------------------------------------------------

test('an unverified account cannot start pairing or join', async () => {
  freshWorld();
  const r1 = await call('pair.start', 'jwt-u', {});
  assert.equal(r1.code, 403);
  assert.match(r1.error, /Verify your email/);
  const r2 = await call('pair.join', 'jwt-u', { code: 'XXXX-XXXX' });
  assert.equal(r2.code, 403);
  assert.equal([...tbl('couples').values()].length, 0);
});

test('an unverified account can still bootstrap and read its own profile', async () => {
  freshWorld();
  const r = await call('profile.get', 'jwt-u', {});
  assert.equal(r.code, 200);
  assert.equal(r.data.profile.$id, 'user-u');
});

// ---- Secret hygiene ------------------------------------------------------------

test('the function refuses to start without a real pepper', async () => {
  const saved = process.env.APPWRITE_CODE_PEPPER;
  try {
    delete process.env.APPWRITE_CODE_PEPPER;
    await assert.rejects(() => import('../src/lib.js?nosecret'), /APPWRITE_CODE_PEPPER/);
    process.env.APPWRITE_CODE_PEPPER = 'short';
    await assert.rejects(() => import('../src/lib.js?weaksecret'), /APPWRITE_CODE_PEPPER/);
  } finally {
    process.env.APPWRITE_CODE_PEPPER = saved;
  }
});

test('invitation digests are peppered, never plain SHA-256 of the code', async () => {
  freshWorld();
  const r = await call('pair.start', 'jwt-a', {});
  const invite = [...tbl('invitations').values()][0];
  const plain = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(r.data.code)))]
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  assert.notEqual(invite.code_digest, plain, 'digest must not be an unsalted hash');
  assert.notEqual(invite.code_digest, r.data.code);
});

// ---- Reveal atomicity ------------------------------------------------------------

test('a failed reveal commit self-heals on the next state read', async () => {
  seedCouple();
  const letter = (await call('letter.today', 'jwt-a', {})).data.letter;
  await call('response.submit', 'jwt-a', { letter_id: letter.$id, body: 'A' });
  forceCommitFailure = true;
  const r2 = await call('response.submit', 'jwt-b', { letter_id: letter.$id, body: 'B' });
  forceCommitFailure = false;
  assert.equal(r2.code, 200, 'the second submission itself succeeds');
  assert.equal(r2.data.revealed, false, 'reveal stamping did not complete');
  for (const row of tbl('responses').values()) assert.equal(row.revealed_at ?? null, null, 'no partial stamp');
  const state = await call('response.state', 'jwt-a', { letter_id: letter.$id });
  assert.equal(state.data.revealed, true, 'self-healed to a full reveal');
  for (const row of tbl('responses').values()) assert.ok(row.revealed_at, 'both rows stamped');
});

// ---- Account deletion robustness -------------------------------------------------

test('account deletion paginates beyond a single 100-row page', async () => {
  seedCouple();
  for (let i = 0; i < 150; i += 1) {
    tbl('mood_check_ins').set(`mood-${i}`, { $id: `mood-${i}`, couple_id: 'couple-1', author_id: 'user-b', emoji: 'x', note: '', created_at: now() });
  }
  const r = await call('account.delete', 'jwt-b', {});
  assert.equal(r.code, 200, JSON.stringify(r));
  assert.equal([...tbl('mood_check_ins').values()].filter((m) => m.author_id === 'user-b').length, 0, 'all 150 rows deleted');
});

test('a failed delete reports 500 and can be retried to completion', async () => {
  seedCouple();
  await call('memory.create', 'jwt-a', { title: 'keepme', note: '', memory_date: '2026-10-01' });
  failDeleteFor = 'memories';
  const r1 = await call('account.delete', 'jwt-a', {});
  failDeleteFor = null;
  assert.equal(r1.code, 500, 'partial failure is reported, not masked');
  assert.ok([...tbl('memories').values()].length, 'memory retained after failed run');
  const r2 = await call('account.delete', 'jwt-a', {});
  assert.equal(r2.code, 200, 'retry completes');
  assert.equal([...tbl('memories').values()].length, 0);
  assert.equal(tbl('profiles').get('user-a'), undefined);
  assert.equal(tbl('couples').get('couple-1').partner_a_id ?? null, null, 'caller slot cleared');
});

test('partner reactions on the deleted account responses are removed (no orphans)', async () => {
  seedCouple();
  const letter = (await call('letter.today', 'jwt-a', {})).data.letter;
  await call('response.submit', 'jwt-a', { letter_id: letter.$id, body: 'A final' });
  await call('response.submit', 'jwt-b', { letter_id: letter.$id, body: 'B final' });
  const aResp = (await call('response.state', 'jwt-b', { letter_id: letter.$id })).data.partner.$id;
  const react = await call('reaction.set', 'jwt-b', { response_id: aResp, kind: 'heart' });
  assert.equal(react.code, 200, JSON.stringify(react));
  assert.equal([...tbl('reactions').values()].length, 1);
  const r = await call('account.delete', 'jwt-a', {});
  assert.equal(r.code, 200, JSON.stringify(r));
  assert.equal([...tbl('reactions').values()].length, 0, 'orphan reaction removed with its target');
  assert.equal([...tbl('responses').values()].find((x) => x.author_id === 'user-a'), undefined);
});

// ---- Official Query serialization (P0-A regression oracles) -------------------

test('couple lookups serialize queries in the official JSON format', async () => {
  freshWorld();
  const r = await call('pair.start', 'jwt-a', {});
  assert.equal(r.code, 200, JSON.stringify(r));
  const parsedQueries = capturedRequests
    .flatMap((x) => x.queries || [])
    .map((s) => { try { return JSON.parse(s); } catch { return null; } })
    .filter(Boolean);
  assert.ok(
    parsedQueries.some((p) => p.method === 'equal' && p.attribute === 'partner_a_id' && Array.isArray(p.values) && p.values.includes('user-a')),
    `expected official equal query, got: ${JSON.stringify(parsedQueries)}`
  );
  assert.ok(parsedQueries.some((p) => p.method === 'limit' && p.values[0] === 1), 'limit query uses the official shape');
  assert.equal(
    capturedRequests.some((x) => (x.queries || []).some((s) => /^equal\(|^limit\(/.test(s))),
    false,
    'no legacy function-call query strings are ever sent'
  );
});

test('the legacy non-JSON query syntax is rejected; the official format is accepted', async () => {
  const h = { 'X-Appwrite-Project': 'test-project', 'X-Appwrite-Key': 'test-server-key' };
  const base = 'https://sgp.cloud.appwrite.io/v1/tablesdb/couples_main/tables/couples/rows';
  const legacy = await fetch(`${base}?queries[]=${encodeURIComponent('equal("partner_a_id", "user-a")')}`, { headers: h });
  assert.equal(legacy.status, 400, 'legacy equal(...) strings must be rejected');
  const modern = await fetch(`${base}?queries[]=${encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'partner_a_id', values: ['user-a'] }))}`, { headers: h });
  assert.equal(modern.status, 200);
});

test('an unexpected 2xx list body without rows is an error, not an empty result', async () => {
  const lib = await import('../src/lib.js');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, headers: { get: () => '0' }, json: async () => ({ total: 0 }) });
  try {
    await assert.rejects(() => lib.listRowsWhere('couples', [['equal', 'partner_a_id', 'user-a']], 1), /unexpected response shape/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---- Account deletion failure matrix (P0-B) -----------------------------------

test('content-cleanup failure preserves credentials for a safe retry', async () => {
  seedCouple();
  await call('memory.create', 'jwt-a', { title: 'keepme', note: '', memory_date: '2026-10-01' });
  failDeleteFor = 'memories';
  const r1 = await call('account.delete', 'jwt-a', {});
  failDeleteFor = null;
  assert.equal(r1.code, 500, 'failure reported accurately');
  assert.ok(users['user-a'], 'auth user NOT deleted while cleanup failed');
  assert.ok(tbl('profiles').get('user-a'), 'profile row retained for the retry');
  assert.equal(tbl('couples').get('couple-1').partner_a_id ?? null, null, 'caller unlinked');
  assert.equal(tbl('couples').get('couple-1').partner_b_id, 'user-b', 'partner keeps the couple');
  assert.ok([...tbl('memories').values()].length, 'failed row retained');
  const access = await call('memory.list', 'jwt-a', {});
  assert.equal(access.code, 403, 'unlinked member loses couple access immediately');
  const partnerView = await call('letter.today', 'jwt-b', {});
  assert.equal(partnerView.code, 200, 'surviving partner keeps full access');
  const r2 = await call('account.delete', 'jwt-a', {});
  assert.equal(r2.code, 200, 'retry completes');
  assert.equal(users['user-a'], undefined, 'credentials destroyed only after full cleanup');
  assert.equal(tbl('profiles').get('user-a'), undefined);
  assert.equal([...tbl('memories').values()].length, 0);
});

test('last-member cleanup failure keeps the couple resolvable for retry', async () => {
  seedCouple();
  tbl('couples').get('couple-1').partner_b_id = null;
  tbl('profiles').delete('user-b');
  await call('letter.today', 'jwt-a', {});
  failDeleteFor = 'daily_letters';
  const r1 = await call('account.delete', 'jwt-a', {});
  failDeleteFor = null;
  assert.equal(r1.code, 500);
  assert.ok(users['user-a'], 'credentials intact after shared-cleanup failure');
  const couple = tbl('couples').get('couple-1');
  assert.ok(couple, 'couple row retained');
  assert.equal(couple.partner_a_id, 'user-a', 'membership preserved so the retry re-enters the last-member branch');
  const r2 = await call('account.delete', 'jwt-a', {});
  assert.equal(r2.code, 200, JSON.stringify(r2));
  assert.equal(tbl('couples').get('couple-1'), undefined, 'couple removed on retry');
  assert.equal([...tbl('daily_letters').values()].length, 0, 'shared letters removed with the couple');
  assert.equal(users['user-a'], undefined);
  assert.equal(tbl('profiles').get('user-a'), undefined);
});

test('a departing member invites are revoked while the partner invite is retained', async () => {
  seedCouple();
  tbl('invitations').set('inv-a', { $id: 'inv-a', couple_id: 'couple-1', created_by: 'user-a', code_digest: 'a', expires_at: new Date(Date.now() + DAY_MS).toISOString(), created_at: now() });
  tbl('invitations').set('inv-b', { $id: 'inv-b', couple_id: 'couple-1', created_by: 'user-b', code_digest: 'b', expires_at: new Date(Date.now() + DAY_MS).toISOString(), created_at: now() });
  const r = await call('account.delete', 'jwt-a', {});
  assert.equal(r.code, 200, JSON.stringify(r));
  assert.equal([...tbl('invitations').values()].find((i) => i.created_by === 'user-a'), undefined, 'departing member invite revoked');
  assert.ok([...tbl('invitations').values()].find((i) => i.created_by === 'user-b'), 'partner invite retained');
});

// ---- Transaction robustness (Phase 4) -----------------------------------------

test('a commit conflict fails the whole transaction without partial application', async () => {
  freshWorld();
  const lib = await import('../src/lib.js');
  tbl('couples').set('couple-x', { $id: 'couple-x', partner_a_id: 'z', partner_b_id: null, created_at: now() });
  const out = await lib.withTransaction(async (apiTx) => apiTx('POST', 'couples', 'couple-x', { partner_a_id: 'y', created_at: now() }));
  assert.equal(out.ok, false);
  assert.equal(out.status, 409);
  assert.equal(tbl('couples').get('couple-x').partner_a_id, 'z', 'existing row untouched by the failed commit');
});

test('a thrown stage triggers a best-effort rollback and leaves no partial state', async () => {
  freshWorld();
  const start = await call('pair.start', 'jwt-a', {});
  throwOnStagedPatch = true;
  const r = await call('pair.join', 'jwt-b', { code: start.data.code });
  throwOnStagedPatch = false;
  assert.equal(r.code, 500, 'network interruption surfaces as a server error');
  const rollbacks = capturedRequests.filter((x) => x.method === 'PATCH' && /^\/tablesdb\/transactions\/txn-\d+$/.test(x.path) && x.body && x.body.rollback);
  assert.ok(rollbacks.length >= 1, 'rollback issued after the exception');
  assert.equal(tbl('couples').get(start.data.coupleId).partner_b_id ?? null, null, 'no partial join');
  assert.equal([...tbl('invitations').values()][0].consumed_at ?? null, null, 'invitation not consumed');
});

test('a rollback failure does not mask the original stage failure', async () => {
  freshWorld();
  const start = await call('pair.start', 'jwt-a', {});
  failRollback = true;
  throwOnStagedPatch = true;
  const r = await call('pair.join', 'jwt-b', { code: start.data.code });
  failRollback = false;
  throwOnStagedPatch = false;
  assert.equal(r.code, 500, 'original failure still reported');
  assert.equal(tbl('couples').get(start.data.coupleId).partner_b_id ?? null, null, 'no partial state despite failed rollback');
});
