// Pure parser for password-recovery deep links. React Native ships no
// URLSearchParams, and Supabase delivers recovery tokens in the URL fragment
// (#access_token=…&refresh_token=…) while expired-link errors may arrive as
// query parameters — this handles both sections by hand, never throws, and
// never logs link contents (recovery tokens must not reach logs).

export type RecoveryLink =
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'error'; message: string }
  | { kind: 'none' };

function paramsFromText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of text.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const key = eq >= 0 ? part.slice(0, eq) : part;
    const value = eq >= 0 ? part.slice(eq + 1) : '';
    try {
      out[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
    } catch {
      out[key] = value; // malformed percent-encoding keeps the raw value
    }
  }
  return out;
}

export function parseRecoveryLink(raw: string | null | undefined): RecoveryLink {
  if (!raw || !raw.startsWith('projecttwo://')) return { kind: 'none' };
  const queryIndex = raw.indexOf('?');
  const hashIndex = raw.indexOf('#');
  const query = queryIndex >= 0 ? raw.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined) : '';
  const fragment = hashIndex >= 0 ? raw.slice(hashIndex + 1) : '';
  const params = { ...paramsFromText(query), ...paramsFromText(fragment) };

  if (params.error) {
    return {
      kind: 'error',
      message:
        params.error_description ||
        'That recovery link is no longer valid. Request a fresh one from the sign-in screen.',
    };
  }
  if (params.access_token && params.refresh_token) {
    return { kind: 'tokens', accessToken: params.access_token, refreshToken: params.refresh_token };
  }
  return { kind: 'none' }; // no recovery payload yet — keep waiting for the deep link
}
