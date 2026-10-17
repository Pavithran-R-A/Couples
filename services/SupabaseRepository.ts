import type {
  AuthUser,
  Profile,
  Couple,
  Question,
  Reaction,
  ReactionKind,
  LetterResponse,
  Invitation,
  CompanionState,
  Memory,
  Milestone,
  MoodCheckIn,
  PocketNote,
} from '../domain/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BackendAdapter } from './BackendAdapter';

export class SupabaseRepository implements BackendAdapter {
  readonly mode = 'supabase' as const;
  private client: SupabaseClient;
  private cachedProfile: Profile | null = null;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async getSession(): Promise<AuthUser | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    const session = data.session;
    if (!session?.user) return null;
    return { id: session.user.id, email: session.user.email ?? '' };
  }

  async signUp(email: string, password: string, displayName: string): Promise<AuthUser> {
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) throw error;
    const user = data.user;
    if (!user) throw new Error('Sign up failed');
    const { error: profileError } = await this.client.from('profiles').insert({
      id: user.id,
      email,
      display_name: displayName,
    });
    if (profileError) throw profileError;
    return { id: user.id, email };
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('Sign in failed');
    return { id: data.user.id, email };
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }

  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }

  async getMyProfile(): Promise<Profile | null> {
    const session = await this.getSession();
    if (!session) return null;
    if (this.cachedProfile && this.cachedProfile.id === session.id) return this.cachedProfile;
    const { data, error } = await this.client
      .from('profiles')
      .select('id, email, display_name, couple_id, created_at')
      .eq('id', session.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const profile: Profile = {
      id: data.id,
      email: data.email,
      displayName: data.display_name,
      coupleId: data.couple_id,
      createdAt: data.created_at,
    };
    this.cachedProfile = profile;
    return profile;
  }

  async getPartnerProfile(): Promise<Profile | null> {
    const me = await this.getMyProfile();
    if (!me?.coupleId) return null;
    const { data, error } = await this.client
      .from('profiles')
      .select('id, email, display_name, couple_id, created_at')
      .eq('couple_id', me.coupleId)
      .neq('id', me.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      email: data.email,
      displayName: data.display_name,
      coupleId: data.couple_id,
      createdAt: data.created_at,
    };
  }

  async getCouple(): Promise<Couple | null> {
    const me = await this.getMyProfile();
    if (!me?.coupleId) return null;
    const { data, error } = await this.client
      .from('couples')
      .select('id, partner_a_id, partner_b_id, anniversary, created_at')
      .eq('id', me.coupleId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      partnerAId: data.partner_a_id,
      partnerBId: data.partner_b_id,
      anniversary: data.anniversary,
      createdAt: data.created_at,
    };
  }

  async createInvitation(): Promise<Invitation> {
    const me = await this.getMyProfile();
    if (!me) throw new Error('Not signed in');
    const { data: code, error } = await this.client.rpc('create_my_invitation');
    if (error || typeof code !== 'string') throw new Error('Could not create an invitation');
    const invitation = await this.getActiveInvitation();
    if (!invitation) throw new Error('Could not load the new invitation');
    return invitation;
  }

  async getActiveInvitation(): Promise<Invitation | null> {
    const me = await this.getMyProfile();
    if (!me) return null;
    const { data, error } = await this.client
      .from('invitations')
      .select('code, created_by, couple_id, expires_at, consumed')
      .eq('created_by', me.id)
      .eq('consumed', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { code: data.code, coupleId: data.couple_id ?? me.coupleId ?? '', createdBy: data.created_by, expiresAt: data.expires_at, consumed: data.consumed };
  }

  async joinWithCode(code: string): Promise<void> {
    const { data, error } = await this.client.rpc('join_couple_with_code', { p_code: code.trim().toUpperCase() });
    if (error) throw error;
    if (data === false) throw new Error('That code is not valid, has expired, or was already used.');
  }

  async unlinkPartner(): Promise<void> {
    const { data, error } = await this.client.rpc('unlink_partner');
    if (error) throw error;
    if (data === false) throw new Error('Could not unlink. Please try again.');
    this.cachedProfile = null;
  }

  async getTodayLetter(): Promise<{ letterId: string; question: Question } | null> {
    const me = await this.getMyProfile();
    if (!me?.coupleId) return null;
    const { data, error } = await this.client.rpc('get_or_create_today_letter');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      letterId: row.letter_id,
      question: { id: row.question_id, text: row.question_text, category: row.category },
    };
  }

  async getMyResponse(letterId: string): Promise<LetterResponse | null> {
    const session = await this.getSession();
    if (!session) return null;
    const { data, error } = await this.client
      .from('responses')
      .select('id, letter_id, author_id, body, created_at, revealed_at')
      .eq('letter_id', letterId)
      .eq('author_id', session.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      letterId: data.letter_id,
      authorId: data.author_id,
      body: data.body,
      createdAt: data.created_at,
      revealedAt: data.revealed_at,
    };
  }

  async getPartnerResponse(letterId: string): Promise<LetterResponse | null> {
    // RLS on the responses table guarantees partner rows are invisible
    // until both partners have submitted; this query simply returns null
    // (zero rows) while the reveal condition is not yet met.
    const { data, error } = await this.client
      .from('responses')
      .select('id, letter_id, author_id, body, created_at, revealed_at')
      .eq('letter_id', letterId)
      .neq('author_id', (await this.getSession())?.id ?? '')
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      letterId: data.letter_id,
      authorId: data.author_id,
      body: data.body,
      createdAt: data.created_at,
      revealedAt: data.revealed_at,
    };
  }

  async submitResponse(letterId: string, body: string): Promise<void> {
    const session = await this.getSession();
    if (!session) throw new Error('Not signed in');
    const { error } = await this.client.from('responses').upsert(
      { letter_id: letterId, author_id: session.id, body },
      { onConflict: 'letter_id,author_id' }
    );
    if (error) throw error;
  }

  async reactToResponse(responseId: string, kind: ReactionKind): Promise<void> {
    const { error } = await this.client.from('reactions').insert({ response_id: responseId, kind });
    if (error) throw error;
  }

  async getReactions(letterId: string): Promise<Reaction[]> {
    const { data, error } = await this.client
      .from('reactions')
      .select('id, response_id, author_id, kind, created_at, responses!inner(letter_id)')
      .eq('responses.letter_id', letterId);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      id: r.id,
      responseId: r.response_id,
      authorId: r.author_id,
      kind: r.kind,
      createdAt: r.created_at,
    }));
  }

  async getLetterHistory(): Promise<Array<{ letterId: string; question: Question; date: string; bothReplied: boolean }>> {
    const me = await this.getMyProfile();
    if (!me?.coupleId) return [];
    const { data, error } = await this.client
      .from('daily_letters')
      .select('id, letter_date, question_id, question_text, category, responses(author_id)')
      .eq('couple_id', me.coupleId)
      .order('letter_date', { ascending: false })
      .limit(30);
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      letterId: row.id,
      question: { id: row.question_id, text: row.question_text, category: row.category },
      date: row.letter_date,
      bothReplied: new Set((row.responses ?? []).map((response: { author_id: string }) => response.author_id)).size >= 2,
    }));
  }

  async getCompanionState(): Promise<CompanionState | null> {
    const me = await this.getMyProfile();
    if (!me?.coupleId) return null;
    const { data, error } = await this.client
      .from('pet_states')
      .select('couple_id, affection, mood, last_interaction_at, last_watered_at, last_sunlit_at')
      .eq('couple_id', me.coupleId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      coupleId: data.couple_id,
      affection: data.affection,
      mood: data.mood,
      lastInteractionAt: data.last_interaction_at,
      lastWateredAt: data.last_watered_at,
      lastSunlitAt: data.last_sunlit_at,
    };
  }

  async careForCompanion(kind: 'water' | 'sunlight' | 'play'): Promise<CompanionState> {
    const { data, error } = await this.client.rpc('care_for_companion', { p_kind: kind });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('Companion update failed');
    return {
      coupleId: row.couple_id,
      affection: row.affection,
      mood: row.mood,
      lastInteractionAt: row.last_interaction_at,
      lastWateredAt: row.last_watered_at,
      lastSunlitAt: row.last_sunlit_at,
    };
  }

  async getMemories(): Promise<Memory[]> {
    const me = await this.getMyProfile();
    if (!me?.coupleId) return [];
    const { data, error } = await this.client
      .from('memories')
      .select('id, couple_id, author_id, title, note, photo_uri, memory_date, created_at')
      .eq('couple_id', me.coupleId)
      .order('memory_date', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      id: row.id,
      coupleId: row.couple_id,
      authorId: row.author_id,
      title: row.title,
      note: row.note,
      photoUri: row.photo_uri,
      memoryDate: row.memory_date,
      createdAt: row.created_at,
    }));
  }

  async addMemory(input: { title: string; note: string; photoUri: string | null; memoryDate: string }): Promise<Memory> {
    const me = await this.getMyProfile();
    if (!me?.coupleId) throw new Error('You need to be in a couple to add memories');
    const { data, error } = await this.client
      .from('memories')
      .insert({
        couple_id: me.coupleId,
        author_id: me.id,
        title: input.title,
        note: input.note,
        photo_uri: input.photoUri,
        memory_date: input.memoryDate,
      })
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      coupleId: data.couple_id,
      authorId: data.author_id,
      title: data.title,
      note: data.note,
      photoUri: data.photo_uri,
      memoryDate: data.memory_date,
      createdAt: data.created_at,
    };
  }

  async updateMemory(id: string, patch: Partial<Pick<Memory, 'title' | 'note' | 'memoryDate'>>): Promise<void> {
    const update: Record<string, unknown> = {};
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.note !== undefined) update.note = patch.note;
    if (patch.memoryDate !== undefined) update.memory_date = patch.memoryDate;
    const { error } = await this.client.from('memories').update(update).eq('id', id);
    if (error) throw error;
  }

  async deleteMemory(id: string): Promise<void> {
    const { error } = await this.client.from('memories').delete().eq('id', id);
    if (error) throw error;
  }

  async getMilestones(): Promise<Milestone[]> {
    const me = await this.getMyProfile();
    if (!me?.coupleId) return [];
    const { data, error } = await this.client
      .from('milestones')
      .select('id, couple_id, kind, achieved_at, label')
      .eq('couple_id', me.coupleId)
      .order('achieved_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      id: row.id,
      coupleId: row.couple_id,
      kind: row.kind,
      achievedAt: row.achieved_at,
      label: row.label,
    }));
  }

  async getMoodCheckIns(): Promise<MoodCheckIn[]> {
    const me = await this.getMyProfile();
    if (!me?.coupleId) return [];
    const { data, error } = await this.client
      .from('mood_check_ins')
      .select('id, couple_id, author_id, emoji, note, created_at')
      .eq('couple_id', me.coupleId)
      .order('created_at', { ascending: false })
      .limit(14);
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      id: row.id,
      coupleId: row.couple_id,
      authorId: row.author_id,
      emoji: row.emoji,
      note: row.note,
      createdAt: row.created_at,
    }));
  }

  async addMoodCheckIn(emoji: string, note: string): Promise<void> {
    const me = await this.getMyProfile();
    if (!me?.coupleId) throw new Error('You need to be in a couple to check in');
    const { error } = await this.client
      .from('mood_check_ins')
      .insert({ couple_id: me.coupleId, author_id: me.id, emoji, note });
    if (error) throw error;
  }

  // Pocket notes are a demo-world concept for now; production has no table
  // yet, so these return an empty set / no-op rather than touching data.
  async getPocketNotes(): Promise<PocketNote[]> {
    return [];
  }

  async sendPocketNote(_body: string): Promise<PocketNote> {
    throw new Error('Pocket notes are coming soon.');
  }

  async exportData(): Promise<Record<string, unknown>> {
    const { data, error } = await this.client.rpc('export_my_data');
    if (error) throw error;
    return (data as Record<string, unknown>) ?? {};
  }

  async deleteAccount(): Promise<void> {
    const { data, error } = await this.client.rpc('delete_my_account');
    if (error) throw error;
    if (data === false) throw new Error('Account deletion failed. Please try again.');
  }

  async getStats(): Promise<{ lettersCompleted: number; memoriesCount: number; daysTogether: number }> {
    const { data, error } = await this.client.rpc('get_couple_stats');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return {
      lettersCompleted: row?.letters_completed ?? 0,
      memoriesCount: row?.memories_count ?? 0,
      daysTogether: row?.days_together ?? 0,
    };
  }
}
