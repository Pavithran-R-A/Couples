// Pairing and profile actions: verified-account onboarding, couple creation,
// single-use hashed invitations with expiry/replay rejection, and the
// atomic two-member join (TablesDB transaction; unique partner indexes as
// the concurrency backstop).

import {
  createRow, updateRow, getRow, listRowsWhere, withTransaction,
  getProfile, getCouple, sha256Hex, randomCode, newId, now, fail,
  INVITE_TTL_DAYS, DAY_MS,
} from './lib.js';

export async function bootstrapProfile(user) {
  const existing = await getProfile(user.id);
  if (existing) return existing;
  const created = await createRow('profiles', user.id, {
    email: String(user.email || '').slice(0, 254),
    display_name: String(user.name || (user.email || '').split('@')[0] || 'Partner').slice(0, 128),
    created_at: now(),
  });
  if (created.status >= 400) throw new Error(`profile bootstrap failed: HTTP ${created.status}`);
  return created.data;
}

export const handlers = {
  async 'profile.bootstrap'({ res, user }) {
    const profile = await bootstrapProfile(user);
    return res.json({ ok: true, data: { profile } });
  },

  async 'profile.get'({ res, user }) {
    const profile = await getProfile(user.id);
    if (!profile) return fail(res, 404, 'Profile not found.');
    return res.json({ ok: true, data: { profile } });
  },

  async 'pair.status'({ res, user }) {
    const profile = await getProfile(user.id);
    const couple = profile?.couple_id ? await getCouple(user.id) : null;
    const invitations = couple ? await listRowsWhere('invitations', [['equal', 'couple_id', couple.$id], ['equal', 'created_by', user.id]], 5) : [];
    const active = invitations.find((i) => !i.consumed_at && new Date(i.expires_at).getTime() > Date.now());
    return res.json({
      ok: true,
      data: {
        paired: Boolean(couple && couple.partner_a_id && couple.partner_b_id),
        coupleId: couple?.$id ?? null,
        role: couple ? (couple.partner_a_id === user.id ? 'a' : 'b') : null,
        activeInvite: active ? { expires_at: active.expires_at } : null,
      },
    });
  },

  async 'pair.start'({ res, user }) {
    const profile = await getProfile(user.id);
    const existing = await getCouple(user.id);
    if (existing && existing.partner_a_id && existing.partner_b_id) return fail(res, 409, 'You are already paired.');
    if (existing) {
      // Survivor re-invite: the couple has one empty slot after the partner
      // deleted their account. The invitation targets the EXISTING couple —
      // no couple row is created and no membership slot changes here; the
      // join fills the empty slot. Atomic: invitation + idempotent profile
      // link in one transaction.
      const code = randomCode();
      const digest = await sha256Hex(code);
      const expires = new Date(Date.now() + INVITE_TTL_DAYS * DAY_MS).toISOString();
      const invitationId = newId();
      const result = await withTransaction(async (apiTx) => {
        // Hygiene: issuing a new invitation revokes the caller's previous
        // unconsumed ones, so double taps never accumulate live codes.
        const prior = await listRowsWhere('invitations', [['equal', 'couple_id', existing.$id], ['equal', 'created_by', user.id]], 100);
        for (const p of prior) {
          if (p.consumed_at) continue;
          const del = await apiTx('DELETE', 'invitations', p.$id);
          if (del.status >= 400 && del.status !== 404) return { ok: false, status: del.status };
        }
        const inv = await apiTx('POST', 'invitations', invitationId, { couple_id: existing.$id, created_by: user.id, code_digest: digest, expires_at: expires, created_at: now() });
        if (inv.status >= 400) return { ok: false, status: inv.status };
        const prof = await apiTx('PATCH', 'profiles', user.id, { couple_id: existing.$id });
        return { ok: prof.status < 400, status: prof.status };
      });
      if (!result.ok) return fail(res, 500, 'Could not create the pair invitation. Please try again.');
      return res.json({ ok: true, data: { coupleId: existing.$id, code, expires_at: expires, rejoined: true } });
    }
    if (profile?.couple_id) return fail(res, 409, 'You are already paired.');
    // Atomic pair.start: the couple, the invitation and the profile link are
    // three staged operations of ONE transaction — a failure anywhere rolls
    // back all of them, so no orphan couple or half-linked profile survives.
    // Server-generated IDs let the invitation and profile reference the
    // couple inside the same transaction.
    const coupleId = newId();
    const invitationId = newId();
    const code = randomCode();
    const digest = await sha256Hex(code);
    const expires = new Date(Date.now() + INVITE_TTL_DAYS * DAY_MS).toISOString();
    const result = await withTransaction(async (apiTx) => {
      const couple = await apiTx('POST', 'couples', coupleId, { partner_a_id: user.id, created_at: now() });
      if (couple.status >= 400) return { ok: false, status: couple.status };
      const invite = await apiTx('POST', 'invitations', invitationId, { couple_id: coupleId, created_by: user.id, code_digest: digest, expires_at: expires, created_at: now() });
      if (invite.status >= 400) return { ok: false, status: invite.status };
      const prof = await apiTx('PATCH', 'profiles', user.id, { couple_id: coupleId });
      return { ok: prof.status < 400, status: prof.status };
    });
    if (!result.ok) {
      if (result.status === 409) return fail(res, 409, 'You are already paired.');
      return fail(res, 500, 'Could not create the pair invitation. Please try again.');
    }
    return res.json({ ok: true, data: { coupleId, code, expires_at: expires } });
  },

  async 'pair.join'({ res, user, body }) {
    const code = String(body.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{9}$/.test(code)) return fail(res, 400, 'That code does not look right.');
    const mine = await getProfile(user.id);
    if (mine?.couple_id) return fail(res, 409, 'You are already paired.');
    const digest = await sha256Hex(code);
    const found = await listRowsWhere('invitations', [['equal', 'code_digest', digest]], 1);
    const invite = found[0];
    if (!invite) return fail(res, 404, 'No invitation matches that code.');
    if (invite.consumed_at) return fail(res, 409, 'That invitation was already used.');
    if (new Date(invite.expires_at).getTime() < Date.now()) return fail(res, 410, 'That invitation has expired.');
    const couple = await getRow('couples', invite.couple_id);
    if (couple.status >= 400) return fail(res, 404, 'The invitation couple no longer exists.');
    // Complete means BOTH slots are occupied (either slot can be the empty
    // one after a partner deleted their account).
    if ((couple.data.partner_a_id && couple.data.partner_b_id) || couple.data.partner_a_id === user.id) {
      return fail(res, 409, 'That couple already has two partners.');
    }
    if (invite.created_by === user.id) return fail(res, 409, 'You cannot join your own invitation.');
    // Atomic join: consume the invitation, fill partner_b and link both
    // profiles inside one committed TablesDB transaction. A concurrent join
    // fails the commit (the unique consume/consumed_at path) and leaves no
    // partial state.
    const joined = await withTransaction(async (apiTx) => {
      const consume = await apiTx('PATCH', 'invitations', invite.$id, { consumed_at: now() });
      if (consume.status >= 400) return { ok: false };
      // Fill whichever slot is EMPTY: a fresh couple takes partner_b; a
      // survivor couple (partner_b occupied, partner_a vacated by a deleted
      // account) takes partner_a. Overwriting an occupied slot would
      // silently eject the surviving partner.
      const slotPatch = couple.data.partner_a_id ? { partner_b_id: user.id } : { partner_a_id: user.id };
      const link = await apiTx('PATCH', 'couples', couple.data.$id, slotPatch);
      if (link.status >= 400) return { ok: false };
      const prof = await apiTx('PATCH', 'profiles', user.id, { couple_id: couple.data.$id });
      return { ok: prof.status < 400 };
    });
    if (!joined.ok) return fail(res, 409, 'Someone else joined at the same moment. Try again.');
    return res.json({ ok: true, data: { coupleId: couple.data.$id } });
  },
};
