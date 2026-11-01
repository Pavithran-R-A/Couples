// Shared infrastructure for the couples-api function: pinned-origin API
// access, strict identifier validation (SSRF hardening), identity helpers
// and small date/id utilities. Zero npm dependencies.
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

const jsonHeaders = { 'Content-Type': 'application/json', 'X-Appwrite-Project': PROJECT, 'X-Appwrite-Key': API_KEY };

export async function api(method, table, rowId, body) {
  const target = rowId === undefined
    ? `${ENDPOINT}/tablesdb/${DB}/tables/${table}/rows`
    : `${ENDPOINT}/tablesdb/${DB}/tables/${table}/rows/${safeId(rowId, 'rowId')}`;
  const r = await fetch(target, {
    method,
    headers: jsonHeaders,
    body: body === undefined ? undefined : JSON.stringify({ data }),
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: r.status, data, total: Number(r.headers.get('x-appwrite-total') || 0) };
}

export const getRow = (table, rowId) => api('GET', table, safeId(rowId, 'rowId'));
export const createRow = (table, rowId, data) => api('POST', table, rowId === 'unique()' ? undefined : rowId, data);
export const updateRow = (table, rowId, data) => api('PATCH', table, rowId, data);
export const deleteRow = (table, rowId) => api('DELETE', table, safeId(rowId, 'rowId'));

export async function listRowsQ(table, filters, limit = 100) {
  const queries = filters.map(([method, attr, value]) => `${method}(${JSON.stringify(attr)}, ${JSON.stringify(value)})`);
  queries.push(`limit(${Math.min(limit, 100)})`, 'orderDesc("$createdAt")');
  const url = `${ENDPOINT}/tablesdb/${DB}/tables/${table}/rows?queries[]=${encodeURIComponent(JSON.stringify(queries))}`;
  const r = await fetch(url, { headers: jsonHeaders });
  const data = await r.json().catch(() => null);
  return data?.rows ?? [];
}

export async function transaction(operations) {
  const r = await fetch(`${ENDPOINT}/tablesdb/transactions`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      operations: operations.map((o) => ({
        action: o.action,
        tableId: o.tableId,
        rowId: safeId(o.rowId, 'rowId'),
        data: o.data,
      })),
    }),
  });
  return { status: r.status, data: await r.json().catch(() => null) };
}

export async function getUser(userId) {
  const r = await fetch(`${ENDPOINT}/users/${safeId(userId, 'userId')}`, { headers: jsonHeaders });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

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

export function fail(res, code, message) { return res.json({ ok: false, error: message }, code); }

export async function getCouple(userId) {
  const mine = await listRowsQ('couples', [['equal', 'partner_a_id', userId]], 1);
  if (mine.length) return mine[0];
  const theirs = await listRowsQ('couples', [['equal', 'partner_b_id', userId]], 1);
  return theirs[0] ?? null;
}

export async function getProfile(userId) {
  const r = await getRow('profiles', userId);
  return r.status === 200 ? r.data : null;
}
