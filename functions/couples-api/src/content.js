// Content and lifecycle actions: Lumi care (bounded, one pet per couple),
// memories (couple-scoped create/update/delete), moods, pocket notes,
// milestones, weekly adventures with partner-specific parts, account export
// and account deletion.

import {
  createRow, updateRow, getRow, deleteRow, listRowsWhere, listAllRows, withTransaction,
  qOrderAsc, qCursorAfter,
  now, weekKey, fail, safeId, WARMTH_STEP, WARMTH_MAX,
  getCouple, getProfile, ENDPOINT, PROJECT, API_KEY,
} from './lib.js';

async function ensurePet(coupleId) {
  const rows = await listRowsWhere('pet_states', [['equal', 'couple_id', coupleId]], 1);
  if (rows.length) return rows[0];
  // pet_states has no created_at column in the reviewed contract; the
  // interaction timestamps live in last_interaction_at/last_watered_at/
  // last_sunlit_at.
  const c = await createRow('pet_states', 'unique()', { couple_id: coupleId, affection: 40, mood: 'happy to see you' });
  if (c.status >= 400) throw new Error(`pet create failed: HTTP ${c.status}`);
  return c.data;
}

// Cursor-based deletion to EXPLICIT exhaustion (orderAsc $id +
// cursorAfter), never a fixed page cap: hitting the safety ceiling THROWS
// so a truncated cleanup can never be followed by credential deletion. The
// ceiling is configurable for tests via COUPLES_PAGINATION_CEILING.
// Returns the number of delete failures for the caller to account.
async function deleteAllRows(table, filters) {
  const ceiling = Number(process.env.COUPLES_PAGINATION_CEILING || 500);
  let cursor = null;
  let failures = 0;
  for (let page = 0; page < ceiling; page += 1) {
    const extras = [qOrderAsc('$id')];
    if (cursor) extras.push(qCursorAfter(cursor));
    const rows = await listRowsWhere(table, filters, 100, undefined, extras);
    if (!rows.length) return failures; // explicit exhaustion
    let pageFailures = 0;
    for (const r of rows) {
      const out = await deleteRow(table, r.$id);
      if (out.status >= 400 && out.status !== 404) { pageFailures += 1; failures += 1; }
    }
    if (pageFailures) return failures; // stop retrying this table; caller reports 500
    cursor = rows[rows.length - 1].$id;
  }
  throw new Error(`deletion pagination ceiling exceeded for ${table} — refusing to continue toward credential deletion`);
}

