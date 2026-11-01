/**
 * Validates the proposed Appwrite TablesDB schema without contacting Appwrite.
 * Security regression guard: never loosen default-DENY private table access.
 *
 * Usage (no dependencies): node scripts/validate-appwrite-schema.mjs
 * This DOES NOT provision any cloud resource.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';

const s = JSON.parse(fs.readFileSync(new URL('../appwrite/schema.contract.json', import.meta.url), 'utf8'));
assert.equal(s.status, 'PROPOSED_NOT_PROVISIONED');
assert.equal(s.project_id, '6ae6e1be00021a01c9ec');
assert.equal(s.endpoint, 'https://sgp.cloud.appwrite.io/v1');
assert.equal(s.database.database_id, 'couples_main');
assert.equal(s.database.specification, 'serverless');
assert.deepEqual(s.security.default_table_permissions, []);
assert.equal(s.security.no_direct_client_access, true);
assert.ok(Array.isArray(s.tables) && s.tables.length >= 14);
const ids = new Set();
let checkedColumns = 0, checkedIndexes = 0;
for (const table of s.tables) {
  assert.match(table.table_id, /^[a-z][a-z0-9_]{0,35}$/);
  assert.ok(!ids.has(table.table_id), 'Duplicate table ' + table.table_id);
  ids.add(table.table_id);
  assert.deepEqual(table.permissions, [], 'Private table permissions must be DENY: ' + table.table_id);
  assert.equal(table.row_security, false, 'Only privileged Functions may read/write private tables: ' + table.table_id);
  assert.equal(table.enabled, true);
  const keys = new Set();
  for (const c of table.columns) {
    assert.match(c.key, /^[a-z][a-z0-9_]{0,35}$/);
    assert.ok(!keys.has(c.key), 'Duplicate column ' + table.table_id + '.' + c.key);
    assert.ok(['varchar','text','integer','boolean','datetime'].includes(c.type), 'Unsupported type: ' + c.type);
    if (c.type === 'varchar') assert.ok(c.size > 0 && c.size <= 16383);
    assert.equal(typeof c.required, 'boolean');
    keys.add(c.key);
    checkedColumns++;
  }
  const indexes = new Set();
  for (const ix of table.indexes) {
    assert.ok(!indexes.has(ix.key), 'Duplicate index ' + ix.key);
    indexes.add(ix.key);
    assert.ok(['key','unique'].includes(ix.type));
    assert.ok(ix.attributes.length >= 1 && ix.attributes.every(k => keys.has(k)));
    checkedIndexes++;
  }
}
for (const needed of ['profiles','couples','invitations','daily_letters','responses','reactions','memories','mood_check_ins','pocket_notes','weekly_adventures','adventure_parts']) {
  assert.ok(ids.has(needed), 'Missing table ' + needed);
}
const uniq = (table, columns) =>
  s.tables.find(t => t.table_id === table).indexes.some(i =>
    i.type === 'unique' && JSON.stringify(i.attributes) === JSON.stringify(columns));
assert.ok(uniq('daily_letters', ['couple_id','letter_date']), 'No single daily letter per couple');
assert.ok(uniq('responses', ['letter_id','author_id']), 'No one-answer-per-author constraint');
assert.ok(uniq('reactions', ['response_id','author_id']), 'No reaction ownership uniqueness');
assert.ok(uniq('weekly_adventures', ['couple_id','week_of']), 'No one-weekly-adventure constraint');
assert.ok(uniq('adventure_parts', ['adventure_id','author_id']), 'No one-part-per-author constraint');
assert.ok(uniq('invitations', ['code_digest']), 'Invitation replay/uniqueness constraint missing');
console.log(JSON.stringify({
  result: 'PASS',
  cloudProvisioned: false,
  tables: s.tables.length,
  columns: checkedColumns,
  indexes: checkedIndexes,
  projectId: s.project_id,
  databaseId: s.database.database_id,
  authorization: 'DENY_ALL_CLIENT_TABLE_ACCESS'
}, null, 2));
