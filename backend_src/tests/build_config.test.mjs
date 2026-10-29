// Regression tests for the effective demo build configuration: the EAS
// preview profile must produce an internal-distribution APK bound to the
// demo environment, and the app must keep the demo-isolation flag wired so
// a preview build can never reach a real Supabase backend.
// (.mjs like migrate-and-test.mjs — reads project files with fs.)
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

const appJson = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
const easJson = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
const clientSrc = readFileSync(join(root, 'services', 'supabaseClient.ts'), 'utf8');

let failures = 0;
function check(name, pass, detail = '') {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failures += 1;
}

check(
  'preview profile builds an internal-distribution APK',
  easJson.build.preview.android.buildType === 'apk' &&
    easJson.build.preview.distribution === 'internal',
  JSON.stringify(easJson.build.preview.android)
);

check(
  'preview profile is bound to the preview EAS environment',
  easJson.build.preview.environment === 'preview'
);

check(
  'android package identity preserved (com.projecttwo.app)',
  appJson.android.package === 'com.projecttwo.app'
);

check(
  'no unverifiable App Links declaration (CNG-clean config)',
  appJson.android.intentFilters === undefined
);

check(
  'demo isolation flag is wired in the client factory',
  clientSrc.includes("EXPO_PUBLIC_FORCE_DEMO === '1'") &&
    clientSrc.includes('return false;')
);

check(
  'eas projectId placeholder present until the owner links the project',
  typeof appJson.extra?.eas?.projectId === 'string'
);

if (failures > 0) {
  console.error(`BUILD CONFIG TESTS: ${failures} FAILED`);
  process.exit(1);
}
console.log('BUILD CONFIG TESTS PASS');
