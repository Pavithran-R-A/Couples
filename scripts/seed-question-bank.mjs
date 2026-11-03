// Idempotently seeds the Appwrite question_bank table from the reviewed
// snapshot (appwrite/questions.seed.json — generated from the original
// domain/questions.ts prompts). Creates NO users, couples or any other
// records. Deterministic row IDs (q01…q90) give duplicate protection:
// an existing row is verified against the snapshot instead of rewritten.
//
// Usage:
//   node scripts/seed-question-bank.mjs --dry-run   # plan only, no CLI writes
//   node scripts/seed-question-bank.mjs             # live (requires appwrite login + linked project)
//
// Verification performed: per-row readback byte-compare, total count,
// snapshot count, and a sha256 checksum of the readback content compared
// against the snapshot checksum.
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runCli } from './lib/appwrite-cli.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dryRun = process.argv.includes('--dry-run');

const seed = JSON.parse(readFileSync(join(root, 'appwrite', 'questions.seed.json'), 'utf8'));
const config = JSON.parse(readFileSync(join(root, 'appwrite.config.json'), 'utf8'));
const PROJECT = process.env.APPWRITE_PROJECT_ID || config.projectId;
if (!PROJECT) {
  console.error('No project id: appwrite.config.json is missing or malformed.');
  process.exit(1);
}
const DB = 'couples_main';
const TABLE = 'question_bank';

const canonical = seed.questions.map((q) => ({ id: q.id, category: q.category, text: q.text }));
const snapshotChecksum = createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
if (snapshotChecksum !== seed.checksum) {
  console.error('SNAPSHOT CHECKSUM MISMATCH — questions.seed.json is corrupted.');
  process.exit(1);
}
console.log(`Seeding ${seed.count} original questions (${dryRun ? 'DRY RUN' : 'LIVE'}), snapshot checksum ${snapshotChecksum.slice(0, 16)}…`);

let failures = 0;
function cli(args, { allowFail = false } = {}) {
  if (dryRun) {
    console.log('DRY:', 'appwrite', args.join(' ').slice(0, 160));
    return '';
  }
  try {
    return runCli(args);
  } catch (e) {
    const out = String(e.stdout || '') + String(e.stderr || '') + String(e.message || '');
    if (allowFail) return out;
    console.error('CLI FAILED:', 'appwrite', args.slice(0, 4).join(' '));
    console.error(out.slice(0, 500));
    failures += 1;
    return out;
  }
}

let created = 0;
let verifiedExisting = 0;
for (const q of canonical) {
  const data = JSON.stringify({ category: q.category, text: q.text });
  const out = cli(
    ['tablesdb', 'create-row', '--database-id', DB, '--table-id', TABLE, '--row-id', q.id, '--data', data],
    { allowFail: true }
  );
  if (dryRun) continue;
  if (/already exists|Conflict|409/i.test(out)) {
    // Duplicate protection: verify the existing row matches the snapshot.
    const got = cli(['tablesdb', 'get-row', '--json', '--database-id', DB, '--table-id', TABLE, '--row-id', q.id], { allowFail: true });
    let row = null;
    try { row = JSON.parse(got); } catch { /* parse below flags it */ }
    if (row && row.category === q.category && row.text === q.text) {
      verifiedExisting += 1;
    } else {
      console.error(`MISMATCH on existing row ${q.id}: content differs from the original question.`);
      failures += 1;
    }
    continue;
  }
  if (/error|failed/i.test(out) && !/available/i.test(out)) {
    console.error(`SEED FAILED for ${q.id}: ${out.slice(0, 200)}`);
    failures += 1;
    continue;
  }
  created += 1;
}

// Readback: verify every row byte-for-byte and count.
let readbackChecksum = '';
if (!dryRun) {
  const rows = [];
  for (const q of canonical) {
    const got = cli(['tablesdb', 'get-row', '--json', '--database-id', DB, '--table-id', TABLE, '--row-id', q.id], { allowFail: true });
    let row = null;
    try { row = JSON.parse(got); } catch { /* counted below */ }
    if (!row || row.category !== q.category || row.text !== q.text) {
      console.error(`READBACK MISMATCH for ${q.id}`);
      failures += 1;
      continue;
    }
    rows.push({ id: q.id, category: row.category, text: row.text });
  }
  readbackChecksum = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  if (rows.length !== canonical.length) {
    console.error(`READBACK INCOMPLETE: ${rows.length}/${canonical.length} rows verified.`);
    failures += 1;
  }
  const listed = cli(['tablesdb', 'list-rows', '--json', '--database-id', DB, '--table-id', TABLE], { allowFail: true });
  let listedParsed = null;
  try { listedParsed = JSON.parse(listed); } catch {
    console.error('LIST-ROWS OUTPUT UNPARSEABLE — count verification failed.');
    failures += 1;
  }
  const total = listedParsed && Number.isInteger(listedParsed.total) ? listedParsed.total : null;
  if (total === null) {
    if (listedParsed !== null) console.error('LIST-ROWS TOTAL MISSING — count verification failed.');
    failures += 1;
  } else if (total !== canonical.length) {
    console.error(`TABLE COUNT ${total} != expected ${canonical.length} — unexpected extra or missing records.`);
    failures += 1;
  }
  console.log(`readback: ${rows.length}/${canonical.length} rows byte-verified`);
  console.log(`readback checksum: ${readbackChecksum}`);
  if (readbackChecksum !== snapshotChecksum) {
    console.error('READBACK CHECKSUM != SNAPSHOT CHECKSUM — cloud content differs from the original questions.');
    failures += 1;
  } else {
    console.log('READBACK == SNAPSHOT');
  }
}

console.log(`SEED ${dryRun ? '(dry-run)' : 'COMPLETE'}: created=${created} verifiedExisting=${verifiedExisting} failures=${failures}`);
process.exit(failures ? 1 : 0);
