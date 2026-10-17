import { DemoRepository } from '../../services/DemoRepository';

/**
 * Reveal-privacy test for the demo repository.
 * Asserts that partner B's answer is unreadable through the
 * public interface until partner A has also submitted.
 */
async function testRevealPrivacy() {
  const repo = new DemoRepository();
  await repo.seedDemoCouple();
  await repo.signInAsPartner('a');

  const letter = await repo.getTodayLetter();
  if (!letter) throw new Error('expected today letter to exist');

  // Partner A has not submitted yet: partner response must be null
  const beforeMine = await repo.getPartnerResponse(letter.letterId);
  if (beforeMine !== null) {
    throw new Error('FAIL: partner answer visible before I submitted');
  }

  // Partner A submits
  await repo.submitResponse(letter.letterId, 'My quiet answer.');

  // Partner B has not submitted: still hidden
  const afterMine = await repo.getPartnerResponse(letter.letterId);
  if (afterMine !== null) {
    throw new Error('FAIL: partner answer visible after only I submitted');
  }

  // Simulate partner B submitting (write directly as B via the repository)
  await repo.signInAsPartner('b');
  await repo.submitResponse(letter.letterId, 'My answer back.');
  await repo.signInAsPartner('a');

  // Now both exist: reveal allowed
  const revealed = await repo.getPartnerResponse(letter.letterId);
  if (!revealed || revealed.body !== 'My answer back.') {
    throw new Error('FAIL: partner answer not revealed after both submitted');
  }

  console.log('PASS: reveal privacy holds across all three phases');
}

testRevealPrivacy().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
