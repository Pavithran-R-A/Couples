// Regression tests for the password-recovery deep-link parser. The parser
// must extract tokens from URL fragments (Supabase implicit flow), accept
// tokens arriving as query parameters, surface expired-link errors, and
// never throw on malformed input.
import { parseRecoveryLink } from '../../services/recoveryLink';

let failures = 0;
function check(name: string, pass: boolean, detail = '') {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failures += 1;
}

// 1. Implicit-flow link: tokens in the URL fragment.
const fragment = parseRecoveryLink(
  'projecttwo://reset-password#access_token=TOKEN_A&refresh_token=TOKEN_R&expires_in=3600&token_type=bearer&type=recovery'
);
check(
  'fragment tokens extracted (implicit flow)',
  fragment.kind === 'tokens' &&
    (fragment as { accessToken?: string }).accessToken === 'TOKEN_A' &&
    (fragment as { refreshToken?: string }).refreshToken === 'TOKEN_R'
);

// 2. Tokens as query parameters (alternative link form).
const query = parseRecoveryLink('projecttwo://reset-password?access_token=QA&refresh_token=QR');
check(
  'query tokens extracted',
  query.kind === 'tokens' &&
    (query as { accessToken?: string }).accessToken === 'QA' &&
    (query as { refreshToken?: string }).refreshToken === 'QR'
);

// 3. Expired/invalid links arrive as error parameters; + becomes a space.
const expired = parseRecoveryLink('projecttwo://reset-password?error=access_denied&error_description=Expired+link');
check(
  'error parameters surface a friendly message',
  expired.kind === 'error' && (expired as { message?: string }).message === 'Expired link'
);

// 4. Error without a description falls back to the default copy.
const bareError = parseRecoveryLink('projecttwo://reset-password#error=server_error');
check(
  'bare error gets default copy',
  bareError.kind === 'error' &&
    (bareError as { message?: string }).message?.includes('no longer valid') === true
);

// 5. Malformed percent-encoding never throws; raw value is kept.
const malformed = parseRecoveryLink('projecttwo://reset-password#access_token=%ZZ&refresh_token=R');
check(
  'malformed encoding does not throw',
  malformed.kind === 'tokens' && (malformed as { accessToken?: string }).accessToken === '%ZZ'
);

// 6. A foreign URL (https, different host) is ignored entirely. Any
// projecttwo:// link is ours — Android routes the whole scheme to the app,
// so the host segment is not a security boundary.
check('non-app URL ignored', parseRecoveryLink('https://evil.example/#access_token=X&refresh_token=Y').kind === 'none');
check(
  'any projecttwo:// link is accepted for token parsing',
  parseRecoveryLink('projecttwo://anything#access_token=X&refresh_token=Y').kind === 'tokens'
);

// 7. Missing refresh_token is incomplete — not usable, keeps waiting.
check(
  'incomplete token set keeps waiting',
  parseRecoveryLink('projecttwo://reset-password#access_token=ONLY').kind === 'none'
);

// 8. Null / empty / no payload → keep waiting (the app shows a recoverable
// state, never an indefinite promise of progress once the timeout fires).
check('null URL keeps waiting', parseRecoveryLink(null).kind === 'none');
check('empty URL keeps waiting', parseRecoveryLink('').kind === 'none');
check('plain app URL keeps waiting', parseRecoveryLink('projecttwo://reset-password').kind === 'none');

// 9. Already-consumed links still parse (rejection is auth.setSession's job,
// verified by the authorization suite; the parser only extracts).
const consumed = parseRecoveryLink('projecttwo://reset-password#access_token=OLD&refresh_token=OLD_R');
check(
  'consumed link still parses for server-side rejection',
  consumed.kind === 'tokens' && (consumed as { accessToken?: string }).accessToken === 'OLD'
);

if (failures > 0) {
  console.error(`RECOVERY LINK TESTS: ${failures} FAILED`);
  process.exit(1);
}
console.log('RECOVERY LINK TESTS PASS');
