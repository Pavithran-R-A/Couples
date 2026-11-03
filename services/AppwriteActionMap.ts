// BackendAdapter → Appwrite compatibility matrix.
//
// Every method of the existing BackendAdapter interface MUST appear in this
// map (the type below is exhaustive over keyof BackendAdapter — adding an
// adapter method without a mapping fails `tsc`). The contract test
// (backend_src/tests/adapter_map.test.mjs) additionally asserts that every
// mapped Function action still exists in the deployed Function source, so a
// renamed or removed action fails CI.
//
// Auth operations run client-side with the Appwrite Auth SDK (account.*);
// data operations run through the couples-api Function with the verified
// caller identity. Memory photos use the Appwrite Storage SDK against a
// dedicated private bucket (created at provisioning) — only the file ID is
// stored in TablesDB (memories.photo_file_id).
import type { BackendAdapter } from './BackendAdapter';

export interface AdapterMapping {
  /** Client-side Appwrite Auth/Storage SDK operation, if any. */
  readonly sdk?: string;
  /** couples-api Function action (must exist in main.js ACTION_NAMES). */
  readonly action?: string;
  /** Human explanation of the mapping decision. */
  readonly note: string;
}

// `mode` is the adapter discriminator, not an operation — every OTHER
// method must be mapped (compile-time exhaustive).
export type AdapterMethodName = Exclude<keyof BackendAdapter, 'mode'>;

export const APPWRITE_ACTION_MAP: Record<AdapterMethodName, AdapterMapping> = {
  // Auth — Appwrite Auth SDK, client-side; no Function involvement.
  getSession: { sdk: 'account.get', note: 'Session restored from the Appwrite Auth SDK.' },
  signUp: { sdk: 'account.create + account.createEmailPasswordSession', note: 'Email verification enforced server-side by the Function.' },
  signIn: { sdk: 'account.createEmailPasswordSession', note: '' },
  signOut: { sdk: 'account.deleteSession("current")', note: '' },
  requestPasswordReset: { sdk: 'account.createRecovery', note: 'Deep link projecttwo://reset-password completes recovery.' },
  updatePassword: { sdk: 'account.updateRecovery / account.updatePassword', note: '' },

  // Profiles / couple
  getMyProfile: { action: 'profile.get', note: 'Profile auto-bootstraps on first authenticated call.' },
  getPartnerProfile: { action: 'partner.get', note: 'Display name only; no partner email leaves the server.' },
  getCouple: { action: 'pair.status', note: 'Returns coupleId/role/paired state.' },
  createInvitation: { action: 'pair.start', note: 'Creates the couple on first invite; re-invites into a half-empty couple.' },
  getActiveInvitation: { action: 'pair.status', note: 'activeInvite present while an unconsumed invitation exists.' },
  joinWithCode: { action: 'pair.join', note: 'Atomic transactional join; fills the empty slot.' },
  unlinkPartner: { action: 'partner.unlink', note: 'Leaves the relationship without deleting the account.' },

  // Daily ritual
  getTodayLetter: { action: 'letter.today', note: 'Get-or-create one letter per couple per day.' },
  getMyResponse: { action: 'response.state', note: 'mine field; sealed before reveal.' },
  getPartnerResponse: { action: 'response.state', note: 'partner field; null until both submitted.' },
  submitResponse: { action: 'response.submit', note: 'First-write-wins; server-stamped mutual reveal.' },
  reactToResponse: { action: 'reaction.set', note: 'Create-or-update, gated on reveal + couple ownership.' },
  getReactions: { action: 'reaction.list', note: 'All reactions on a letter\'s two responses.' },
  getLetterHistory: { action: 'letter.history', note: 'Full couple archive, cursor-paginated server-side.' },

  // Companion
  getCompanionState: { action: 'lumi.state', note: 'One pet per couple, created on demand.' },
  careForCompanion: { action: 'lumi.care', note: 'Transactional mood patch + atomic warmth increment.' },

  // Memories / milestones / moods
  getMemories: { action: 'memory.list', note: '' },
  addMemory: { action: 'memory.create', note: 'photoUri uploads via Storage SDK first; the file ID is stored.' },
  updateMemory: { action: 'memory.update', note: 'Accepts photo_file_id set/clear alongside title/note/date.' },
  deleteMemory: { action: 'memory.delete', note: 'Only an authenticated 404 earns idempotent gone:true.' },
  getMilestones: { action: 'milestone.list', note: '' },
  getMoodCheckIns: { action: 'mood.list', note: '' },
  addMoodCheckIn: { action: 'mood.add', note: '' },

  // Pocket notes
  getPocketNotes: { action: 'note.list', note: 'viewerId lets the client distinguish sent vs received.' },
  sendPocketNote: { action: 'note.add', note: '' },
  markPocketNoteRead: { action: 'note.markRead', note: 'Idempotent read_at stamp by the couple.' },

  // Settings
  exportData: { action: 'account.export', note: 'Cursor-paginated to explicit exhaustion; fails closed at the ceiling.' },
  deleteAccount: { action: 'account.delete', note: 'Ordered retryable teardown; Auth deleted only after full cleanup.' },
  getStats: { action: 'stats.get', note: 'daysTogether/memoriesCount/lettersCompleted computed server-side.' },

  // Weekly adventures
  getWeeklyAdventure: { action: 'adventure.current + adventure.part.get', note: 'Deterministic weekly kind; partner part hidden until both submit.' },
  completeAdventure: { action: 'adventure.complete', note: 'Couple-verified write; failure never reports success.' },
};

/** Memory photos: client-side Storage SDK against the private couples-photos bucket. */
export const STORAGE_BUCKET_ID = 'couples-photos';
