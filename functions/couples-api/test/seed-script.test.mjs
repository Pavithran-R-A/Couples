// Script-level tests for scripts/seed-question-bank.mjs. The suite runs the
// REAL script against a PATH-independent CLI shim (APPWRITE_CLI_PATH) that
// emulates `appwrite tablesdb` responses, then asserts the script's exit
// code and verification output for: success, tampered content, unexpected
// table count, and malformed readback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');

const SHIM = `
import fs from 'fs';
const seed = JSON.parse(fs.readFileSync(process.env.SEED_FILE, 'utf8'));
const args = process.argv.slice(2);
const get = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const mode = process.env.SHIM_MODE;
if (args[0] === 'tablesdb' && args[1] === 'create-row') { console.log(JSON.stringify({ ok: true })); process.exit(0); }
if (args[0] === 'tablesdb' && args[1] === 'get-row') {
  const id = get('--row-id');
  const q = seed.questions.find((x) => x.id === id);
  if (!q) { console.log(JSON.stringify({ error: 'nf' })); process.exit(0); }
  const row = { $id: q.id, category: q.category, text: q.text };
  if (mode === 'badtext' && id === 'q05') row.text = 'tampered content';
  if (mode === 'malformed' && id === 'q07') { console.log('NOT JSON AT ALL'); process.exit(0); }
  console.log(JSON.stringify(row));
  process.exit(0);
}
if (args[0] === 'tablesdb' && args[1] === 'list-rows') {
  console.log(JSON.stringify({ total: mode === 'badcount' ? 91 : seed.count, rows: [] }));
  process.exit(0);
}
console.log(JSON.stringify({ error: 'unknown route' }));
process.exit(0);
`;

function runSeed(mode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seedshim-'));
  const shim = path.join(dir, 'shim.mjs');
  fs.writeFileSync(shim, SHIM);
  const env = {
    ...process.env,
    APPWRITE_CLI_PATH: shim,
    SHIM_MODE: mode,
    SEED_FILE: path.join(root, 'appwrite', 'questions.seed.json'),
  };
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'seed-question-bank.mjs')], {
    encoding: 'utf8', env, timeout: 180000,
  });
}

test('seed script exits 0 when every row reads back identical', () => {
  const r = runSeed('ok');
  assert.equal(r.status, 0, `stdout: ${r.stdout}\nstderr: ${r.stderr}`);
  assert.match(r.stdout, /READBACK == SNAPSHOT/);
  assert.match(r.stdout, /readback: 90\/90/);
});

test('seed script exits nonzero on tampered row content', () => {
  const r = runSeed('badtext');
  assert.notEqual(r.status, 0, 'checksum/content mismatch must be terminal');
  assert.match(String(r.stderr), /READBACK MISMATCH for q05/);
  assert.match(String(r.stderr), /READBACK CHECKSUM != SNAPSHOT CHECKSUM/);
});

test('seed script exits nonzero on an unexpected table count', () => {
  const r = runSeed('badcount');
  assert.notEqual(r.status, 0, 'unexpected extra records must be terminal');
  assert.match(String(r.stderr), /TABLE COUNT 91 != expected 90/);
});

test('seed script exits nonzero on a malformed readback response', () => {
  const r = runSeed('malformed');
  assert.notEqual(r.status, 0, 'unparseable readback must be terminal');
  assert.match(String(r.stderr), /READBACK INCOMPLETE: 89\/90/);
});
