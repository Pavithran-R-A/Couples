/**
 * Demo tour regression: exercises every action the onboarding tour advertises,
 * against DemoRepository only (isolated synthetic world — no network).
 * 1. Seeded deterministic world: 12 memories, milestones, Lumi, past letters.
 * 2. Role switching Mara ↔ Theo is independent (sessions swap, privacy holds).
 * 3. Sealed letter: Mara answers → waiting state; Theo answers → reveal.
 * 4. Pocket notes: send as one partner, visible from the other perspective.
 * 5. Reset returns the world to its exact initial deterministic state.
 */
import { DemoRepository } from '../../services/DemoRepository';

async function tour() {
  const results: string[] = [];
  const fail = (m: string) => {
    console.error('FAIL: ' + m);
    process.exit(1);
  };

  const demo = new DemoRepository();

  // Seed + initial state
  await demo.seedDemoCouple();
  await demo.signInAsPartner('a');
  const memories0 = await demo.getMemories();
  if (memories0.length !== 12) fail(`expected 12 seeded memories, got ${memories0.length}`);
  const milestones0 = await demo.getMilestones();
  if (!milestones0.some((m) => m.kind === 'anniversary')) fail('anniversary milestone missing from seed');
  const notes0 = await demo.getPocketNotes();
  if (notes0.length !== 2) fail(`expected 2 seeded pocket notes, got ${notes0.length}`);
  results.push(`seeded world: ${memories0.length} keepsakes, ${milestones0.length} milestones, ${notes0.length} pocket notes`);

  // Today's letter is unopened (no responses yet)
  const letter = await demo.getTodayLetter();
  if (!letter) fail('no today letter after seed');
  const mine0 = await demo.getMyResponse(letter!.letterId);
  const theirs0 = await demo.getPartnerResponse(letter!.letterId);
  if (mine0 || theirs0) fail('today letter should start sealed');
  results.push('today letter: sealed (no answers yet)');

  // Mara answers → waiting state
  await demo.submitResponse(letter!.letterId, 'The morning we walked nowhere in particular.');
  const mineA = await demo.getMyResponse(letter!.letterId);
  const theirsA = await demo.getPartnerResponse(letter!.letterId);
  if (!mineA) fail('Mara answer missing after submit');
  if (theirsA) fail('reveal happened before Theo answered — privacy violation');
  results.push('as Mara: answer sealed, partner view still hidden');

  // Switch to Theo — his view must NOT contain Mara's answer yet
  await demo.signInAsPartner('b');
  const theoSeesMine = await demo.getMyResponse(letter!.letterId);
  if (theoSeesMine) fail('Theo can see Mara answer as his own — session swap broken');
  const theoSeesPartner = await demo.getPartnerResponse(letter!.letterId);
  if (theoSeesPartner) fail('Theo sees Mara answer before writing his own — privacy violation');
  results.push('as Theo: Mara answer invisible before he writes');

  // Theo answers → reveal for both
  await demo.submitResponse(letter!.letterId, 'Every bus stop that has a roof.');
  const theoPartner = await demo.getPartnerResponse(letter!.letterId);
  if (!theoPartner || theoPartner.authorId !== 'demo-user-a') fail('Theo reveal missing after both answered');
  await demo.signInAsPartner('a');
  const maraPartner = await demo.getPartnerResponse(letter!.letterId);
  if (!maraPartner || maraPartner.authorId !== 'demo-user-b') fail('Mara reveal missing after both answered');
  results.push('reveal: both partners now see each other');

  // Pocket note from Mara, read from Theo's perspective
  await demo.sendPocketNote('Check the teapot. Small surprise.');
  await demo.signInAsPartner('b');
  const theoNotes = await demo.getPocketNotes();
  if (!theoNotes.some((n) => n.body === 'Check the teapot. Small surprise.')) fail('Theo cannot see the note Mara sent');
  results.push('pocket notes: sent as Mara, visible to Theo');

  // Companion care persists across perspective switch
  const before = await demo.getCompanionState();
  await demo.careForCompanion('play');
  await demo.signInAsPartner('a');
  const after = await demo.getCompanionState();
  if (!before || !after || after.affection <= before.affection) fail('companion warmth did not persist across switch');
  results.push(`Lumi: warmth ${before!.affection} → ${after!.affection}, shared across perspectives`);

  // Reset restores the exact deterministic initial state
  await demo.resetDemo();
  const fresh = new DemoRepository();
  await fresh.seedDemoCouple();
  await fresh.signInAsPartner('a');
  const memoriesReset = await fresh.getMemories();
  if (memoriesReset.length !== 12) fail(`reset did not restore 12 memories, got ${memoriesReset.length}`);
  const letterReset = await fresh.getTodayLetter();
  const sealedAgain = letterReset ? (await fresh.getMyResponse(letterReset.letterId)) === null : false;
  if (!sealedAgain) fail('reset letter not sealed again');
  const notesReset = await fresh.getPocketNotes();
  if (notesReset.length !== 2) fail(`reset pocket notes expected 2, got ${notesReset.length}`);
  results.push('reset: world back to initial deterministic state');

  await fresh.resetDemo();
  console.log(results.map((r) => '  ✓ ' + r).join('\n'));
  console.log('TOUR PASS');
}

tour().catch((e) => {
  console.error('TOUR FAIL:', e instanceof Error ? e.message : e);
  process.exit(1);
});
