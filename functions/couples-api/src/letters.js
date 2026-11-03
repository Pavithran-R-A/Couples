// Daily letters, append-only sealed responses and reactions. Sealed answers
// are immutable (unique letter/author + no client update path); revealed_at
// is stamped server-side inside the submission flow only when both partners
// have answered; partner bodies are filtered server-side until reveal.

import {
  createRow, updateRow, getRow, deleteRow, listRowsWhere, listAllRows, withTransaction,
  now, fail, dayKey, safeId,
} from './lib.js';

// Mutual reveal is atomic and self-healing: when both sealed answers exist,
// the server stamps revealed_at on BOTH rows inside one transaction. If a
// commit fails, the stamp is simply retried by the next state/submit/reaction
// call (idempotent), so a partial reveal never becomes permanent. Sealed
// bodies are never written by this path — only the server-side timestamp.
async function ensureRevealed(letterId) {
  const all = await listRowsWhere('responses', [['equal', 'letter_id', letterId]], 2);
  if (all.length < 2) return false;
  if (all.every((r) => r.revealed_at)) return true;
  const stamp = now();
  const tx = await withTransaction(async (apiTx) => {
    for (const r of all) {
      const u = await apiTx('PATCH', 'responses', r.$id, { revealed_at: stamp });
      if (u.status >= 400) return { ok: false };
    }
    return { ok: true };
  });
  if (!tx.ok) return false;
  for (const r of all) r.revealed_at = stamp;
  return true;
}

