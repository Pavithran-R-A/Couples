// couples-api — consolidated Appwrite Function (Free plan: 1 of 2 slots).
// Security boundary for the Couples app: every action verifies the caller's
// real Appwrite identity by validating the x-appwrite-user-jwt against the
// project's /account endpoint (a spoofed header fails there), then resolves
// couple membership server-side. Client-supplied userId/coupleId is never
// trusted. All private tables are default-deny; this function is the only
// data path. Zero npm dependencies: Node 18+ global fetch.
//
// Action modules: pairing.js (onboarding/pairing), letters.js (daily
// letters, sealed responses, reactions), content.js (Lumi, memories,
// moods, notes, milestones, adventures, export/delete).

import { fail, verifyCaller, getCouple } from './lib.js';
import { handlers as pairing, bootstrapProfile } from './pairing.js';
import { handlers as letters } from './letters.js';
import { handlers as content } from './content.js';

const handlers = { ...pairing, ...letters, ...content };

// Actions that are meaningful without a couple (onboarding, pairing,
// lifecycle). Every other action is deny-by-default until the caller is
// paired, so an unpaired or deleted account cannot reach couple data.
const PAIRLESS = new Set([
  'profile.bootstrap', 'profile.get', 'pair.status', 'pair.start', 'pair.join',
  'account.export', 'account.delete',
]);

// Self-service actions available BEFORE email verification. Pairing and all
// couple data require a verified address — an unverified account can only
// bootstrap/inspect its own profile and manage its own account.
const SELF_SERVICE = new Set([
  'profile.bootstrap', 'profile.get', 'pair.status', 'account.export', 'account.delete',
]);

export default async ({ req, res, log, error }) => {
  const jwt = req.headers['x-appwrite-user-jwt'];
  if (!jwt) return fail(res, 401, 'Sign in to use Couples.');

  // Verified identity: the JWT is validated by Appwrite itself via /account.
  // A spoofed user-id header without a valid JWT fails here.
  const caller = await verifyCaller(jwt).catch(() => null);
  if (!caller) return fail(res, 401, 'Your session is invalid or expired.');

  const actionName = String(req.headers['x-action'] || '');
  const action = handlers[actionName];
  if (!action) return fail(res, 404, 'Unknown action.');
  if (!caller.emailVerification && !SELF_SERVICE.has(actionName)) {
    return fail(res, 403, 'Verify your email address to use Couples.');
  }
  let body = {};
  try { body = typeof req.bodyJson === 'object' && req.bodyJson ? req.bodyJson : JSON.parse(req.body || '{}'); } catch { body = {}; }

  try {
    const profile = await bootstrapProfile(caller);
    // Membership states are DISTINGUISHED, never conflated:
    //  - confirmed membership  -> couple row returned
    //  - confirmed absence     -> null (profile has no couple_id, or the id
    //                             points at a couple row that no longer exists)
    //  - backend query failure -> getCouple THROWS; the failure propagates and
    //    the request fails closed (500). A failed lookup must NEVER be
    //    reclassified as "unpaired" — that would let account deletion destroy
    //    credentials while the couple still names the caller.
    const couple = profile?.couple_id ? await getCouple(caller.id) : null;
    if (!couple && !PAIRLESS.has(actionName)) return fail(res, 403, 'Pair with your partner to use this.');
    return await action({ req, res, log, error, user: caller, profile, couple, body });
  } catch (e) {
    error(`action ${actionName} failed: ${String(e)}`);
    return fail(res, 500, 'Something went wrong on the server.');
  }
};
