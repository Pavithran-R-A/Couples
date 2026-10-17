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
} from '../domain/types';
import type { BackendAdapter } from './BackendAdapter';
import { QUESTIONS, questionForIndex } from '../domain/questions';

const STORAGE_KEY = 'projecttwo_demo_v1';
const EPOCH = '2026-10-17';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

interface DemoData {
  session: AuthUser | null;
  profiles: Profile[];
  couple: Couple | null;
  invitations: Invitation[];
  letters: Array<{ id: string; coupleId: string; questionId: string; letterDate: string; questionText: string; category: string }>;
  responses: LetterResponse[];
  reactions: Reaction[];
  companion: CompanionState | null;
  memories: Memory[];
  milestones: Milestone[];
  moods: MoodCheckIn[];
  seeded: boolean;
}

function freshData(): DemoData {
  return {
    session: null,
    profiles: [],
    couple: null,
    invitations: [],
    letters: [],
    responses: [],
    reactions: [],
    companion: null,
    memories: [],
    milestones: [],
    moods: [],
    seeded: false,
  };
}

// Two fictional partners with isolated synthetic data; never real customer data.
const DEMO_PARTNERS = {
  a: { id: 'demo-user-a', email: 'mara@demo.local', displayName: 'Mara' },
  b: { id: 'demo-user-b', email: 'Theo@demo.local', displayName: 'Theo' },
};

export class DemoRepository implements BackendAdapter {
  readonly mode = 'demo' as const;
  private data: DemoData = freshData();
  private loaded = false;
  private listeners: Array<() => void> = [];

