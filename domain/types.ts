export type Phase =
  | 'welcome'
  | 'auth'
  | 'pairing'
  | 'ritual'
  | 'companion'
  | 'memories'
  | 'settings';

export type Role = 'partner_a' | 'partner_b';

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  coupleId: string | null;
  createdAt: string;
}

export interface Couple {
  id: string;
  partnerAId: string;
  partnerBId: string | null;
  anniversary: string | null;
  createdAt: string;
}

export interface DailyLetter {
  id: string;
  coupleId: string;
  questionId: string;
  letterDate: string; // YYYY-MM-DD
}

export interface LetterResponse {
  id: string;
  letterId: string;
  authorId: string;
  body: string;
  createdAt: string;
  revealedAt: string | null; // set when both submitted
}

export type ReactionKind = 'heart' | 'smile' | 'spark';

export interface Reaction {
  id: string;
  responseId: string;
  authorId: string;
  kind: ReactionKind;
  createdAt: string;
}

export type CompanionMood =
  | 'idle'
  | 'greeting'
  | 'delighted'
  | 'sleepy'
  | 'cared';

export interface CompanionState {
  coupleId: string;
  affection: number; // 0..100 grows with care, never punishes
  mood: CompanionMood;
  lastInteractionAt: string;
  lastWateredAt: string | null;
  lastSunlitAt: string | null;
}

export interface Memory {
  id: string;
  coupleId: string;
  authorId: string;
  title: string;
  note: string;
  photoUri: string | null;
  memoryDate: string;
  createdAt: string;
}

export type MilestoneKind =
  | 'first_letter'
  | 'letters_10'
  | 'letters_50'
  | 'first_memory'
  | 'anniversary';

export interface Milestone {
  id: string;
  coupleId: string;
  kind: MilestoneKind;
  achievedAt: string;
  label: string;
}

export interface MoodCheckIn {
  id: string;
  coupleId: string;
  authorId: string;
  emoji: string;
  note: string;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface Invitation {
  code: string;
  coupleId: string;
  createdBy: string;
  expiresAt: string;
  consumed: boolean;
}

export interface Question {
  id: string;
  text: string;
  category: string;
}
