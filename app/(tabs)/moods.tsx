import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, Pressable, Modal, Image } from 'react-native';
import { Stack } from 'expo-router';
import { useApp } from '@/providers/AppProvider';
import { colors, spacing, radii } from '@/theme/tokens';
import { Card, SectionLabel, Button, ErrorNote, EmptyState } from '@/theme/ui';
import { FONT_HEAD, FONT_BODY, FONT_HEAD_ITALIC, FONT_BOLD, FONT_MEDIUM } from '@/theme/fonts';
import { EngravedDivider } from '@/components/Ornaments';
import { MemoryCard } from '@/components/MemoryCard';
import type { Memory, Milestone, MoodCheckIn } from '@/domain/types';

const MOODS = ['☀️', '🌙', '🌿', '🔥', '☁️', '☕️'];

export default function MoodsTab() {
  const { backend, session } = useApp();
  const [moods, setMoods] = useState<MoodCheckIn[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkInEmoji, setCheckInEmoji] = useState<string | null>(null);
  const [checkInNote, setCheckInNote] = useState('');
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [memTitle, setMemTitle] = useState('');
  const [memNote, setMemNote] = useState('');
  const [memDate, setMemDate] = useState(new Date().toISOString().slice(0, 10));
  const [memBusy, setMemBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [m, mem, ms] = await Promise.all([
        backend.getMoodCheckIns(),
        backend.getMemories(),
        backend.getMilestones(),
      ]);
      setMoods(m);
      setMemories(mem);
      setMilestones(ms);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your shared world');
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => {
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

  const addMemory = async () => {
    if (!memTitle.trim()) return;
    setMemBusy(true);
    try {
      await backend.addMemory({ title: memTitle.trim(), note: memNote.trim(), photoUri: null, memoryDate: memDate });
      setMemTitle('');
      setMemNote('');
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.oxide} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Your shared world</Text>
        <Text style={styles.title}>Small things, kept.</Text>

        <ErrorNote>{error}</ErrorNote>

        <Card style={{ marginBottom: spacing.xl }}>
          <SectionLabel>Share your mood</SectionLabel>
          <Text style={styles.moodHint}>Explicitly shared — your partner sees it only when you post it.</Text>
          <View style={styles.moodRow}>
            {MOODS.map((m) => (
              <Pressable
                key={m}
                onPress={() => setCheckInEmoji(m)}
                style={[styles.moodChip, checkInEmoji === m && styles.moodChipActive]}
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
                placeholderTextColor={colors.inkFaint}
                style={styles.noteInput}
                maxLength={120}
              />
              <Button label="Share this feeling" onPress={checkIn} loading={checkInBusy} style={{ marginTop: spacing.md }} />
            </View>
          )}
          {moods.length > 0 && (
            <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
              {moods.slice(0, 6).map((m) => (
                <View key={m.id} style={styles.moodEntry}>
                  <Text style={{ fontSize: 20 }}>{m.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.moodNote}>{m.note || '—'}</Text>
                    <Text style={styles.moodWhen}>
                      {new Date(m.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>

        <SectionLabel>Milestones</SectionLabel>
        {milestones.length === 0 ? (
          <Text style={styles.emptyLine}>Milestones appear as your story unfolds.</Text>
        ) : (
          <View style={{ marginBottom: spacing.xl, gap: spacing.sm }}>
            {milestones.slice(0, 5).map((ms) => (
              <View key={ms.id} style={styles.milestoneRow}>
                <Text style={styles.milestoneGlyph}>✦</Text>
                <Text style={styles.milestoneLabel}>{ms.label}</Text>
              </View>
            ))}
          </View>
        )}

        <EngravedDivider />

        <View style={[styles.memoryHeader, { marginTop: spacing.lg }]}>
          <SectionLabel>Keepsakes</SectionLabel>
          <Pressable onPress={() => setModalVisible(true)}>
            <Text style={styles.addMemory}>+ Keep a moment</Text>
          </Pressable>
        </View>
        {memories.length === 0 ? (
          <EmptyState title="No keepsakes yet" subtitle="Keep a note, a photo or a date worth returning to." />
        ) : (
          memories.map((m) => (
            <MemoryCard key={m.id} memory={m} onEdit={() => setModalVisible(true)} onDelete={() => removeMemory(m.id)} />
          ))
        )}

        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Keep a moment</Text>
              <TextInput value={memTitle} onChangeText={setMemTitle} placeholder="What happened?" placeholderTextColor={colors.inkFaint} style={styles.titleInput} maxLength={80} />
              <TextInput value={memNote} onChangeText={setMemNote} placeholder="Write the details..." placeholderTextColor={colors.inkFaint} style={[styles.titleInput, { minHeight: 100, textAlignVertical: 'top' }]} multiline maxLength={600} />
              <Text style={styles.dateHint}>Date</Text>
              <TextInput value={memDate} onChangeText={setMemDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.inkFaint} style={styles.titleInput} maxLength={10} />
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
                <View style={{ flex: 1 }}>
                  <Button label="Save" onPress={addMemory} loading={memBusy} disabled={!memTitle.trim()} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Cancel" variant="quiet" onPress={() => setModalVisible(false)} />
                </View>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.parchment },
  content: { padding: spacing.xl, paddingTop: 72, paddingBottom: 48 },
  center: { flex: 1, backgroundColor: colors.parchment, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 11.5, letterSpacing: 2, color: colors.inkFaint, fontFamily: FONT_BODY, textTransform: 'uppercase', marginBottom: 6 },
  title: { fontFamily: FONT_HEAD, fontSize: 30, color: colors.ink, marginBottom: spacing.xl },
  moodHint: { fontFamily: FONT_BODY, fontSize: 13, color: colors.inkFaint, marginBottom: spacing.md, lineHeight: 19 },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  moodChip: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.parchment,
    borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center',
  },
  moodChipActive: { borderColor: colors.oxide, backgroundColor: colors.oxideMist },
  noteInput: {
    backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm,
    padding: spacing.md, fontSize: 14.5, fontFamily: FONT_BODY, color: colors.ink,
  },
  moodEntry: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  moodNote: { fontFamily: FONT_MEDIUM, fontSize: 14, color: colors.ink },
  moodWhen: { fontFamily: FONT_BODY, fontSize: 11.5, color: colors.inkFaint },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.chalk, borderRadius: radii.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: spacing.lg },
  milestoneGlyph: { color: colors.brass, fontSize: 16 },
  milestoneLabel: { fontFamily: FONT_MEDIUM, fontSize: 14.5, color: colors.ink },
  emptyLine: { fontFamily: FONT_HEAD_ITALIC, fontSize: 14, color: colors.inkFaint, marginBottom: spacing.xl },
  memoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addMemory: { fontFamily: FONT_BOLD, fontSize: 13.5, color: colors.oxide },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(29,41,39,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.chalk, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, gap: spacing.md },
  modalTitle: { fontFamily: FONT_HEAD, fontSize: 22, color: colors.ink },
  titleInput: {
    backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm,
    padding: spacing.lg, fontSize: 15, fontFamily: FONT_BODY, color: colors.ink,
  },
  dateHint: { fontFamily: FONT_BOLD, fontSize: 12, color: colors.inkFaint, textTransform: 'uppercase', letterSpacing: 1.5 },
});