  async isDemoSeeded(): Promise<boolean> {
    await this.load();
    return this.data.seeded;
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.data = { ...freshData(), ...JSON.parse(raw) };
      }
    } catch {
      // First run or storage unavailable; start clean.
    }
    this.loaded = true;
  }

  private async save(): Promise<void> {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage unavailable; demo still works in memory for this session.
    }
    this.listeners.forEach((fn) => fn());
  }

  onChange(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  async resetDemo(): Promise<void> {
    this.data = freshData();
    await this.save();
  }

  async seedDemoCouple(): Promise<void> {
    await this.load();
    this.data = freshData();
    this.data.seeded = true;
    this.data.session = { id: DEMO_PARTNERS.a.id, email: DEMO_PARTNERS.a.email };
    this.data.profiles = [
      { id: DEMO_PARTNERS.a.id, email: DEMO_PARTNERS.a.email, displayName: DEMO_PARTNERS.a.displayName, coupleId: 'demo-couple', createdAt: new Date().toISOString() },
      { id: DEMO_PARTNERS.b.id, email: DEMO_PARTNERS.b.email, displayName: DEMO_PARTNERS.b.displayName, coupleId: 'demo-couple', createdAt: new Date().toISOString() },
    ];
    this.data.couple = {
      id: 'demo-couple',
      partnerAId: DEMO_PARTNERS.a.id,
      partnerBId: DEMO_PARTNERS.b.id,
      anniversary: '2023-05-14',
      createdAt: new Date().toISOString(),
    };
    this.data.companion = {
      coupleId: 'demo-couple',
      affection: 42,
      mood: 'greeting',
      lastInteractionAt: new Date().toISOString(),
      lastWateredAt: null,
      lastSunlitAt: null,
    };
    this.data.memories = [
      { id: 'demo-mem-1', coupleId: 'demo-couple', authorId: DEMO_PARTNERS.a.id, title: 'Rainy rooftop dinner', note: 'We cooked under the tarp and the rain kept perfect time.', photoUri: null, memoryDate: '2026-09-12', createdAt: new Date().toISOString() },
      { id: 'demo-mem-2', coupleId: 'demo-couple', authorId: DEMO_PARTNERS.b.id, title: 'The lighthouse walk', note: 'Wind, salt, and one very determined seagull.', photoUri: null, memoryDate: '2026-08-03', createdAt: new Date().toISOString() },
    ];
    // A few past letters so history feels lived-in.
    const pastDays = [1, 2, 3, 4];
    pastDays.forEach((ago, i) => {
      const d = new Date();
      d.setDate(d.getDate() - ago);
      const dateStr = d.toISOString().slice(0, 10);
      const q = questionForIndex(80 + i);
      const letterId = `demo-letter-past-${ago}`;
      this.data.letters.push({ id: letterId, coupleId: 'demo-couple', questionId: q.id, letterDate: dateStr, questionText: q.text, category: q.category });
      this.data.responses.push(
        { id: `${letterId}-ra`, letterId, authorId: DEMO_PARTNERS.a.id, body: DEMO_ANSWERS_A[i], createdAt: new Date().toISOString(), revealedAt: new Date().toISOString() },
        { id: `${letterId}-rb`, letterId, authorId: DEMO_PARTNERS.b.id, body: DEMO_ANSWERS_B[i], createdAt: new Date().toISOString(), revealedAt: new Date().toISOString() }
      );
    });
    this.data.milestones = [
      { id: 'demo-ms-1', coupleId: 'demo-couple', kind: 'first_letter', achievedAt: new Date(Date.now() - 5 * 86400000).toISOString(), label: 'First letter opened' },
      { id: 'demo-ms-2', coupleId: 'demo-couple', kind: 'letters_10', achievedAt: new Date().toISOString(), label: 'Ten letters answered' },
    ];
    await this.save();
  }

  async signInAsPartner(which: 'a' | 'b'): Promise<void> {
    await this.load();
    this.data.session = { id: DEMO_PARTNERS[which].id, email: DEMO_PARTNERS[which].email };
    await this.save();
  }

  async getSession(): Promise<AuthUser | null> {
    await this.load();
    return this.data.session;
  }

  async signUp(email: string, password: string, displayName: string): Promise<AuthUser> {
    await this.load();
    const id = `user-${Date.now()}`;
    const user: AuthUser = { id, email };
    this.data.session = user;
    this.data.profiles.push({ id, email, displayName, coupleId: null, createdAt: new Date().toISOString() });
    await this.save();
    return user;
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    await this.load();
    const profile = this.data.profiles.find((p) => p.email === email);
    if (!profile) throw new Error('No demo account found with that email. In demo mode you can sign up freely.');
    this.data.session = { id: profile.id, email: profile.email };
    await this.save();
    return this.data.session;
  }

  async signOut(): Promise<void> {
    await this.load();
    this.data.session = null;
    await this.save();
  }

  async requestPasswordReset(_email: string): Promise<void> {
    // Demo mode: nothing to reset, communicated in the UI.
  }

  async getMyProfile(): Promise<Profile | null> {
    await this.load();
    if (!this.data.session) return null;
    return this.data.profiles.find((p) => p.id === this.data.session!.id) ?? null;
  }

  async getPartnerProfile(): Promise<Profile | null> {
    await this.load();
    const me = await this.getMyProfile();
    if (!me?.coupleId) return null;
    return this.data.profiles.find((p) => p.coupleId === me.coupleId && p.id !== me.id) ?? null;
  }

  async getCouple(): Promise<Couple | null> {
    await this.load();
    const me = await this.getMyProfile();
    if (!me?.coupleId) return null;
    return this.data.couple;
  }

  async createInvitation(): Promise<Invitation> {
    await this.load();
    const me = await this.getMyProfile();
    if (!me) throw new Error('Not signed in');
    if (me.coupleId) throw new Error('You are already in a couple.');
    const code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
    const inv: Invitation = { code, coupleId: '', createdBy: me.id, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), consumed: false };
    this.data.invitations.push(inv);
    await this.save();
    return inv;
  }

  async getActiveInvitation(): Promise<Invitation | null> {
    await this.load();
    const me = await this.getMyProfile();
    if (!me) return null;
    return this.data.invitations.find((i) => i.createdBy === me.id && !i.consumed && new Date(i.expiresAt) > new Date()) ?? null;
  }

  async joinWithCode(code: string): Promise<void> {
    await this.load();
    const me = await this.getMyProfile();
    if (!me) throw new Error('Not signed in');
    const inv = this.data.invitations.find((i) => i.code === code.trim().toUpperCase() && !i.consumed && new Date(i.expiresAt) > new Date());
    if (!inv) throw new Error('That code is not valid, has expired, or was already used.');
    const creator = this.data.profiles.find((p) => p.id === inv.createdBy);
    if (!creator) throw new Error('Invitation creator not found.');
    if (creator.coupleId) throw new Error('That person is already in a couple.');
    const coupleId = `couple-${Date.now()}`;
    this.data.couple = { id: coupleId, partnerAId: creator.id, partnerBId: me.id, anniversary: null, createdAt: new Date().toISOString() };
    creator.coupleId = coupleId;
    me.coupleId = coupleId;
    inv.consumed = true;
    this.data.companion = { coupleId, affection: 20, mood: 'greeting', lastInteractionAt: new Date().toISOString(), lastWateredAt: null, lastSunlitAt: null };
    await this.save();
  }

  async unlinkPartner(): Promise<void> {
    await this.load();
    const me = await this.getMyProfile();
    if (!me?.coupleId) return;
    this.data.profiles.forEach((p) => {
      if (p.coupleId === me.coupleId) p.coupleId = null;
    });
    this.data.couple = null;
    this.data.companion = null;
    await this.save();
  }

  async getTodayLetter(): Promise<{ letterId: string; question: Question } | null> {
    await this.load();
    const me = await this.getMyProfile();
    if (!me?.coupleId) return null;
    const today = todayISO();
    let letter = this.data.letters.find((l) => l.coupleId === me.coupleId && l.letterDate === today);
    if (!letter) {
      const dayIndex = daysBetween(EPOCH, today);
      const q = questionForIndex(dayIndex);
      letter = { id: `letter-${today}-${me.coupleId}`, coupleId: me.coupleId, questionId: q.id, letterDate: today, questionText: q.text, category: q.category };
      this.data.letters.push(letter);
      await this.save();
    }
    return { letterId: letter.id, question: { id: letter.questionId, text: letter.questionText, category: letter.category } };
  }

  async getMyResponse(letterId: string): Promise<LetterResponse | null> {
    await this.load();
    const me = await this.getMyProfile();
    if (!me) return null;
    return this.data.responses.find((r) => r.letterId === letterId && r.authorId === me.id) ?? null;
  }

  async getPartnerResponse(letterId: string): Promise<LetterResponse | null> {
    await this.load();
    const me = await this.getMyProfile();
    if (!me) return null;
    const myResponse = this.data.responses.find((r) => r.letterId === letterId && r.authorId === me.id);
    if (!myResponse) return null; // Reveal requires both responses.
    const partnerResponse = this.data.responses.find((r) => r.letterId === letterId && r.authorId !== me.id);
    if (!partnerResponse) return null;
    return { ...partnerResponse, revealedAt: partnerResponse.revealedAt ?? new Date().toISOString() };
  }

  async submitResponse(letterId: string, body: string): Promise<void> {
    await this.load();
    const me = await this.getMyProfile();
    if (!me) throw new Error('Not signed in');
    const existing = this.data.responses.find((r) => r.letterId === letterId && r.authorId === me.id);
    if (existing) {
      existing.body = body;
    } else {
      this.data.responses.push({ id: `resp-${Date.now()}`, letterId, authorId: me.id, body, createdAt: new Date().toISOString(), revealedAt: null });
      this.data.milestones.push({ id: `ms-${Date.now()}`, coupleId: me.coupleId ?? '', kind: 'first_letter', achievedAt: new Date().toISOString(), label: 'First letter answered' });
    }
    await this.save();
  }

  async reactToResponse(responseId: string, kind: ReactionKind): Promise<void> {
    await this.load();
    const me = await this.getMyProfile();
    if (!me) throw new Error('Not signed in');
    const existing = this.data.reactions.find((r) => r.responseId === responseId && r.authorId === me.id);
    if (existing) {
      existing.kind = kind;
    } else {
      this.data.reactions.push({ id: `react-${Date.now()}`, responseId, authorId: me.id, kind, createdAt: new Date().toISOString() });
    }
    await this.save();
  }

  async getReactions(letterId: string): Promise<Reaction[]> {
    await this.load();
    const responseIds = this.data.responses.filter((r) => r.letterId === letterId).map((r) => r.id);
    return this.data.reactions.filter((r) => responseIds.includes(r.responseId));
  }

  async getLetterHistory(): Promise<Array<{ letterId: string; question: Question; date: string; bothReplied: boolean }>> {
    await this.load();
    const me = await this.getMyProfile();
    if (!me?.coupleId) return [];
    return this.data.letters
      .filter((l) => l.coupleId === me.coupleId)
      .sort((a, b) => b.letterDate.localeCompare(a.letterDate))
      .map((l) => {
        const authors = new Set(this.data.responses.filter((r) => r.letterId === l.id).map((r) => r.authorId));
        return { letterId: l.id, question: { id: l.questionId, text: l.questionText, category: l.category }, date: l.letterDate, bothReplied: authors.size === 2 };
      });
  }

  async getCompanionState(): Promise<CompanionState | null> {
    await this.load();
    const me = await this.getMyProfile();
    const c = this.data.companion;
    if (!me?.coupleId || !c) return null;
    return { ...c };
  }

  async careForCompanion(kind: 'water' | 'sunlight' | 'play'): Promise<CompanionState> {
    await this.load();
    const me = await this.getMyProfile();
    if (!me?.coupleId || !this.data.companion) throw new Error('No companion yet');
    const c = this.data.companion;
    const now = new Date().toISOString();
    c.affection = Math.min(100, c.affection + (kind === 'play' ? 6 : 4));
    c.mood = 'delighted';
    c.lastInteractionAt = now;
    if (kind === 'water') c.lastWateredAt = now;
    if (kind === 'sunlight') c.lastSunlitAt = now;
    await this.save();
    return { ...c };
  }

  async getMemories(): Promise<Memory[]> {
    await this.load();
    const me = await this.getMyProfile();
    if (!me?.coupleId) return [];
    return this.data.memories
      .filter((m) => m.coupleId === me.coupleId)
      .sort((a, b) => b.memoryDate.localeCompare(a.memoryDate));
  }

  async addMemory(input: { title: string; note: string; photoUri: string | null; memoryDate: string }): Promise<Memory> {
    await this.load();
    const me = await this.getMyProfile();
    if (!me?.coupleId) throw new Error('You need to be in a couple to add memories');
    const mem: Memory = { id: `mem-${Date.now()}`, coupleId: me.coupleId, authorId: me.id, title: input.title, note: input.note, photoUri: input.photoUri, memoryDate: input.memoryDate, createdAt: new Date().toISOString() };
    this.data.memories.push(mem);
    await this.save();
    return mem;
  }

  async updateMemory(id: string, patch: Partial<Pick<Memory, 'title' | 'note' | 'memoryDate'>>): Promise<void> {
    await this.load();
    const mem = this.data.memories.find((m) => m.id === id);
    if (!mem) throw new Error('Memory not found');
    if (patch.title !== undefined) mem.title = patch.title;
    if (patch.note !== undefined) mem.note = patch.note;
    if (patch.memoryDate !== undefined) mem.memoryDate = patch.memoryDate;
    await this.save();
  }

  async deleteMemory(id: string): Promise<void> {
    await this.load();
    this.data.memories = this.data.memories.filter((m) => m.id !== id);
    await this.save();
  }

  async getMilestones(): Promise<Milestone[]> {
    await this.load();
    const me = await this.getMyProfile();
    if (!me?.coupleId) return [];
    return this.data.milestones.filter((m) => m.coupleId === me.coupleId).sort((a, b) => b.achievedAt.localeCompare(a.achievedAt));
  }

  async getMoodCheckIns(): Promise<MoodCheckIn[]> {
    await this.load();
    const me = await this.getMyProfile();
    if (!me?.coupleId) return [];
    return this.data.moods.filter((m) => m.coupleId === me.coupleId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async addMoodCheckIn(emoji: string, note: string): Promise<void> {
    await this.load();
    const me = await this.getMyProfile();
    if (!me?.coupleId) throw new Error('You need to be in a couple to check in');
    this.data.moods.push({ id: `mood-${Date.now()}`, coupleId: me.coupleId, authorId: me.id, emoji, note, createdAt: new Date().toISOString() });
    await this.save();
  }

  async exportData(): Promise<Record<string, unknown>> {
    await this.load();
    return { mode: 'demo', exportedAt: new Date().toISOString(), ...this.data };
  }

  async deleteAccount(): Promise<void> {
    await this.load();
    const me = await this.getMyProfile();
    if (!me) return;
    this.data.profiles = this.data.profiles.filter((p) => p.id !== me.id);
    if (this.data.couple && (this.data.couple.partnerAId === me.id || this.data.couple.partnerBId === me.id)) {
      this.data.couple = null;
    }
    this.data.session = null;
    await this.save();
  }

  async getStats(): Promise<{ lettersCompleted: number; memoriesCount: number; daysTogether: number }> {
    await this.load();
    const me = await this.getMyProfile();
    if (!me?.coupleId) return { lettersCompleted: 0, memoriesCount: 0, daysTogether: 0 };
    const bothReplied = this.data.letters.filter((l) => {
      const authors = new Set(this.data.responses.filter((r) => r.letterId === l.id).map((r) => r.authorId));
      return authors.size === 2;
    }).length;
    const couple = this.data.couple;
    return {
      lettersCompleted: bothReplied,
      memoriesCount: this.data.memories.filter((m) => m.coupleId === me.coupleId).length,
      daysTogether: couple?.anniversary ? daysBetween(couple.anniversary, todayISO()) : 0,
    };
  }
}

const DEMO_ANSWERS_A = [
  'The rainy Saturday we rebuilt the bookshelf and never finished.',
  'The kettle clicking off downstairs.',
  'Warm bread, honestly.',
  'The green armchair by the window.',
];

const DEMO_ANSWERS_B = [
  'Slow pancakes with too much butter.',
  'Your footsteps on the stairs, always.',
  'Coffee and old paper.',
  'Any chair you are also in.',
];
