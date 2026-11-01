// Content and lifecycle actions: Lumi care (bounded, one pet per couple),
// memories (couple-scoped create/update/delete), moods, pocket notes,
// milestones, weekly adventures with partner-specific parts, account export
// and account deletion.

import {
  createRow, updateRow, getRow, deleteRow, listRowsQ,
  now, weekKey, fail, safeId, WARMTH_STEP, WARMTH_MAX,
} from './lib.js';

async function ensurePet(coupleId) {
  const rows = await listRowsQ('pet_states', [['equal', 'couple_id', coupleId]], 1);
  if (rows.length) return rows[0];
  const c = await createRow('pet_states', 'unique()', { couple_id: coupleId, affection: 40, mood: 'happy to see you', created_at: now() });
  return c.data;
}

export const handlers = {
  async 'lumi.state'({ res, couple }) {
    const pet = await ensurePet(couple.id);
    return res.json({ ok: true, data: { pet } });
  },

  async 'lumi.care'({ res, couple, body }) {
    const action = String(body.action || '');
    if (!['water', 'sunlight', 'play'].includes(action)) return fail(res, 400, 'Unknown care action.');
    const pet = await ensurePet(couple.id);
    const stamp = now();
    const patch = { affection: Math.min(WARMTH_MAX, Number(pet.affection) + WARMTH_STEP), mood: 'cared' };
    if (action === 'water') patch.last_watered_at = stamp;
    if (action === 'sunlight') patch.last_sunlit_at = stamp;
    const upd = await updateRow('pet_states', pet.id, patch);
    return res.json({ ok: true, data: { pet: upd.data } });
  },

  async 'memory.list'({ res, couple }) {
    const rows = await listRowsQ('memories', [['equal', 'couple_id', couple.id]], 100);
    return res.json({ ok: true, data: { memories: rows } });
  },

  async 'memory.create'({ res, user, couple, body }) {
    const title = String(body.title || '').trim().slice(0, 120);
    const note = String(body.note || '').trim().slice(0, 2000);
    const memoryDate = String(body.memory_date || '').slice(0, 10);
    if (!title) return fail(res, 400, 'The memory needs a title.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(memoryDate)) return fail(res, 400, 'The date needs the YYYY-MM-DD shape.');
    const created = await createRow('memories', 'unique()', { couple_id: couple.id, author_id: user.id, title, note, memory_date: memoryDate, created_at: now() });
    return res.json({ ok: true, data: { memory: created.data } });
  },

  async 'memory.update'({ res, user, body }) {
    const id = safeId(String(body.id || ''), 'id');
    const current = await getRow('memories', id);
    if (current.status >= 400) return fail(res, 404, 'That memory no longer exists.');
    const couple = await getCouple(user.id);
    if (!couple || current.data.couple_id !== couple.id) return fail(res, 403, 'Not your memory.');
    const patch = {};
    if (body.title !== undefined) patch.title = String(body.title).trim().slice(0, 120);
    if (body.note !== undefined) patch.note = String(body.note).trim().slice(0, 2000);
    if (body.memory_date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.memory_date))) return fail(res, 400, 'The date needs the YYYY-MM-DD shape.');
      patch.memory_date = String(body.memory_date);
    }
    const upd = await updateRow('memories', id, patch);
    return res.json({ ok: true, data: { memory: upd.data } });
  },

  async 'memory.delete'({ res, user, body }) {
    const id = safeId(String(body.id || ''), 'id');
    const current = await getRow('memories', id);
    if (current.status >= 400) return res.json({ ok: true, data: { gone: true } });
    const couple = await getCouple(user.id);
    if (!couple || current.data.couple_id !== couple.id) return fail(res, 403, 'Not your memory.');
    await deleteRow('memories', id);
    return res.json({ ok: true, data: { gone: true } });
  },

  async 'mood.add'({ res, user, couple, body }) {
    const emoji = String(body.emoji || '').slice(0, 16);
    const note = String(body.note || '').trim().slice(0, 500);
    if (!emoji) return fail(res, 400, 'Pick a mood first.');
    const created = await createRow('mood_check_ins', 'unique()', { couple_id: couple.id, author_id: user.id, emoji, note, created_at: now() });
    return res.json({ ok: true, data: { checkIn: created.data } });
  },

  async 'mood.list'({ res, couple }) {
    const rows = await listRowsQ('mood_check_ins', [['equal', 'couple_id', couple.id]], 100);
    return res.json({ ok: true, data: { checkIns: rows } });
  },

  async 'note.add'({ res, user, couple, body }) {
    const text = String(body.body || '').trim().slice(0, 500);
    if (!text) return fail(res, 400, 'Write something first.');
    const created = await createRow('pocket_notes', 'unique()', { couple_id: couple.id, author_id: user.id, body: text, created_at: now() });
    return res.json({ ok: true, data: { note: created.data } });
  },

  async 'note.list'({ res, user, couple }) {
    const rows = await listRowsQ('pocket_notes', [['equal', 'couple_id', couple.id]], 100);
    return res.json({ ok: true, data: { notes: rows, viewerId: user.id } });
  },

  async 'milestone.list'({ res, couple }) {
    const rows = await listRowsQ('milestones', [['equal', 'couple_id', couple.id]], 100);
    return res.json({ ok: true, data: { milestones: rows } });
  },

  async 'adventure.current'({ res, user, couple }) {
    const week = weekKey();
    const existing = await listRowsQ('weekly_adventures', [['equal', 'couple_id', couple.id], ['equal', 'week_of', week]], 1);
    if (existing.length) return res.json({ ok: true, data: { adventure: existing[0] } });
    let h = 0;
    const seedStr = `${couple.id}:${week}`;
    for (const ch of seedStr) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const kinds = ['gratitude_exchange', 'tiny_date', 'playful_question', 'doodle_prompt'];
    const kind = kinds[h % kinds.length];
    const titles = {
      gratitude_exchange: 'Thank-you note swap',
      tiny_date: 'Dessert first tonight',
      playful_question: 'A playful question',
      doodle_prompt: 'Draw the feeling',
    };
    const created = await createRow('weekly_adventures', 'unique()', {
      couple_id: couple.id, week_of: week, kind,
      title: titles[kind], detail: 'Rules are suspended.', created_at: now(),
    });
    if (created.status >= 400) {
      const again = await listRowsQ('weekly_adventures', [['equal', 'couple_id', couple.id], ['equal', 'week_of', week]], 1);
      if (again.length) return res.json({ ok: true, data: { adventure: again[0] } });
      return fail(res, 500, 'The weekly adventure could not be created.');
    }
    return res.json({ ok: true, data: { adventure: created.data } });
  },

  async 'adventure.part.get'({ res, user, body }) {
    const adventureId = safeId(String(body.adventure_id || ''), 'adventure_id');
    const mine = await listRowsQ('adventure_parts', [['equal', 'adventure_id', adventureId], ['equal', 'author_id', user.id]], 1);
    const all = await listRowsQ('adventure_parts', [['equal', 'adventure_id', adventureId]], 2);
    const both = all.length >= 2;
    return res.json({
      ok: true,
      data: {
        mine: mine[0] ? { id: mine[0].id, entry: mine[0].entry } : null,
        partner: both ? (all.find((r) => r.author_id !== user.id) ?? null) : null,
        revealed: both,
      },
    });
  },

  async 'adventure.complete'({ res, user, body }) {
    const adventureId = safeId(String(body.adventure_id || ''), 'adventure_id');
    const entry = String(body.entry || '').trim().slice(0, 500);
    if (!adventureId) return fail(res, 400, 'Missing adventure.');
    if (!entry) return fail(res, 400, 'Write your part first.');
    const adv = await getRow('weekly_adventures', adventureId);
    if (adv.status >= 400) return fail(res, 403, 'Not your adventure.');
    const couple = await getCouple(user.id);
    if (!couple || adv.data.couple_id !== couple.id) return fail(res, 403, 'Not your adventure.');
    const prior = await listRowsQ('adventure_parts', [['equal', 'adventure_id', adventureId], ['equal', 'author_id', user.id]], 1);
    if (prior.length) return res.json({ ok: true, data: { alreadyKept: true, part: prior[0] } });
    const created = await createRow('adventure_parts', 'unique()', { adventure_id: adventureId, author_id: user.id, entry, created_at: now() });
    return res.json({ ok: true, data: { alreadyKept: false, part: created.data } });
  },

  async 'account.export'({ res, user, couple }) {
    const bundle = { exported_at: now(), profile: await getProfile(user.id), couple: couple ?? null };
    if (couple) {
      bundle.daily_letters = await listRowsQ('daily_letters', [['equal', 'couple_id', couple.id]], 100);
      bundle.responses = await listRowsQ('responses', [['equal', 'author_id', user.id]], 100);
      bundle.memories = await listRowsQ('memories', [['equal', 'couple_id', couple.id]], 100);
      bundle.mood_check_ins = await listRowsQ('mood_check_ins', [['equal', 'author_id', user.id]], 100);
      bundle.pocket_notes = await listRowsQ('pocket_notes', [['equal', 'couple_id', couple.id]], 100);
      bundle.pet_state = await listRowsQ('pet_states', [['equal', 'couple_id', couple.id]], 1);
    }
    return res.json({ ok: true, data: bundle });
  },

  async 'account.delete'({ res, user, couple }) {
    const del = async (table, filters) => {
      const rows = await listRowsQ(table, filters, 100);
      for (const r of rows) await deleteRow(table, r.id);
      return rows.length;
    };
    if (couple) {
      const iAmA = couple.partner_a_id === user.id;
      const other = iAmA ? couple.partner_b_id : couple.partner_a_id;
      const letterIds = (await listRowsQ('daily_letters', [['equal', 'couple_id', couple.id]], 100)).map((r) => r.id);
      for (const lid of letterIds) await del('responses', [['equal', 'letter_id', lid]]);
      await del('reactions', [['equal', 'author_id', user.id]]);
      await del('daily_letters', [['equal', 'couple_id', couple.id]]);
      await del('memories', [['equal', 'couple_id', couple.id]]);
      await del('milestones', [['equal', 'couple_id', couple.id]]);
      await del('mood_check_ins', [['equal', 'author_id', user.id]]);
      await del('pocket_notes', [['equal', 'couple_id', couple.id]]);
      await del('pet_states', [['equal', 'couple_id', couple.id]]);
      await del('adventure_parts', [['equal', 'author_id', user.id]]);
      await del('weekly_adventures', [['equal', 'couple_id', couple.id]]);
      await del('invitations', [['equal', 'couple_id', couple.id]]);
      if (!other) await deleteRow('couples', couple.id);
      else if (iAmA) await updateRow('couples', couple.id, { partner_a_id: other, partner_b_id: null });
      else await updateRow('couples', couple.id, { partner_b_id: null });
    }
    await del('responses', [['equal', 'author_id', user.id]]);
    await del('profiles', [['equal', 'id', user.id]]);
    await fetch(`${ENDPOINT}/users/${encodeURIComponent(user.id)}`, { method: 'DELETE', headers: jsonHeaders() });
    return res.json({ ok: true, data: { deleted: true } });
  },
};

function jsonHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Appwrite-Project': process.env.APPWRITE_FUNCTION_PROJECT_ID || '',
    'X-Appwrite-Key': process.env.APPWRITE_API_KEY || '',
  };
}
