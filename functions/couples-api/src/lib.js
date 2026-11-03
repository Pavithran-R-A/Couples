// Shared infrastructure for the couples-api function: pinned-origin API
// access, strict identifier validation (SSRF hardening), verified-caller
// authentication, TablesDB transaction lifecycle, and small date/id
// utilities. Zero npm dependencies.
//
// SSRF hardening: the API origin is pinned at module load to the https
// endpoint from the deployment environment; every path segment built from
// client input is validated against a strict allowlist (Appwrite row IDs are
// [A-Za-z0-9][_a-zA-Z0-9-]{0,35}) and URI-encoded, so client data can never
// alter the request target.

export const ENDPOINT = String(process.env.APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1').replace(/\/+$/, '');
export const PROJECT = String(process.env.APPWRITE_FUNCTION_PROJECT_ID || '');
export const API_KEY = String(process.env.APPWRITE_API_KEY || '');
export const DB = 'couples_main';
export const PEPPER = String(process.env.APPWRITE_CODE_PEPPER || '');
export const DAY_MS = 86400000;
export const INVITE_TTL_DAYS = 7;
export const WARMTH_STEP = 4;
export const WARMTH_MAX = 100;

if (!ENDPOINT.startsWith('https://')) {
  throw new Error('couples-api: APPWRITE_ENDPOINT must be an https URL.');
}
if (!PROJECT || !API_KEY) {
  throw new Error('couples-api: APPWRITE_API_KEY / APPWRITE_FUNCTION_PROJECT_ID are required.');
}

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,35}$/;
export function safeId(value, label) {
  const v = String(value ?? '');
  if (!ID_RE.test(v)) throw new Error(`${label}: invalid identifier.`);
  return encodeURIComponent(v);
}

export function fail(res, code, message) { return res.json({ ok: false, error: message }, code); }

export const now = () => new Date().toISOString();
export const dayKey = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const weekKey = (d = new Date()) => {
  const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day);
  return t.toISOString().slice(0, 10);
};

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text + PEPPER));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(8));
  let out = '';
  for (let i = 0; i < 8; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out.slice(0, 4) + '-' + out.slice(4);
}

function headers(withJson) {
  const h = { 'X-Appwrite-Project': PROJECT, 'X-Appwrite-Key': API_KEY };
  if (withJson) h['Content-Type'] = 'application/json';
  return h;
}

// TablesDB rows REST helpers. Documented shapes:
//   create: POST /tablesdb/{db}/tables/{t}/rows  body { rowId?, data }
//   update: PATCH /tablesdb/{db}/tables/{t}/rows/{rowId}  body { data }
//   get/delete: .../rows/{rowId}  (rowId is the row's $id)
// The API key acts with admin permissions, so every call site MUST enforce
// authorization before reaching these helpers.
export async function api(method, table, rowId, data, txnId) {
  const isCreate = method === 'POST';
  const target = isCreate
    ? `${ENDPOINT}/tablesdb/${DB}/tables/${table}/rows`
    : `${ENDPOINT}/tablesdb/${DB}/tables/${table}/rows/${safeId(rowId, 'rowId')}`;
  const h = headers(data !== undefined);
  if (txnId) h['X-Appwrite-Transaction-Id'] = txnId;
  // Documented bodies: create { rowId?, data }; update PATCH { data }.
  let body;
  if (isCreate) body = { rowId: rowId ?? 'unique()', data: data ?? {} };
  else if (method === 'PATCH' && data !== undefined) body = { data };
  const r = await fetch(target, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const out = await r.json().catch(() => null);
  return { status: r.status, data: out, total: Number(r.headers.get('x-appwrite-total') || 0) };
}

export const createRow = (table, rowId, data, txnId) => api('POST', table, rowId, data, txnId);
export const getRow = (table, rowId) => api('GET', table, rowId);
export const updateRow = (table, rowId, data, txnId) => api('PATCH', table, rowId, data, txnId);
export const deleteRow = (table, rowId) => api('DELETE', table, rowId);

export function qLimit(n) {
  return `limit(${n})`;
}

export function qEqual(attr, value) {
  return `equal(${JSON.stringify(attr)}, ${JSON.stringify(value)})`;
}

// Lists rows as a plain array. A failing list THROWS rather than returning
// []: treating an API error as "no rows" would wrongly admit create paths.
export async function listRowsWhere(table, filters, limit = 100, txnId) {
  // Documented shape: one queries[] parameter per query string, each
  // individually URI-encoded (Appwrite rejects a JSON-array parameter).
  const queries = [...filters.map(([, attr, value]) => qEqual(attr, value)), qLimit(limit)];
  const qs = queries.map((q) => `queries[]=${encodeURIComponent(q)}`).join('&');
  const url = `${ENDPOINT}/tablesdb/${DB}/tables/${table}/rows?${qs}`;
  const h = headers(false);
  if (txnId) h['X-Appwrite-Transaction-Id'] = txnId;
  const r = await fetch(url, { headers: h });
  const out = await r.json().catch(() => null);
  if (r.status >= 400) throw new Error(`listRowsWhere ${table}: HTTP ${r.status}`);
  return out?.rows ?? [];
}

// TablesDB transaction lifecycle (documented): create the transaction, stage
// row operations against it via the transaction header, then commit.
// Committed operations apply atomically; an abandoned transaction leaves no
// partial state.
export async function transactionCreate() {
  const r = await fetch(`${ENDPOINT}/tablesdb/transactions`, { method: 'POST', headers: headers(true), body: '{}' });
  const out = await r.json().catch(() => null);
  return { status: r.status, data: out };
}

export async function transactionCommit(txnId) {
  const r = await fetch(`${ENDPOINT}/tablesdb/transactions/${safeId(txnId, 'txnId')}/commit`, {
    method: 'POST', headers: headers(true),
  });
  const out = await r.json().catch(() => null);
  return { status: r.status, data: out };
}

export async function withTransaction(run) {
  const created = await transactionCreate();
  if (created.status >= 400) return { status: created.status, ok: false };
  const txnId = created.data?.$id;
  const staged = await run((method, table, rowId, data) => api(method, table, rowId, data, txnId));
  // Abort on any failed stage — either the runner reported its own verdict
  // (ok:false) or a raw API result carries a failing status. The transaction
  // is abandoned uncommitted, so no partial state is ever applied.
  if (staged && staged.ok === false) return { status: staged.status ?? 409, ok: false };
  if (staged && typeof staged.status === 'number' && staged.status >= 400) return { status: staged.status, ok: false };
  const committed = await transactionCommit(txnId);
  return { status: committed.status, ok: committed.status < 400 };
}

// Verified-caller authentication: the x-appwrite-user-jwt header is validated
// against the project by calling /account with the JWT itself (no API key).
// Only a JWT Appwrite accepts returns the caller — spoofed headers fail here.
export async function verifyCaller(jwt) {
  const r = await fetch(`${ENDPOINT}/account`, {
    headers: { 'X-Appwrite-Project': PROJECT, 'X-Appwrite-JWT': jwt },
  });
  if (!r.ok) return null;
  const data = await r.json().catch(() => null);
  return data && data.$id ? { id: data.$id, email: data.email || '', name: data.name || '' } : null;
}

export async function getCouple(userId) {
  const mine = await listRowsWhere('couples', [['equal', 'partner_a_id', userId]], 1);
  if (mine.length) return mine[0];
  const theirs = await listRowsWhere('couples', [['equal', 'partner_b_id', userId]], 1);
  return theirs[0] ?? null;
}

export async function getProfile(userId) {
  const r = await getRow('profiles', userId);
  return r.status === 200 ? r.data : null;
}

