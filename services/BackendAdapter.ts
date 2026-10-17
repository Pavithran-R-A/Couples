import type {
  AuthUser,
  CompanionState,
  Couple,
  Memory,
  Milestone,
  MoodCheckIn,
  Profile,
  Question,
  Reaction,
  ReactionKind,
  LetterResponse,
  Invitation,
  PocketNote,
  WeeklyAdventure,
} from '../domain/types';

export interface BackendAdapter {
  readonly mode: 'demo' | 'supabase';

  // Auth
  getSession(): Promise<AuthUser | null>;
  signUp(email: string, password: string, displayName: string): Promise<AuthUser>;
  signIn(email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;

  // Profiles / couple
  getMyProfile(): Promise<Profile | null>;
  getPartnerProfile(): Promise<Profile | null>;
  getCouple(): Promise<Couple | null>;
  createInvitation(): Promise<Invitation>;
  getActiveInvitation(): Promise<Invitation | null>;
  joinWithCode(code: string): Promise<void>;
  unlinkPartner(): Promise<void>;

  // Daily ritual
  getTodayLetter(): Promise<{ letterId: string; question: Question } | null>;
  getMyResponse(letterId: string): Promise<LetterResponse | null>;
  getPartnerResponse(letterId: string): Promise<LetterResponse | null>; // null until both submitted
  submitResponse(letterId: string, body: string): Promise<void>;
  reactToResponse(responseId: string, kind: ReactionKind): Promise<void>;
  getReactions(letterId: string): Promise<Reaction[]>;
  getLetterHistory(): Promise<Array<{ letterId: string; question: Question; date: string; bothReplied: boolean }>>;

  // Companion
  getCompanionState(): Promise<CompanionState | null>;
  careForCompanion(kind: 'water' | 'sunlight' | 'play'): Promise<CompanionState>;

  // Memories / milestones / moods
  getMemories(): Promise<Memory[]>;
  addMemory(input: { title: string; note: string; photoUri: string | null; memoryDate: string }): Promise<Memory>;
  updateMemory(id: string, patch: Partial<Pick<Memory, 'title' | 'note' | 'memoryDate'>>): Promise<void>;
  deleteMemory(id: string): Promise<void>;
  getMilestones(): Promise<Milestone[]>;
  getMoodCheckIns(): Promise<MoodCheckIn[]>;
  addMoodCheckIn(emoji: string, note: string): Promise<void>;

  // Pocket notes (affectionate short notes between partners)
  getPocketNotes(): Promise<PocketNote[]>;
  sendPocketNote(body: string): Promise<PocketNote>;
  markPocketNoteRead(noteId: string): Promise<void>;

  // Settings
  exportData(): Promise<Record<string, unknown>>;
  deleteAccount(): Promise<void>;
  getStats(): Promise<{ lettersCompleted: number; memoriesCount: number; daysTogether: number }>;

  // Weekly adventures (one small cooperative activity per couple per week)
  getWeeklyAdventure(): Promise<WeeklyAdventure | null>;
  completeAdventure(id: string, entry: string): Promise<WeeklyAdventure>;
}
