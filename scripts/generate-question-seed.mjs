// Regenerates appwrite/questions.seed.json from the canonical question
// module (domain/questions.ts) — the single source of the original daily
// prompts. Verifies uniqueness and completeness, writes count + checksum.
// Run: npx tsx scripts/generate-question-seed.mjs
import { QUESTIONS } from '../domain/questions.js';
import { writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ids = QUESTIONS.map((q) => q.id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) {
  console.error(`DUPLICATE QUESTION IDS: ${dupes.join(',')}`);
  process.exit(1);
}
const incomplete = QUESTIONS.filter((q) => !q.id || !q.category || !q.text);
if (incomplete.length) {
  console.error(`INCOMPLETE QUESTIONS: ${incomplete.length}`);
  process.exit(1);
}
const canonical = QUESTIONS.map((q) => ({ id: q.id, category: q.category, text: q.text }));
const payload = {
  source: 'domain/questions.ts',
  generated: new Date().toISOString(),
  count: canonical.length,
  checksum: createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),
  questions: canonical,
};
writeFileSync(join(root, 'appwrite', 'questions.seed.json'), `${JSON.stringify(payload, null, 2)}\n`);
console.log(`count=${canonical.length}`);
console.log(`checksum=${payload.checksum}`);
console.log(`categories=${[...new Set(canonical.map((q) => q.category))].join(',')}`);
