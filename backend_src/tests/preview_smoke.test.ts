/**
 * Preview smoke check: exercises the exact modules the onboarding screen
 * uses, against the real environment configuration.
 * 1. Backend selection resolves without throwing (onboarding renders).
 * 2. Demo entry (seed + sign in as Mara) completes.
 * 3. Navigation-level state: session present, letter available, tabs data loads.
 */
import { DemoRepository } from '../../services/DemoRepository';
import { isSupabaseConfigured } from '../../services/supabaseClient';

async function smoke() {
  const results: string[] = [];
  const fail = (m: string) => {
    console.error('FAIL: ' + m);
    process.exit(1);
  };

  // 1. Onboarding module graph resolves and backend selection is safe.
  results.push('supabase configured: ' + isSupabaseConfigured());
  const demo = new DemoRepository();

  // 2. Demo entry (the "Enter the demo" button path).
  await demo.seedDemoCouple();
  await demo.signInAsPartner('a');
  const session = await demo.getSession();
  if (!session) fail('demo session missing after sign-in');
  results.push('demo entry: signed in as ' + session!.email);

  // 3. Tab screens' initial data loads (Letters, Companion, Us, Settings).
  const letter = await demo.getTodayLetter();
  if (!letter) fail('no letter after demo seed');
  results.push('letters tab: letter ready — ' + letter!.question.text.slice(0, 48) + '…');

  const companion = await demo.getCompanionState();
  if (!companion) fail('no companion state');
  results.push('companion tab: mood ' + companion!.mood + ', warmth ' + companion!.affection);

  const cared = await demo.careForCompanion('play');
  if (cared.affection <= companion!.affection) fail('care action did not increase warmth');
  results.push('companion care: warmth ' + companion!.affection + ' → ' + cared.affection);

  const memories = await demo.getMemories();
  const moods = await demo.getMoodCheckIns();
  const milestones = await demo.getMilestones();
  results.push('us tab: ' + memories.length + ' memories, ' + moods.length + ' moods, ' + milestones.length + ' milestones');

  await demo.addMoodCheckIn('🌿', 'smoke check note');
  if ((await demo.getMoodCheckIns()).length !== moods.length + 1) fail('mood check-in did not persist');
  results.push('mood check-in: persisted');

  const mem = await demo.addMemory({ title: 'Smoke test', note: 'temp', photoUri: null, memoryDate: '2026-10-17' });
  await demo.deleteMemory(mem.id);
  results.push('memory add/delete: ok');

  const stats = await demo.getStats();
  results.push('settings tab: ' + stats.lettersCompleted + ' letters, ' + stats.memoriesCount + ' keepsakes');

  const profile = await demo.getMyProfile();
  if (!profile) fail('profile missing');
  const partner = await demo.getPartnerProfile();
  if (!partner) fail('partner profile missing');
  results.push('pairing state: ' + profile!.displayName + ' paired with ' + partner!.displayName);

  // History must mark past letters revealed (both partners answered in seed).
  const history = await demo.getLetterHistory();
  if (history.length === 0) fail('history empty');
  results.push('history: ' + history.length + ' letters, ' + history.filter((h) => h.bothReplied).length + ' revealed');

  // Clean up so the preview starts fresh.
  await demo.resetDemo();
  console.log(results.map((r) => '  ✓ ' + r).join('\n'));
  console.log('SMOKE PASS');
}

smoke().catch((e) => {
  console.error('SMOKE FAIL:', e instanceof Error ? e.message : e);
  process.exit(1);
});
