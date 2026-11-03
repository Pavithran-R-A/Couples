// Deploys the reviewed TablesDB contract (appwrite/schema.contract.json) to
// the verified Appwrite project via the official CLI. Idempotent: existing
// databases, tables, columns and indexes are detected and skipped, so the
// script can be rerun safely. Requires a completed `appwrite login` session
// and the linked project (appwrite.config.json).
//
// Usage: node scripts/deploy-appwrite-schema.mjs [--dry-run]
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dryRun = process.argv.includes('--dry-run');

const contract = JSON.parse(readFileSync(join(root, 'appwrite', 'schema.contract.json'), 'utf8'));
const config = JSON.parse(readFileSync(join(root, 'appwrite.config.json'), 'utf8'));
const PROJECT = process.env.APPWRITE_PROJECT_ID || config.projectId;
if (!PROJECT) {
  console.error('No project id: appwrite.config.json is missing or malformed.');
  process.exit(1);
}
const DB = contract.database.database_id;
const DB_NAME = contract.database.name;

let failures = 0;
const unsupported = [];
// Index types accepted by `appwrite tablesdb create-index` (CLI help text).
const KNOWN_INDEX_TYPES = new Set(['key', 'fulltext', 'unique', 'spatial', 'trigram']);
function run(args, { allowFail = false } = {}) {
  if (dryRun) {
    console.log('DRY:', 'appwrite', args.join(' '));
    return '';
  }
  try {
    return execFileSync('appwrite', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
  } catch (e) {
    const out = String(e.stdout || '') + String(e.stderr || '') + String(e.message || '');
    if (allowFail) return out;
    console.error('CLI FAILED:', 'appwrite', args.slice(0, 4).join(' '));
    console.error(out.slice(0, 800));
    failures += 1;
    return out;
  }
}

function existsTable(tableId) {
  const out = run(['tablesdb', 'get-table', '--database-id', DB, '--table-id', tableId], { allowFail: true });
  return !/not found|Error/i.test(out) && /tableId|name/i.test(out);
}

function columnReady(tableId, key) {
  const out = run(['tablesdb', 'get-column', '--database-id', DB, '--table-id', tableId, '--key', key], { allowFail: true });
  return /available/i.test(out);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitColumns(tableId, keys) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (keys.every((k) => columnReady(tableId, k))) return true;
    await sleep(2000);
  }
  return false;
}

// Column commands verified against the installed Appwrite CLI (`appwrite
// tablesdb --help`): text and longtext are separate commands with identical
// flag shapes (no --size flag); varchar/string carries --size.
function columnArgs(tableId, col) {
  const base = ['--database-id', DB, '--table-id', tableId, '--key', col.key, '--required', String(Boolean(col.required))];
  switch (col.type) {
    case 'varchar':
      return ['tablesdb', 'create-string-column', ...base, '--size', String(col.size ?? 256)];
    case 'text':
      return ['tablesdb', 'create-text-column', ...base];
    case 'longtext':
      return ['tablesdb', 'create-longtext-column', ...base];
    case 'mediumtext':
      return ['tablesdb', 'create-mediumtext-column', ...base];
    case 'datetime':
      return ['tablesdb', 'create-datetime-column', ...base];
    case 'integer':
      return ['tablesdb', 'create-integer-column', ...base];
    case 'bigint':
      return ['tablesdb', 'create-big-int-column', ...base];
    case 'boolean':
      return ['tablesdb', 'create-boolean-column', ...base];
    case 'float':
      return ['tablesdb', 'create-float-column', ...base, '--min', String(col.min ?? -1e9), '--max', String(col.max ?? 1e9)];
    case 'enum':
      return ['tablesdb', 'create-enum-column', ...base, '--elements', ...(col.elements ?? [])];
    default:
      unsupported.push(`column type "${col.type}" (${tableId}.${col.key})`);
      console.error(`UNKNOWN COLUMN TYPE: ${col.type} (${tableId}.${col.key}) — skipped`);
      failures += 1;
      return null;
  }
}

console.log(`Deploying contract: database ${DB} (${DB_NAME}) — ${contract.tables.length} tables, ${dryRun ? 'DRY RUN' : 'LIVE'}`);

// 1. Database.
{
  const out = run(['tablesdb', 'get', '--database-id', DB], { allowFail: true });
  if (/name/i.test(out) && !/not found|Error/i.test(out)) {
    console.log('database exists:', DB);
  } else {
    run(['tablesdb', 'create', '--database-id', DB, '--name', DB_NAME]);
    console.log('database created:', DB);
  }
}

// 2. Tables, columns, indexes.
for (const table of contract.tables) {
  const tid = table.table_id;
  if (!existsTable(tid)) {
    run(['tablesdb', 'create-table', '--database-id', DB, '--table-id', tid, '--name', table.name]);
    console.log('table created:', tid);
  } else {
    console.log('table exists:', tid);
  }

  const colKeys = (table.columns ?? []).map((c) => c.key);
  const created = [];
  for (const col of table.columns ?? []) {
    const args = columnArgs(tid, col);
    if (!args) continue;
    if (dryRun) {
      console.log('DRY:', 'appwrite', args.join(' '));
      continue;
    }
    const out = run(args, { allowFail: true });
    if (/already exists|Conflict|409/i.test(out)) {
      console.log(`column exists: ${tid}.${col.key}`);
    } else if (/Error|failed/i.test(out) && !/available/i.test(out)) {
      console.error(`column FAILED: ${tid}.${col.key}:`, out.slice(0, 300));
      failures += 1;
    } else {
      created.push(col.key);
    }
  }
  if (!dryRun && created.length) {
    const ok = await waitColumns(tid, created);
    console.log(`columns ready on ${tid}: ${ok ? 'all' : 'TIMEOUT — indexes may fail'}`);
    if (!ok) failures += 1;
  }

  for (const idx of table.indexes ?? []) {
    if (!KNOWN_INDEX_TYPES.has(idx.type)) {
      unsupported.push(`index type "${idx.type}" (${tid}.${idx.key})`);
      console.error(`UNKNOWN INDEX TYPE: ${idx.type} (${tid}.${idx.key}) — skipped`);
      failures += 1;
      continue;
    }
    const out = run(
      ['tablesdb', 'create-index', '--database-id', DB, '--table-id', tid, '--key', idx.key,
        '--type', idx.type, '--attributes', ...(idx.attributes ?? [])],
      { allowFail: true }
    );
    if (/already exists|Conflict|409/i.test(out)) {
      console.log(`index exists: ${tid}.${idx.key}`);
    } else if (/Error|failed/i.test(out)) {
      console.error(`index FAILED: ${tid}.${idx.key}:`, out.slice(0, 300));
      failures += 1;
    } else {
      console.log(`index created: ${tid}.${idx.key}`);
    }
  }
}

if (unsupported.length) {
  console.error(`UNSUPPORTED CONTRACT ENTRIES (${unsupported.length}) — fix before deploying:`);
  for (const u of unsupported) console.error(`  - ${u}`);
}
console.log(`DEPLOY ${dryRun ? '(dry-run)' : 'COMPLETE'}: failures=${failures}`);
process.exit(failures ? 1 : 0);
