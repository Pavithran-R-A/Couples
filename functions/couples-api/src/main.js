// couples-api — consolidated Appwrite Function (Free plan: 1 of 2 slots).
// Security boundary for the Couples app: every action verifies the caller's
// real Appwrite identity (the JWT injected by the execution runtime), checks
// couple membership server-side, and never trusts a client-supplied
// userId/coupleId. All private tables are default-deny; this function is the
// only data path. Zero npm dependencies: uses the global fetch of the
// Node 18+ runtime.
//
// Action modules: pairing.js (onboarding/pairing), letters.js (daily
// letters, sealed responses, reactions), content.js (Lumi, memories,
// moods, notes, milestones, adventures, export/delete).

import { fail, safeId } from './lib.js';
import { handlers as pairing, bootstrapProfile, getCouple } from './pairing.js';
import { handlers as letters } from './letters.js';
import { handlers as content } from './content.js';

const handlers = { ...pairing, ...letters, ...content };

export default async ({ req, res, log, error }) => {
  const user = req.user;
  if (!user?.id) return fail(res, 401, 'Sign in to use Couples.');
  const action = handlers[String(req.headers['x-action'] || '')];
  if (!action) return fail(res, 404, 'Unknown action.');
  let body = {};
  try { body = typeof req.bodyJson === 'object' && req.bodyJson ? req.bodyJson : JSON.parse(req.body || '{}'); } catch { body = {}; }
  try {
    const profile = await bootstrapProfile(user);
    const couple = profile?.couple_id
      ? await getCouple(user.id).catch((e) => { error('couple lookup failed: ' + String(e)); return null; })
      : null;
    return await action({ req, res, log, error, user, profile, couple, body });
  } catch (e) {
    error(`action ${req.headers['x-action']} failed: ${String(e)}`);
    return fail(res, 500, 'Something went wrong on the server.');
  }
};