export const handlers = {
  async 'letter.today'({ res, user, couple }) {
    const date = dayKey();
    const existing = await listRowsWhere('daily_letters', [['equal', 'couple_id', couple.$id], ['equal', 'letter_date', date]], 1);
    if (existing.length) return res.json({ ok: true, data: { letter: existing[0] } });
    const bank = await listRowsWhere('question_bank', [], 200);
    if (!bank.length) return fail(res, 500, 'The question bank is empty.');
    let h = 0;
    const seedStr = `${couple.$id}:${date}`;
    for (const ch of seedStr) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const q = bank[h % bank.length];
    const created = await createRow('daily_letters', 'unique()', {
      couple_id: couple.$id, letter_date: date, question_id: q.$id,
      question_text: q.text, category: q.category || 'everyday', created_at: now(),
    });
    if (created.status >= 400) {
      const again = await listRowsWhere('daily_letters', [['equal', 'couple_id', couple.$id], ['equal', 'letter_date', date]], 1);
      if (again.length) return res.json({ ok: true, data: { letter: again[0] } });
      return fail(res, 500, 'The daily letter could not be created.');
    }
    return res.json({ ok: true, data: { letter: created.data } });
  },

  async 'response.state'({ res, user, couple, body }) {
    const raw = String(body.letter_id || '');
    if (!raw) return fail(res, 400, 'Missing letter.');
    const letterId = safeId(raw, 'letter_id');
    const letter = await getRow('daily_letters', letterId);
    // Read outcomes are distinguished: a 404 read denies access (never leak
    // existence), while backend failures surface as errors — a 429/5xx on
    // the read must not masquerade as a privacy decision.
    if (letter.status === 404) return fail(res, 403, 'Not your letter.');
    if (letter.status >= 400) return fail(res, 500, 'The letter could not be verified.');
    if (letter.data.couple_id !== couple.$id) return fail(res, 403, 'Not your letter.');
    await ensureRevealed(letterId);
    const mine = await listRowsWhere('responses', [['equal', 'letter_id', letterId], ['equal', 'author_id', user.id]], 1);
    const all = await listRowsWhere('responses', [['equal', 'letter_id', letterId]], 2);
    const both = all.length >= 2 && all.every((r) => r.revealed_at);
    return res.json({
      ok: true,
      data: {
        mine: mine[0] ? { id: mine[0].$id, body: mine[0].body, created_at: mine[0].created_at } : null,
        revealed: both,
        partner: both ? (all.find((r) => r.author_id !== user.id) ?? null) : null,
      },
    });
  },

  async 'response.submit'({ res, user, couple, body }) {
    const raw = String(body.letter_id || '');
    if (!raw) return fail(res, 400, 'Missing letter.');
    const letterId = safeId(raw, 'letter_id');
    const letter = await getRow('daily_letters', letterId);
    if (letter.status === 404) return fail(res, 403, 'Not your letter.');
    if (letter.status >= 400) return fail(res, 500, 'The letter could not be verified.');
    if (letter.data.couple_id !== couple.$id) return fail(res, 403, 'Not your letter.');
    const text = String(body.body || '').trim().slice(0, 4000);
    if (!text) return fail(res, 400, 'The answer is empty.');
    const prior = await listRowsWhere('responses', [['equal', 'letter_id', letterId], ['equal', 'author_id', user.id]], 1);
    if (prior.length) return res.json({ ok: true, data: { alreadySealed: true, response: prior[0] } });
    const created = await createRow('responses', 'unique()', { letter_id: letterId, author_id: user.id, body: text, created_at: now() });
    if (created.status >= 400) {
      const again = await listRowsWhere('responses', [['equal', 'letter_id', letterId], ['equal', 'author_id', user.id]], 1);
      if (again.length) return res.json({ ok: true, data: { alreadySealed: true, response: again[0] } });
      return fail(res, 500, 'The answer could not be sealed.');
    }
    // Atomic mutual reveal: stamps both rows in one transaction (or retried
    // lazily by the next call if the commit fails).
    const revealed = await ensureRevealed(letterId);
    return res.json({ ok: true, data: { alreadySealed: false, response: created.data, revealed } });
  },

  async 'reaction.set'({ res, user, couple, body }) {
    const raw = String(body.response_id || '');
    if (!raw) return fail(res, 400, 'Missing response.');
    const responseId = safeId(raw, 'response_id');
    const kind = String(body.kind || '');
    if (!['heart', 'smile', 'sparkle'].includes(kind)) return fail(res, 400, 'Unknown reaction.');
    const target = await getRow('responses', responseId);
    if (target.status === 404) return fail(res, 404, 'That response no longer exists.');
    if (target.status >= 400) return fail(res, 500, 'The response could not be verified.');
    // Couple ownership: the reaction target must belong to a letter of the
    // caller's own couple — a revealed response id from another couple is
    // still out of reach.
    const letter = await getRow('daily_letters', target.data.letter_id);
    if (letter.status === 404) return fail(res, 403, 'Not your conversation.');
    if (letter.status >= 400) return fail(res, 500, 'The conversation could not be verified.');
    if (letter.data.couple_id !== couple.$id) return fail(res, 403, 'Not your conversation.');
    // Reveal is required before reactions; self-heals the stamp if a previous
    // mutual-reveal commit failed, then re-reads the response.
    await ensureRevealed(target.data.letter_id);
    const stamped = await getRow('responses', responseId);
    if (!stamped.data.revealed_at) return fail(res, 403, 'That answer is not revealed yet.');
    const existing = await listRowsWhere('reactions', [['equal', 'response_id', responseId], ['equal', 'author_id', user.id]], 1);
    if (existing.length && existing[0].kind === kind) return res.json({ ok: true, data: { reaction: existing[0] } });
    if (existing.length) {
      const upd = await updateRow('reactions', existing[0].$id, { kind });
      if (upd.status >= 400) return fail(res, 500, 'The reaction could not be saved.');
      return res.json({ ok: true, data: upd.data });
    }
    const created = await createRow('reactions', 'unique()', { response_id: responseId, author_id: user.id, kind, created_at: now() });
    if (created.status >= 400) return fail(res, 500, 'The reaction could not be saved.');
    return res.json({ ok: true, data: created.data });
  },

  // Letter history for the couple — the full archive, stably ordered.
  async 'letter.history'({ res, couple }) {
    const letters = await listAllRows('daily_letters', [['equal', 'couple_id', couple.$id]]);
    return res.json({ ok: true, data: { letters } });
  },

  // Reactions on a letter's responses (only visible to the couple).
  async 'reaction.list'({ res, couple, body }) {
    const raw = String(body.letter_id || '');
    if (!raw) return fail(res, 400, 'Missing letter.');
    const letterId = safeId(raw, 'letter_id');
    const letter = await getRow('daily_letters', letterId);
    if (letter.status === 404) return fail(res, 403, 'Not your letter.');
    if (letter.status >= 400) return fail(res, 500, 'The letter could not be verified.');
    if (letter.data.couple_id !== couple.$id) return fail(res, 403, 'Not your letter.');
    const responses = await listRowsWhere('responses', [['equal', 'letter_id', letterId]], 2);
    const reactions = [];
    for (const r of responses) {
      reactions.push(...await listAllRows('reactions', [['equal', 'response_id', r.$id]]));
    }
    return res.json({ ok: true, data: { reactions } });
  },
};