// Responses cascade: partner reactions on each response go first, so no
// reaction outlives its target.
async function deleteResponsesCascade(userId) {
  const ceiling = Number(process.env.COUPLES_PAGINATION_CEILING || 500);
  let cursor = null;
  let failures = 0;
  for (let page = 0; page < ceiling; page += 1) {
    const extras = [qOrderAsc('$id')];
    if (cursor) extras.push(qCursorAfter(cursor));
    const rows = await listRowsWhere('responses', [['equal', 'author_id', userId]], 100, undefined, extras);
    if (!rows.length) return failures;
    let pageFailures = 0;
    for (const r of rows) {
      failures += await deleteAllRows('reactions', [['equal', 'response_id', r.$id]]);
      const out = await deleteRow('responses', r.$id);
      if (out.status >= 400 && out.status !== 404) { pageFailures += 1; failures += 1; }
    }
    if (pageFailures) return failures;
    cursor = rows[rows.length - 1].$id;
  }
  throw new Error('deletion pagination ceiling exceeded for responses — refusing to continue toward credential deletion');
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
    const patch = { mood: 'cared', last_interaction_at: stamp };
    if (action === 'water') patch.last_watered_at = stamp;
    if (action === 'sunlight') patch.last_sunlit_at = stamp;
    // ONE transaction: the mood/timestamp patch and the ATOMIC warmth
    // increment (official increment endpoint) commit together, so two
    // simultaneous care actions cannot lose an update and a failure applies
    // neither half. A committed transaction returns the transaction object,
    // not rows — the fresh pet state is read back afterwards.
    const result = await withTransaction(async (apiTx) => {
      const upd = await apiTx('PATCH', 'pet_states', pet.$id, patch);
      if (upd.status >= 400) return { ok: false };
      const inc = await apiTx('PATCH', 'pet_states', pet.$id, { value: WARMTH_STEP, max: WARMTH_MAX }, { incrementColumn: 'affection' });
      if (inc.status >= 400) return { ok: false };
      return { ok: true };
    });
    if (!result.ok) return fail(res, 500, 'The care could not be saved.');
    const fresh = await getRow('pet_states', pet.$id);
    if (fresh.status >= 400) return fail(res, 500, 'The care could not be saved.');
    return res.json({ ok: true, data: { pet: fresh.data } });
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
    // Shape + real-calendar check (round-trip catches overflow dates such as
    // 2026-02-30 that some parsers would silently normalize).
    const parsedDate = new Date(`${memoryDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(memoryDate)
      || Number.isNaN(parsedDate.getTime())
      || parsedDate.toISOString().slice(0, 10) !== memoryDate) {
      return fail(res, 400, 'The date needs the YYYY-MM-DD shape.');
    }
    const created = await createRow('memories', 'unique()', { couple_id: couple.$id, author_id: user.id, title, note, memory_date: memoryDate, created_at: now() });
    if (created.status >= 400) return fail(res, 500, 'The memory could not be saved.');
    return res.json({ ok: true, data: { memory: created.data } });
  },

  async 'memory.update'({ res, user, body }) {
    const raw = String(body.id || '');
    if (!raw) return fail(res, 400, 'Missing memory.');
    const id = safeId(raw, 'id');
    const current = await getRow('memories', id);
    // Read outcomes are distinguished: only a real 404 means "gone";
    // auth/permission/rate/server failures must not masquerade as it.
    if (current.status === 404) return fail(res, 404, 'That memory no longer exists.');
    if (current.status >= 400) return fail(res, 500, 'The memory could not be verified.');
    const couple = await getCouple(user.id);
    if (!couple || current.data.couple_id !== couple.$id) return fail(res, 403, 'Not your memory.');
    const patch = {};
    if (body.title !== undefined) patch.title = String(body.title).trim().slice(0, 120);
    if (body.note !== undefined) patch.note = String(body.note).trim().slice(0, 2000);
    if (body.memory_date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.memory_date))) return fail(res, 400, 'The date needs the YYYY-MM-DD shape.');
      patch.memory_date = String(body.memory_date);
    }
    if (body.photo_file_id !== undefined) {
      if (body.photo_file_id === null) {
        patch.photo_file_id = null;
      } else {
        const fileId = String(body.photo_file_id);
        // Appwrite file IDs: [A-Za-z0-9][A-Za-z0-9_.-]{0,35}.
        if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,35}$/.test(fileId)) return fail(res, 400, 'That photo reference does not look right.');
        patch.photo_file_id = fileId;
      }
    }
    const upd = await updateRow('memories', id, patch);
    if (upd.status >= 400) return fail(res, 500, 'The memory could not be saved.');
    return res.json({ ok: true, data: { memory: upd.data } });
  },

  async 'memory.delete'({ res, user, body }) {
    const raw = String(body.id || '');
    if (!raw) return fail(res, 400, 'Missing memory.');
    const id = safeId(raw, 'id');
    const current = await getRow('memories', id);
    // Only an authenticated, successful read proving the row is MISSING
    // (404) earns the idempotent gone:true. A 401/403/429/5xx or timeout on
    // the read is NOT evidence of deletion and must surface as an error.
    if (current.status === 404) return res.json({ ok: true, data: { gone: true } });
    if (current.status >= 400) return fail(res, 500, 'The memory could not be verified — nothing was deleted.');
    const couple = await getCouple(user.id);
    if (!couple || current.data.couple_id !== couple.$id) return fail(res, 403, 'Not your memory.');
    const out = await deleteRow('memories', id);
    if (out.status >= 400 && out.status !== 404) return fail(res, 500, 'The memory could not be removed.');
    return res.json({ ok: true, data: { gone: true } });
  },

  async 'mood.add'({ res, user, couple, body }) {
    const emoji = String(body.emoji || '').slice(0, 16);
    const note = String(body.note || '').trim().slice(0, 500);
    if (!emoji) return fail(res, 400, 'Pick a mood first.');
    const created = await createRow('mood_check_ins', 'unique()', { couple_id: couple.$id, author_id: user.id, emoji, note, created_at: now() });
    if (created.status >= 400) return fail(res, 500, 'The mood could not be saved.');
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
    if (created.status >= 400) return fail(res, 500, 'The note could not be saved.');
    return res.json({ ok: true, data: { note: created.data } });
  },

  async 'note.list'({ res, user, couple }) {
    const rows = await listRowsWhere('pocket_notes', [['equal', 'couple_id', couple.$id]], 100);
    return res.json({ ok: true, data: { notes: rows, viewerId: user.id } });
  },

  // Marks a couple note as read by the recipient (idempotent).
  async 'note.markRead'({ res, user, couple, body }) {
    const raw = String(body.id || '');
    if (!raw) return fail(res, 400, 'Missing note.');
    const id = safeId(raw, 'id');
    const row = await getRow('pocket_notes', id);
    if (row.status === 404) return fail(res, 404, 'That note no longer exists.');
    if (row.status >= 400) return fail(res, 500, 'The note could not be verified.');
    if (row.data.couple_id !== couple.$id) return fail(res, 403, 'Not your note.');
    if (row.data.read_at) return res.json({ ok: true, data: { note: row.data, alreadyRead: true } });
    const upd = await updateRow('pocket_notes', id, { read_at: now() });
    if (upd.status >= 400) return fail(res, 500, 'The note could not be marked read.');
    return res.json({ ok: true, data: { note: upd.data, alreadyRead: false } });
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
    // otherwise a crafted adventure id would leak the partner's part. Only a
    // 404 read counts as "not found"; backend failures surface as errors.
    const adv = await getRow('weekly_adventures', adventureId);
    if (adv.status === 404) return fail(res, 403, 'Not your adventure.');
    if (adv.status >= 400) return fail(res, 500, 'The adventure could not be verified.');
    if (adv.data.couple_id !== couple.$id) return fail(res, 403, 'Not your adventure.');
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
    if (adv.status === 404) return fail(res, 403, 'Not your adventure.');
    if (adv.status >= 400) return fail(res, 500, 'The adventure could not be verified.');
    const couple = await getCouple(user.id);
    if (!couple || adv.data.couple_id !== couple.$id) return fail(res, 403, 'Not your adventure.');
    const prior = await listRowsWhere('adventure_parts', [['equal', 'adventure_id', adventureId], ['equal', 'author_id', user.id]], 1);
    if (prior.length) return res.json({ ok: true, data: { alreadyKept: true, part: prior[0] } });
    const created = await createRow('adventure_parts', 'unique()', { adventure_id: adventureId, author_id: user.id, entry, created_at: now() });
    if (created.status >= 400) return fail(res, 500, 'Your part could not be kept.');
    return res.json({ ok: true, data: { alreadyKept: false, part: created.data } });
  },

  // Partner profile for the couple screen (display name only — no emails).
  async 'partner.get'({ res, user, couple }) {
    const other = couple.partner_a_id === user.id ? couple.partner_b_id : couple.partner_a_id;
    if (!other) return res.json({ ok: true, data: { partner: null } });
    const row = await getRow('profiles', other);
    if (row.status === 404) return res.json({ ok: true, data: { partner: null } });
    if (row.status >= 400) return fail(res, 500, 'The partner profile could not be read.');
    return res.json({ ok: true, data: { partner: { id: row.data.$id, displayName: row.data.display_name, togetherSince: couple.created_at } } });
  },

  // Leaves the relationship WITHOUT deleting the account: live invitations
  // of the caller are revoked, the caller's couple slot is cleared and the
  // profile is unlinked. Authored content, the profile row and the auth
  // account are all kept. A last member leaving tears down the empty couple
  // with its shared content (same rules as account deletion's last-member
  // branch), so no memberless couple is orphaned.
  async 'partner.unlink'({ res, user, couple }) {
    const iAmA = couple.partner_a_id === user.id;
    const other = iAmA ? couple.partner_b_id : couple.partner_a_id;
    let failed = 0;
    if (other) {
      failed += await deleteAllRows('invitations', [['equal', 'couple_id', couple.$id], ['equal', 'created_by', user.id]]);
      const patch = iAmA ? { partner_a_id: null } : { partner_b_id: null };
      const upd = await updateRow('couples', couple.$id, patch);
      if (upd.status >= 400) failed += 1;
    } else {
      // Last member: shared content goes with the couple, removed while the
      // caller is still a member so failures stay retryable.
      const adventures = await listAllRows('weekly_adventures', [['equal', 'couple_id', couple.$id]]);
      for (const a of adventures) {
        failed += await deleteAllRows('adventure_parts', [['equal', 'adventure_id', a.$id]]);
      }
      failed += await deleteAllRows('daily_letters', [['equal', 'couple_id', couple.$id]]);
      failed += await deleteAllRows('pet_states', [['equal', 'couple_id', couple.$id]]);
      failed += await deleteAllRows('milestones', [['equal', 'couple_id', couple.$id]]);
      failed += await deleteAllRows('weekly_adventures', [['equal', 'couple_id', couple.$id]]);
      failed += await deleteAllRows('invitations', [['equal', 'couple_id', couple.$id]]);
      if (!failed) {
        const out = await deleteRow('couples', couple.$id);
        if (out.status >= 400 && out.status !== 404) failed += 1;
      }
    }
    if (failed) return fail(res, 500, 'The unlink could not be completed. Please retry.');
    const prof = await updateRow('profiles', user.id, { couple_id: null });
    if (prof.status >= 400 && prof.status !== 404) return fail(res, 500, 'The unlink could not be completed. Please retry.');
    return res.json({ ok: true, data: { unlinked: true, partnerKeptCouple: Boolean(other) } });
  },

  // Relationship statistics for the couple screen.
  async 'stats.get'({ res, user, couple }) {
    const memories = await listAllRows('memories', [['equal', 'couple_id', couple.$id]]);
    const moods = await listAllRows('mood_check_ins', [['equal', 'couple_id', couple.$id]]);
    const notes = await listAllRows('pocket_notes', [['equal', 'couple_id', couple.$id]]);
    const letters = await listAllRows('daily_letters', [['equal', 'couple_id', couple.$id]]);
    const other = couple.partner_a_id === user.id ? couple.partner_b_id : couple.partner_a_id;
    const mine = await listAllRows('responses', [['equal', 'author_id', user.id]]);
    const theirs = other ? await listAllRows('responses', [['equal', 'author_id', other]]) : [];
    const byLetter = new Map();
    for (const r of [...mine, ...theirs]) byLetter.set(r.letter_id, (byLetter.get(r.letter_id) || 0) + 1);
    let lettersCompleted = 0;
    for (const c of byLetter.values()) if (c >= 2) lettersCompleted += 1;
    const daysTogether = Math.max(0, Math.floor((Date.now() - new Date(couple.created_at).getTime()) / 86400000));
    return res.json({
      ok: true,
      data: {
        daysTogether,
        memoriesCount: memories.length,
        moodsCount: moods.length,
        notesCount: notes.length,
        lettersCount: letters.length,
        lettersCompleted,
      },
    });
  },

  async 'account.export'({ res, user, couple }) {
    // Exhaustive export: every category is paginated to exhaustion with a
    // stable orderAsc($id) + offset cursor, so large histories are complete
    // rather than silently truncated at the first 100 rows.
    const bundle = { exported_at: now(), profile: await getProfile(user.id), couple: couple ? { id: couple.$id, created_at: couple.created_at, anniversary: couple.anniversary ?? null } : null };
    if (couple) {
      bundle.daily_letters = await listAllRows('daily_letters', [['equal', 'couple_id', couple.$id]]);
      bundle.responses = await listAllRows('responses', [['equal', 'author_id', user.id]]);
      bundle.memories = await listAllRows('memories', [['equal', 'couple_id', couple.$id]]);
      bundle.mood_check_ins = await listAllRows('mood_check_ins', [['equal', 'author_id', user.id]]);
      bundle.pocket_notes = await listAllRows('pocket_notes', [['equal', 'couple_id', couple.$id]]);
      bundle.pet_state = await listRowsWhere('pet_states', [['equal', 'couple_id', couple.$id]], 1);
    }
    return res.json({ ok: true, data: bundle });
  },

  async 'account.delete'({ res, user, couple }) {
    // Retention policy (explicit): deletion is caller-scoped, idempotent and
    // retryable. Only rows authored by the caller are removed; shared couple
    // content is retained for the remaining partner; the couple and its
    // shared content are removed only when the caller is the last member.
    // Orphan rule: reactions pointing at the caller's responses, and
    // adventure parts pointing at deleted couple adventures, are removed
    // with their targets. Pagination: every list runs in pages of 100 until
    // exhausted. Failure rule: any failed delete marks the whole request 500
    // so the client retries — already-deleted rows stay deleted, and a
    // retried run skips them (404 treated as success).
    let failed = 0;
    // Cursor-based deletion to explicit exhaustion; the shared helpers above
    // THROW when the pagination safety ceiling is hit, so a truncated
    // cleanup aborts the whole run (500, credentials preserved) instead of
    // proceeding to profile/Auth deletion with private rows still stored.
    // Author-scoped cleanup runs UNCONDITIONALLY — a retried deletion after
    // a partial failure (or a run where the couple lookup fails) must still
    // remove every caller-authored row.
    failed += await deleteAllRows('memories', [['equal', 'author_id', user.id]]);
    failed += await deleteAllRows('mood_check_ins', [['equal', 'author_id', user.id]]);
    failed += await deleteAllRows('pocket_notes', [['equal', 'author_id', user.id]]);
    failed += await deleteAllRows('adventure_parts', [['equal', 'author_id', user.id]]);
    failed += await deleteResponsesCascade(user.id);
    if (couple) {
      const iAmA = couple.partner_a_id === user.id;
      const other = iAmA ? couple.partner_b_id : couple.partner_a_id;
      if (other) {
        // Hygiene: the caller's own unconsumed invitations must not outlive
        // their membership (an expired invite is harmless, a live one is not).
        failed += await deleteAllRows('invitations', [['equal', 'couple_id', couple.$id], ['equal', 'created_by', user.id]]);
        // Leave-pairing: clear only the CALLER's slot so the remaining
        // partner keeps the couple, its letters and the companion intact.
        // Clearing the slot severs couple access IMMEDIATELY — subsequent
        // calls resolve no couple and are denied. Idempotent on retry.
        const patch = iAmA ? { partner_a_id: null } : { partner_b_id: null };
        const upd = await updateRow('couples', couple.$id, patch);
        if (upd.status >= 400) failed += 1;
      } else {
        // Last member: the shared couple content goes with the couple.
        // Adventure parts of a partner who deleted their account earlier are
        // removed with their adventures so no orphan rows survive. This runs
        // WHILE the caller is still a member, so a failure here stays
        // retryable: the retry resolves the couple again and re-enters this
        // branch instead of orphaning a memberless couple.
        const adventures = await listAllRows('weekly_adventures', [['equal', 'couple_id', couple.$id]]);
        for (const a of adventures) {
          failed += await deleteAllRows('adventure_parts', [['equal', 'adventure_id', a.$id]]);
        }
        failed += await deleteAllRows('daily_letters', [['equal', 'couple_id', couple.$id]]);
        failed += await deleteAllRows('pet_states', [['equal', 'couple_id', couple.$id]]);
        failed += await deleteAllRows('milestones', [['equal', 'couple_id', couple.$id]]);
        failed += await deleteAllRows('weekly_adventures', [['equal', 'couple_id', couple.$id]]);
        failed += await deleteAllRows('invitations', [['equal', 'couple_id', couple.$id]]);
        // The couple row is removed only when every shared deletion
        // succeeded: a memberless couple with surviving shared rows could
        // never be reached again by a retry (no member resolves it).
        if (!failed) {
          const out = await deleteRow('couples', couple.$id);
          if (out.status >= 400 && out.status !== 404) failed += 1;
        }
      }
    }
    // Ordered, retryable deletion sequence — NOT one atomic multi-service
    // transaction: TablesDB cleanup and Appwrite Auth deletion are separate
    // services that cannot share a transaction. The guarantee is ordering +
    // idempotence: the Auth user and the profile row are destroyed ONLY when
    // every earlier step succeeded, so a partial failure never leaves an
    // unreachable account with surviving private rows. Any failure reports
    // 500 while credentials stay valid, and a retry skips already-deleted
    // rows (404 treated as success).
    if (failed) return fail(res, 500, 'Account deletion is incomplete — please retry.');
    const prof = await deleteRow('profiles', user.id);
    if (prof.status >= 400 && prof.status !== 404) return fail(res, 500, 'Account deletion is incomplete — please retry.');
    const auth = await fetch(`${ENDPOINT}/users/${encodeURIComponent(user.id)}`, { method: 'DELETE', headers: jsonHeaders() });
    if (!auth.ok && auth.status !== 404) return fail(res, 500, 'Account deletion is incomplete — please retry.');
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
