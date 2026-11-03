// Pairing and profile actions: verified-account onboarding, couple creation,
// single-use hashed invitations with expiry/replay rejection, and the
// atomic two-member join (TablesDB transaction; unique partner indexes as
// the concurrency backstop).

import {
  createRow, updateRow, getRow, listRowsWhere, withTransaction,
  getProfile, getCouple, sha256Hex, randomCode, now, fail,
  INVITE_TTL_DAYS, DAY_MS,
} from './lib.js';

export async function bootstrapProfile(user) {
  const existing = await getProfile(user.id);
  if (existing) return existing;
  const created = await createRow('profiles', user.id, {
    email: user.email || '',
    display_name: user.name || (user.email || '').split('@')[0] || 'Partner',
    created_at: now(),
  });
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
    if (profile?.couple_id) return fail(res, 409, 'You are already paired.');
    const existingCouple = await getCouple(user.id);
    if (existingCouple) return fail(res, 409, 'You are already paired.');
    const couple = await createRow('couples', 'unique()', { partner_a_id: user.id, created_at: now() });
    if (couple.status >= 400) return fail(res, 500, 'Could not create the couple.');
    const code = randomCode();
    const digest = await sha256Hex(code);
    const expires = new Date(Date.now() + INVITE_TTL_DAYS * DAY_MS).toISOString();
    await createRow('invitations', 'unique()', { couple_id: couple.data.$id, created_by: user.id, code_digest: digest, expires_at: expires, created_at: now() });
    await updateRow('profiles', user.id, { couple_id: couple.data.$id });
    return res.json({ ok: true, data: { coupleId: couple.data.$id, code, expires_at: expires } });
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
    if (couple.data.partner_a_id === user.id || couple.data.partner_b_id) return fail(res, 409, 'That couple already has two partners.');
    if (invite.created_by === user.id) return fail(res, 409, 'You cannot join your own invitation.');
    // Atomic join: consume the invitation, fill partner_b and link both
    // profiles inside one committed TablesDB transaction. A concurrent join
    // fails the commit (the unique consume/consumed_at path) and leaves no
    // partial state.
    const joined = await withTransaction(async (apiTx) => {
      const consume = await apiTx('PATCH', 'invitations', invite.$id, { consumed_at: now() });
      if (consume.status >= 400) return { ok: false };
      const link = await apiTx('PATCH', 'couples', couple.data.$id, { partner_b_id: user.id });
      if (link.status >= 400) return { ok: false };
      const prof = await apiTx('PATCH', 'profiles', user.id, { couple_id: couple.data.$id });
      return { ok: prof.status < 400 };
    });
    if (!joined.ok) return fail(res, 409, 'Someone else joined at the same moment. Try again.');
    return res.json({ ok: true, data: { coupleId: couple.data.$id } });
  },
};
