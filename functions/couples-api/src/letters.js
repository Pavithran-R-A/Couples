// Daily letters, append-only sealed responses and reactions. Sealed answers
// are immutable (unique letter/author + no client update path); revealed_at
// is stamped server-side inside the submission flow only when both partners
// have answered; partner bodies are filtered server-side until reveal.

import {
  createRow, updateRow, getRow, deleteRow, listRowsWhere,
  now, fail, dayKey, safeId,
} from './lib.js';

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
    if (letter.status >= 400 || letter.data.couple_id !== couple.$id) return fail(res, 403, 'Not your letter.');
    const mine = await listRowsWhere('responses', [['equal', 'letter_id', letterId], ['equal', 'author_id', user.id]], 1);
    const all = await listRowsWhere('responses', [['equal', 'letter_id', letterId]], 2);
    const both = all.length >= 2;
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
    if (letter.status >= 400 || letter.data.couple_id !== couple.$id) return fail(res, 403, 'Not your letter.');
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
    const all = await listRowsWhere('responses', [['equal', 'letter_id', letterId]], 2);
    if (all.length >= 2) {
      const stamp = now();
      for (const r of all) await updateRow('responses', r.$id, { revealed_at: stamp });
    }
    return res.json({ ok: true, data: { alreadySealed: false, response: created.data, revealed: all.length >= 2 } });
  },

  async 'reaction.set'({ res, user, couple, body }) {
    const raw = String(body.response_id || '');
    if (!raw) return fail(res, 400, 'Missing response.');
    const responseId = safeId(raw, 'response_id');
    const kind = String(body.kind || '');
    if (!['heart', 'smile', 'sparkle'].includes(kind)) return fail(res, 400, 'Unknown reaction.');
    const target = await getRow('responses', responseId);
    if (target.status >= 400) return fail(res, 404, 'That response no longer exists.');
    if (!target.data.revealed_at) return fail(res, 403, 'That answer is not revealed yet.');
    // Couple ownership: the reaction target must belong to a letter of the
    // caller's own couple — a revealed response id from another couple is
    // still out of reach.
    const letter = await getRow('daily_letters', target.data.letter_id);
    if (letter.status >= 400 || letter.data.couple_id !== couple.$id) return fail(res, 403, 'Not your conversation.');
    const existing = await listRowsWhere('reactions', [['equal', 'response_id', responseId], ['equal', 'author_id', user.id]], 1);
    if (existing.length && existing[0].kind === kind) return res.json({ ok: true, data: { reaction: existing[0] } });
    if (existing.length) {
      const upd = await updateRow('reactions', existing[0].$id, { kind });
      return res.json({ ok: true, data: upd.data });
    }
    const created = await createRow('reactions', 'unique()', { response_id: responseId, author_id: user.id, kind, created_at: now() });
    return res.json({ ok: true, data: created.data });
  },
};
