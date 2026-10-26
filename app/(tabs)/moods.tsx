import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, Pressable, Modal } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/providers/AppProvider';
import { spacing, radii } from '@/theme/tokens';
import { Card, SectionLabel, Button, ErrorNote, useTheme } from '@/theme/ui';
import { FONT_HEAD, FONT_BODY, FONT_BOLD, FONT_MEDIUM, FONT_EDITORIAL } from '@/theme/fonts';
import { EngravedDivider } from '@/components/Ornaments';
import { MemoryCard } from '@/components/MemoryCard';
import { FlowerSprig, KeepsakeStamp, Constellation, Ribbon } from '@/components/Illustrations';
import { PerspectiveSwitcher } from '@/components/PerspectiveSwitcher';
import type { Memory, Milestone, MoodCheckIn, PocketNote } from '@/domain/types';

const MOODS = ['☀️', '🌙', '🌿', '🔥', '☁️', '☕️'];

export default function MoodsTab() {
  const { backend } = useApp();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [moods, setMoods] = useState<MoodCheckIn[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [notes, setNotes] = useState<PocketNote[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [me, setMe] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkInEmoji, setCheckInEmoji] = useState<string | null>(null);
  const [checkInNote, setCheckInNote] = useState('');
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [memTitle, setMemTitle] = useState('');
  const [memNote, setMemNote] = useState('');
  const [memDate, setMemDate] = useState(new Date().toISOString().slice(0, 10));
  const [memBusy, setMemBusy] = useState(false);
  const [memError, setMemError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [m, mem, ms, pn, prof] = await Promise.all([
        backend.getMoodCheckIns(),
        backend.getMemories(),
        backend.getMilestones(),
        backend.getPocketNotes(),
        backend.getMyProfile(),
      ]);
      setMoods(m);
      setMemories(mem);
      setMilestones(ms);
      setNotes(pn);
      setMe(prof?.id ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your shared world');
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount data load
    load();
  }, [load]);

  const checkIn = async () => {
    if (!checkInEmoji) return;
    setCheckInBusy(true);
    try {
      await backend.addMoodCheckIn(checkInEmoji, checkInNote.trim());
      setCheckInEmoji(null);
      setCheckInNote('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not share your mood');
    } finally {
      setCheckInBusy(false);
    }
  };

  const openAddMemory = () => {
    setEditingMemory(null);
    setMemTitle('');
    setMemNote('');
    setMemDate(new Date().toISOString().slice(0, 10));
    setMemError('');
    setModalVisible(true);
  };

  const openEditMemory = (m: Memory) => {
    setEditingMemory(m);
    setMemTitle(m.title);
    setMemNote(m.note);
    setMemDate(m.memoryDate);
    setMemError('');
    setModalVisible(true);
  };

  const saveMemory = async () => {
    if (!memTitle.trim()) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(memDate.trim())) {
      setMemError('The date needs the YYYY-MM-DD shape.');
      return;
    }
    setMemBusy(true);
    setMemError('');
    try {
      if (editingMemory) {
        await backend.updateMemory(editingMemory.id, {
          title: memTitle.trim(),
          note: memNote.trim(),
          memoryDate: memDate.trim(),
        });
      } else {
        await backend.addMemory({ title: memTitle.trim(), note: memNote.trim(), photoUri: null, memoryDate: memDate.trim() });
      }
      setMemTitle('');
      setMemNote('');
      setEditingMemory(null);
      setModalVisible(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that memory');
    } finally {
      setMemBusy(false);
    }
  };

  const removeMemory = async (id: string) => {
    try {
      await backend.deleteMemory(id);
      await load();
    } catch {
      setError('Could not remove that memory');
    }
  };

  const closeMemoryModal = () => {
    setEditingMemory(null);
    setMemError('');
    setModalVisible(false);
  };

  const sendNote = async () => {
    if (!noteDraft.trim()) return;
    setNoteBusy(true);
    try {
      await backend.sendPocketNote(noteDraft.trim());
      setNoteDraft('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send that note');
    } finally {
      setNoteBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 28 }]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.eyebrow, { color: theme.inkFaint }]}>Your shared world</Text>
              <Text style={[styles.title, { color: theme.ink }]}>Small things, kept.</Text>
            </View>
            <FlowerSprig size={44} color={theme.coral} />
          </View>

          <ErrorNote theme={theme}>{error}</ErrorNote>

          <PerspectiveSwitcher />

          {/* pocket notes — small surprise messages */}
          <Card theme={theme} style={{ marginBottom: spacing.xl, borderColor: theme.gold }}>
            <SectionLabel theme={theme} color={theme.gold}>
              Pocket notes
            </SectionLabel>
            <Text style={[styles.moodHint, { color: theme.inkFaint }]}>
              Tiny surprise messages. Write one here and read it from your partner&apos;s perspective.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <TextInput
                value={noteDraft}
                onChangeText={setNoteDraft}
                placeholder="Slip a note into their pocket…"
                placeholderTextColor={theme.inkFaint}
                style={[styles.noteInput, { backgroundColor: theme.surface, borderColor: theme.line, color: theme.ink, flex: 1 }]}
                maxLength={140}
                onSubmitEditing={sendNote}
              />
              <Button label="Send" onPress={sendNote} loading={noteBusy} disabled={!noteDraft.trim()} theme={theme} />
            </View>
            {notes.length > 0 && (
              <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
                {notes.slice(0, 8).map((n) => {
                  const mine = n.authorId === me;
                  return (
                    <View
                      key={n.id}
                      style={[
                        styles.pocketNote,
                        {
                          backgroundColor: theme.goldSoft,
                          borderColor: theme.gold,
                          alignSelf: mine ? 'flex-end' : 'flex-start',
                        },
                      ]}
                    >
                      <Text style={[styles.pocketNoteText, { color: theme.ink }]}>{n.body}</Text>
                      <Text style={[styles.pocketNoteWhen, { color: theme.inkFaint }]}>
                        {new Date(n.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>

          {/* mood check-in */}
          <Card theme={theme} tone="soft" style={{ marginBottom: spacing.xl }}>
            <SectionLabel theme={theme}>Share your mood</SectionLabel>
            <Text style={[styles.moodHint, { color: theme.inkFaint }]}>
              Explicitly shared — your partner sees it only when you post it.
            </Text>
            <View style={styles.moodRow}>
              {MOODS.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setCheckInEmoji(m)}
                  style={[
                    styles.moodChip,
                    { backgroundColor: theme.surface, borderColor: theme.line },
                    checkInEmoji === m && { borderColor: theme.accent, backgroundColor: theme.accentSoft },
                  ]}
                >
                  <Text style={{ fontSize: 22 }}>{m}</Text>
                </Pressable>
              ))}
            </View>
            {checkInEmoji && (
              <View style={{ marginTop: spacing.md }}>
                <TextInput
                  value={checkInNote}
                  onChangeText={setCheckInNote}
                  placeholder="A few words, if you like"
                  placeholderTextColor={theme.inkFaint}
                  style={[styles.noteInput, { backgroundColor: theme.surface, borderColor: theme.line, color: theme.ink }]}
                  maxLength={120}
                />
                <Button label="Share this feeling" onPress={checkIn} loading={checkInBusy} theme={theme} style={{ marginTop: spacing.md }} />
              </View>
            )}
            {moods.length > 0 && (
              <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
                {moods.slice(0, 6).map((m) => (
                  <View key={m.id} style={[styles.moodEntry, { borderBottomColor: theme.lineSoft }]}>
                    <Text style={{ fontSize: 20 }}>{m.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.moodNote, { color: theme.ink }]}>{m.note || '—'}</Text>
                      <Text style={[styles.moodWhen, { color: theme.inkFaint }]}>
                        {new Date(m.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>

          {/* milestones as a ribbon shelf */}
          <View style={styles.milestoneHeader}>
            <SectionLabel theme={theme}>Milestones</SectionLabel>
            <Constellation size={70} variant={1} color={theme.gold} />
          </View>
          {milestones.length === 0 ? (
            <Text style={[styles.emptyLine, { color: theme.inkFaint, fontFamily: FONT_EDITORIAL, fontSize: 16 }]}>
              Milestones appear as your story unfolds.
            </Text>
          ) : (
            <View style={{ marginBottom: spacing.xl, gap: spacing.sm }}>
              {milestones.slice(0, 5).map((ms, i) => (
                <View key={ms.id} style={[styles.milestoneRow, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                  <KeepsakeStamp size={30} tone={i % 2 === 0 ? theme.gold : theme.coral} glyph={i % 2 === 0 ? 'seed' : 'flower'} />
                  <Text style={[styles.milestoneLabel, { color: theme.ink }]}>{ms.label}</Text>
                </View>
              ))}
            </View>
          )}

          <EngravedDivider width={220} />

          {/* keepsake scrapbook */}
          <View style={[styles.memoryHeader, { marginTop: spacing.lg }]}>
            <SectionLabel theme={theme}>Keepsakes</SectionLabel>
            <Ribbon width={96} tone={theme.accent} text="kept" />
          </View>
          {memories.length === 0 ? (
            <View style={[styles.scrapbookEmpty, { backgroundColor: theme.surfaceSoft, borderColor: theme.line }]}>
              <KeepsakeStamp size={64} tone={theme.accent} glyph="seed" />
              <Text style={[styles.scrapbookEmptyTitle, { color: theme.ink }]}>The first page is blank</Text>
              <Text style={[styles.scrapbookEmptyText, { color: theme.inkSoft, fontFamily: FONT_EDITORIAL, fontSize: 16 }]}>
                Press a note, a photo or a date here — something worth returning to together.
              </Text>
              <Button label="Keep a moment" onPress={openAddMemory} theme={theme} style={{ marginTop: spacing.md }} />
            </View>
          ) : (
            <>
              <Pressable onPress={openAddMemory} style={styles.addMemoryHit}>
                <Text style={[styles.addMemory, { color: theme.accent }]}>+ Keep a moment</Text>
              </Pressable>
              {memories.map((m, i) => (
                <MemoryCard
                  key={m.id}
                  memory={m}
                  onEdit={() => openEditMemory(m)}
                  onDelete={() => removeMemory(m.id)}
                  theme={theme}
                  variant={(i % 2) as 0 | 1}
                />
              ))}
            </>
          )}

          <Modal visible={modalVisible} animationType="slide" transparent>
            <View style={[styles.modalBackdrop, { backgroundColor: theme.scrim }]}>
              <Pressable style={styles.backdropDismiss} onPress={closeMemoryModal} accessibilityLabel="Close" />
              <View style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
                <View style={[styles.sheetGrip, { backgroundColor: theme.line }]} />
                <View style={styles.modalHeadRow}>
                  <KeepsakeStamp size={34} glyph="flower" tone={theme.coral} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalTitle, { color: theme.ink }]}>
                      {editingMemory ? 'Revisit a moment' : 'Keep a moment'}
                    </Text>
                    <Text style={[styles.modalSub, { color: theme.inkFaint, fontFamily: FONT_EDITORIAL, fontSize: 15 }]}>
                      {editingMemory ? 'Gently retouched, pressed back into the book.' : 'Pressed into your shared scrapbook.'}
                    </Text>
                  </View>
                </View>
                <TextInput
                  value={memTitle}
                  onChangeText={setMemTitle}
                  placeholder="What happened?"
                  placeholderTextColor={theme.inkFaint}
                  style={[styles.titleInput, { backgroundColor: theme.surfaceSoft, borderColor: theme.line, color: theme.ink }]}
                  maxLength={80}
                />
                <TextInput
                  value={memNote}
                  onChangeText={setMemNote}
                  placeholder="Write the details…"
                  placeholderTextColor={theme.inkFaint}
                  style={[
                    styles.titleInput,
                    { minHeight: 100, textAlignVertical: 'top', backgroundColor: theme.surfaceSoft, borderColor: theme.line, color: theme.ink },
                  ]}
                  multiline
                  maxLength={600}
                />
                <Text style={[styles.dateHint, { color: theme.inkFaint }]}>Date</Text>
                <TextInput
                  value={memDate}
                  onChangeText={setMemDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.inkFaint}
                  style={[styles.titleInput, { backgroundColor: theme.surfaceSoft, borderColor: theme.line, color: theme.ink }]}
                  maxLength={10}
                />
                <ErrorNote theme={theme}>{memError}</ErrorNote>
                <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={editingMemory ? 'Save the changes' : 'Press into the book'}
                      onPress={saveMemory}
                      loading={memBusy}
                      disabled={!memTitle.trim()}
                      theme={theme}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button label="Cancel" variant="quiet" onPress={closeMemoryModal} theme={theme} />
                  </View>
                </View>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl },
  eyebrow: {
    fontSize: 11.5,
    letterSpacing: 2,
    fontFamily: FONT_MEDIUM,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: { fontFamily: FONT_HEAD, fontSize: 30, lineHeight: 38, marginBottom: 0 },
  moodHint: { fontFamily: FONT_BODY, fontSize: 13, marginBottom: spacing.md, lineHeight: 19 },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  moodChip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.md,
    fontSize: 14.5,
    fontFamily: FONT_BODY,
  },
  moodEntry: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  moodNote: { fontFamily: FONT_MEDIUM, fontSize: 14 },
  moodWhen: { fontFamily: FONT_BODY, fontSize: 11.5 },
  milestoneHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  milestoneLabel: { fontFamily: FONT_MEDIUM, fontSize: 14.5 },
  emptyLine: { marginBottom: spacing.xl },
  memoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addMemoryHit: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-end', marginBottom: spacing.sm },
  addMemory: { fontFamily: FONT_BOLD, fontSize: 13.5 },
  scrapbookEmpty: {
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  scrapbookEmptyTitle: { fontFamily: FONT_HEAD, fontSize: 18 },
  scrapbookEmptyText: { textAlign: 'center', lineHeight: 24, paddingHorizontal: spacing.sm },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  backdropDismiss: { flex: 1 },
  sheetGrip: {
    alignSelf: 'center',
    width: 44,
    height: 4.5,
    borderRadius: 3,
    marginBottom: spacing.md,
  },
  modalHeadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  modalSub: { lineHeight: 20 },
  modalSheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalTitle: { fontFamily: FONT_HEAD, fontSize: 22 },
  titleInput: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.lg,
    fontSize: 15,
    fontFamily: FONT_BODY,
  },
  dateHint: { fontFamily: FONT_BOLD, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5 },
  pocketNote: {
    maxWidth: '85%',
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: 4,
  },
  pocketNoteText: { fontFamily: FONT_BODY, fontSize: 14, lineHeight: 20 },
  pocketNoteWhen: { fontFamily: FONT_BODY, fontSize: 10.5 },
});
