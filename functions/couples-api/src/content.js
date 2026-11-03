// Content and lifecycle actions: Lumi care (bounded, one pet per couple),
// memories (couple-scoped create/update/delete), moods, pocket notes,
// milestones, weekly adventures with partner-specific parts, account export
// and account deletion.

import {
  createRow, updateRow, getRow, deleteRow, listRowsWhere,
  now, weekKey, fail, safeId, WARMTH_STEP, WARMTH_MAX,
  getCouple, getProfile, ENDPOINT, PROJECT, API_KEY,
} from './lib.js';

async function ensurePet(coupleId) {
  const rows = await listRowsWhere('pet_states', [['equal', 'couple_id', coupleId]], 1);
  if (rows.length) return rows[0];
  const c = await createRow('pet_states', 'unique()', { couple_id: coupleId, affection: 40, mood: 'happy to see you', created_at: now() });
  return c.data;
}

export const handlers = {
  async 'lumi.state'({ res, couple }) {
    const pet = await ensurePet(couple.$id);
    return res.json({ ok: true, data: { pet } });
  },

  async 'lumi.care'({ res, couple, body }) {
    const action = String(body.action || '');
    if (!['water', 'sunlight', 'play'].includes(action)) return fail(res, 400, 'Unknown care action.');
    const pet = await ensurePet(couple.$id);
    const stamp = now();
    const patch = { affection: Math.min(WARMTH_MAX, Number(pet.affection) + WARMTH_STEP), mood: 'cared' };
    if (action === 'water') patch.last_watered_at = stamp;
    if (action === 'sunlight') patch.last_sunlit_at = stamp;
    const upd = await updateRow('pet_states', pet.$id, patch);
    return res.json({ ok: true, data: { pet: upd.data } });
  },

  async 'memory.list'({ res, couple }) {
    const rows = await listRowsWhere('memories', [['equal', 'couple_id', couple.$id]], 100);
    return res.json({ ok: true, data: { memories: rows } });
  },

  async 'memory.create'({ res, user, couple, body }) {
    const title = String(body.title || '').trim().slice(0, 120);
    const note = String(body.note || '').trim().slice(0, 2000);
    const memoryDate = String(body.memory_date || '').slice(0, 10);
    if (!title) return fail(res, 400, 'The memory needs a title.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(memoryDate)
      || Number.isNaN(new Date(`${memoryDate}T00:00:00Z`).getTime())) {
      return fail(res, 400, 'The date needs the YYYY-MM-DD shape.');
    }
    const created = await createRow('memories', 'unique()', { couple_id: couple.$id, author_id: user.id, title, note, memory_date: memoryDate, created_at: now() });
    return res.json({ ok: true, data: { memory: created.data } });
  },

  async 'memory.update'({ res, user, body }) {
    const raw = String(body.id || '');
    if (!raw) return fail(res, 400, 'Missing memory.');
    const id = safeId(raw, 'id');
    const current = await getRow('memories', id);
    if (current.status >= 400) return fail(res, 404, 'That memory no longer exists.');
    const couple = await getCouple(user.id);
    if (!couple || current.data.couple_id !== couple.$id) return fail(res, 403, 'Not your memory.');
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
    const raw = String(body.id || '');
    if (!raw) return fail(res, 400, 'Missing memory.');
    const id = safeId(raw, 'id');
    const current = await getRow('memories', id);
    if (current.status >= 400) return res.json({ ok: true, data: { gone: true } });
    const couple = await getCouple(user.id);
    if (!couple || current.data.couple_id !== couple.$id) return fail(res, 403, 'Not your memory.');
    await deleteRow('memories', id);
    return res.json({ ok: true, data: { gone: true } });
  },

  async 'mood.add'({ res, user, couple, body }) {
    const emoji = String(body.emoji || '').slice(0, 16);
    const note = String(body.note || '').trim().slice(0, 500);
    if (!emoji) return fail(res, 400, 'Pick a mood first.');
    const created = await createRow('mood_check_ins', 'unique()', { couple_id: couple.$id, author_id: user.id, emoji, note, created_at: now() });
    return res.json({ ok: true, data: { checkIn: created.data } });
  },

  async 'mood.list'({ res, couple }) {
    const rows = await listRowsWhere('mood_check_ins', [['equal', 'couple_id', couple.$id]], 100);
    return res.json({ ok: true, data: { checkIns: rows } });
  },

  async 'note.add'({ res, user, couple, body }) {
    const text = String(body.body || '').trim().slice(0, 500);
    if (!text) return fail(res, 400, 'Write something first.');
    const created = await createRow('pocket_notes', 'unique()', { couple_id: couple.$id, author_id: user.id, body: text, created_at: now() });
    return res.json({ ok: true, data: { note: created.data } });
  },

  async 'note.list'({ res, user, couple }) {
    const rows = await listRowsWhere('pocket_notes', [['equal', 'couple_id', couple.$id]], 100);
    return res.json({ ok: true, data: { notes: rows, viewerId: user.id } });
  },

  async 'milestone.list'({ res, couple }) {
    const rows = await listRowsWhere('milestones', [['equal', 'couple_id', couple.$id]], 100);
    return res.json({ ok: true, data: { milestones: rows } });
  },

  async 'adventure.current'({ res, user, couple }) {
    const week = weekKey();
    const existing = await listRowsWhere('weekly_adventures', [['equal', 'couple_id', couple.$id], ['equal', 'week_of', week]], 1);
    if (existing.length) return res.json({ ok: true, data: { adventure: existing[0] } });
    let h = 0;
    const seedStr = `${couple.$id}:${week}`;
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
      couple_id: couple.$id, week_of: week, kind,
      title: titles[kind], detail: 'Rules are suspended.', created_at: now(),
    });
    if (created.status >= 400) {
      const again = await listRowsWhere('weekly_adventures', [['equal', 'couple_id', couple.$id], ['equal', 'week_of', week]], 1);
      if (again.length) return res.json({ ok: true, data: { adventure: again[0] } });
      return fail(res, 500, 'The weekly adventure could not be created.');
    }
    return res.json({ ok: true, data: { adventure: created.data } });
  },

  async 'adventure.part.get'({ res, user, couple, body }) {
    const raw = String(body.adventure_id || '');
    if (!raw) return fail(res, 400, 'Missing adventure.');
    const adventureId = safeId(raw, 'adventure_id');
    // Couple membership: the adventure must belong to the caller's couple,
    // otherwise a crafted adventure id would leak the partner's part.
    const adv = await getRow('weekly_adventures', adventureId);
    if (adv.status >= 400 || adv.data.couple_id !== couple.$id) return fail(res, 403, 'Not your adventure.');
    const mine = await listRowsWhere('adventure_parts', [['equal', 'adventure_id', adventureId], ['equal', 'author_id', user.id]], 1);
    const all = await listRowsWhere('adventure_parts', [['equal', 'adventure_id', adventureId]], 2);
    const both = all.length >= 2;
    return res.json({
      ok: true,
      data: {
        mine: mine[0] ? { id: mine[0].$id, entry: mine[0].entry } : null,
        partner: both ? (all.find((r) => r.author_id !== user.id) ?? null) : null,
        revealed: both,
      },
    });
  },

  async 'adventure.complete'({ res, user, body }) {
    const raw = String(body.adventure_id || '');
    if (!raw) return fail(res, 400, 'Missing adventure.');
    const adventureId = safeId(raw, 'adventure_id');
    const entry = String(body.entry || '').trim().slice(0, 500);
    if (!entry) return fail(res, 400, 'Write your part first.');
    const adv = await getRow('weekly_adventures', adventureId);
    if (adv.status >= 400) return fail(res, 403, 'Not your adventure.');
    const couple = await getCouple(user.id);
    if (!couple || adv.data.couple_id !== couple.$id) return fail(res, 403, 'Not your adventure.');
    const prior = await listRowsWhere('adventure_parts', [['equal', 'adventure_id', adventureId], ['equal', 'author_id', user.id]], 1);
    if (prior.length) return res.json({ ok: true, data: { alreadyKept: true, part: prior[0] } });
    const created = await createRow('adventure_parts', 'unique()', { adventure_id: adventureId, author_id: user.id, entry, created_at: now() });
    return res.json({ ok: true, data: { alreadyKept: false, part: created.data } });
  },

  async 'account.export'({ res, user, couple }) {
    const bundle = { exported_at: now(), profile: await getProfile(user.id), couple: couple ?? null };
    if (couple) {
      bundle.daily_letters = await listRowsWhere('daily_letters', [['equal', 'couple_id', couple.$id]], 100);
      bundle.responses = await listRowsWhere('responses', [['equal', 'author_id', user.id]], 100);
      bundle.memories = await listRowsWhere('memories', [['equal', 'couple_id', couple.$id]], 100);
      bundle.mood_check_ins = await listRowsWhere('mood_check_ins', [['equal', 'author_id', user.id]], 100);
      bundle.pocket_notes = await listRowsWhere('pocket_notes', [['equal', 'couple_id', couple.$id]], 100);
      bundle.pet_state = await listRowsWhere('pet_states', [['equal', 'couple_id', couple.$id]], 1);
    }
    return res.json({ ok: true, data: bundle });
  },

  async 'account.delete'({ res, user, couple }) {
    // Retention: only the CALLER's own rows and membership are removed.
    // Shared memories, letters and the companion stay available to the
    // remaining partner; the couple row itself is removed only when the
    // caller was its last member.
    const del = async (table, filters) => {
      const rows = await listRowsWhere(table, filters, 100);
      for (const r of rows) await deleteRow(table, r.$id);
      return rows.length;
    };
    if (couple) {
      const iAmA = couple.partner_a_id === user.id;
      const other = iAmA ? couple.partner_b_id : couple.partner_a_id;
      await del('memories', [['equal', 'author_id', user.id]]);
      await del('mood_check_ins', [['equal', 'author_id', user.id]]);
      await del('pocket_notes', [['equal', 'author_id', user.id]]);
      await del('adventure_parts', [['equal', 'author_id', user.id]]);
      await del('reactions', [['equal', 'author_id', user.id]]);
      await del('responses', [['equal', 'author_id', user.id]]);
      if (other) {
        // Leave-pairing: clear only the CALLER's slot so the remaining
        // partner keeps the couple, its letters and the companion intact.
        const patch = iAmA ? { partner_a_id: null } : { partner_b_id: null };
        await updateRow('couples', couple.$id, patch);
      } else {
        await del('daily_letters', [['equal', 'couple_id', couple.$id]]);
        await del('pet_states', [['equal', 'couple_id', couple.$id]]);
        await del('milestones', [['equal', 'couple_id', couple.$id]]);
        await del('weekly_adventures', [['equal', 'couple_id', couple.$id]]);
        await del('invitations', [['equal', 'couple_id', couple.$id]]);
        await deleteRow('couples', couple.$id);
      }
    }
    await del('responses', [['equal', 'author_id', user.id]]);
    await deleteRow('profiles', user.id);
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
