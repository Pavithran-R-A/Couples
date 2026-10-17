import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { useApp } from '@/providers/AppProvider';
import { colors, spacing } from '@/theme/tokens';
import { Card, SectionLabel, ErrorNote } from '@/theme/ui';
import { FONT_HEAD, FONT_BODY, FONT_HEAD_ITALIC, FONT_BOLD } from '@/theme/fonts';
import { LanternSeed } from '@/components/LanternSeed';
import type { CompanionState } from '@/domain/types';

const CARE_ACTIONS = [
  { kind: 'water' as const, label: 'Give water', glyph: '~', hint: 'A slow, careful drink' },
  { kind: 'sunlight' as const, label: 'Turn to the sun', glyph: '*', hint: 'A warm moment by the window' },
  { kind: 'play' as const, label: 'Play together', glyph: '°', hint: 'A little game, a little joy' },
];

export default function CompanionTab() {
  const { backend, session } = useApp();
  const [state, setState] = useState<CompanionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const load = useCallback(async () => {
    try {
      setState(await backend.getCompanionState());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your companion');
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => {
    load();
  }, [load]);

  const care = async (kind: 'water' | 'sunlight' | 'play') => {
    setBusy(kind);
    setError('');
    try {
      const next = await backend.careForCompanion(kind);
      setState(next);
      setFlash(kind === 'water' ? 'It drinks slowly, content.' : kind === 'sunlight' ? 'It leans into the warmth.' : 'It wobbles with delight.');
      setTimeout(() => setFlash(''), 2600);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not care for your companion');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.oxide} />
      </View>
    );
  }

  if (!state) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.noCompanionTitle}>No companion yet</Text>
        <Text style={styles.noCompanionText}>Your lantern-seed sprouts once you and your partner have paired.</Text>
      </View>
    );
  }

  const moodLabel: Record<string, string> = {
    idle: 'resting quietly',
    greeting: 'happy to see you',
    delighted: 'delighted',
    sleepy: 'dozing off',
    cared: 'feeling cared for',
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Your companion</Text>
        <Text style={styles.title}>The lantern-seed</Text>
        <Text style={styles.tagline}>It grows with care, never with guilt. Missing a day costs nothing.</Text>

        <View style={styles.stage}>
          <LanternSeed mood={state.mood} affection={state.affection} size={190} />
          {flash ? <Text style={styles.flash}>{flash}</Text> : null}
        </View>

        <ErrorNote>{error}</ErrorNote>

        <Card style={{ marginBottom: spacing.lg }}>
          <SectionLabel>Right now</SectionLabel>
          <Text style={styles.moodLine}>{moodLabel[state.mood] ?? state.mood}</Text>
          <View style={styles.affectionTrack}>
            <View style={[styles.affectionFill, { width: `${Math.max(6, state.affection)}%` }]} />
          </View>
          <Text style={styles.affectionLabel}>Warmth {Math.round(state.affection)} / 100</Text>
        </Card>

        <SectionLabel>Care for it together</SectionLabel>
        <View style={styles.actions}>
          {CARE_ACTIONS.map((a) => (
            <Pressable
              key={a.kind}
              onPress={() => care(a.kind)}
              disabled={busy !== null}
              style={({ pressed }) => [styles.actionCard, busy === a.kind && { opacity: 0.6 }, pressed && { transform: [{ scale: 0.97 }] }]}
            >
              <Text style={styles.actionGlyph}>{a.glyph}</Text>
              <Text style={styles.actionLabel}>{a.label}</Text>
              <Text style={styles.actionHint}>{a.hint}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.note}>
          Both of you can care for the seed. Its warmth is shared — every gentle action from either
          partner is kept here.
        </Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.parchment },
  content: { padding: spacing.xl, paddingTop: 72, paddingBottom: 48 },
  center: { flex: 1, backgroundColor: colors.parchment, alignItems: 'center', justifyContent: 'center', padding: 32 },
  eyebrow: { fontSize: 11.5, letterSpacing: 2, color: colors.inkFaint, fontFamily: FONT_BODY, textTransform: 'uppercase', marginBottom: 6 },
  title: { fontFamily: FONT_HEAD, fontSize: 30, color: colors.ink },
  tagline: { fontFamily: FONT_HEAD_ITALIC, fontSize: 14.5, color: colors.inkFaint, marginTop: 4, lineHeight: 21 },
  stage: { alignItems: 'center', paddingVertical: spacing.xxl, minHeight: 260, justifyContent: 'center' },
  flash: { fontFamily: FONT_HEAD_ITALIC, fontSize: 14, color: colors.brass, marginTop: spacing.md },
  moodLine: { fontFamily: FONT_HEAD, fontSize: 18, color: colors.ink, marginBottom: spacing.md },
  affectionTrack: { height: 8, backgroundColor: colors.parchmentDeep, borderRadius: 4, overflow: 'hidden' },
  affectionFill: { height: 8, backgroundColor: colors.brass, borderRadius: 4 },
  affectionLabel: { fontFamily: FONT_BODY, fontSize: 12, color: colors.inkFaint, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  actionCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.chalk,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  actionGlyph: { fontSize: 24, color: colors.sage, marginBottom: 4 },
  actionLabel: { fontFamily: FONT_BOLD, fontSize: 14, color: colors.ink, textAlign: 'center' },
  actionHint: { fontFamily: FONT_BODY, fontSize: 11.5, color: colors.inkFaint, textAlign: 'center', lineHeight: 16 },
  note: { fontFamily: FONT_BODY, fontSize: 13, color: colors.inkFaint, lineHeight: 20, marginTop: spacing.xl, textAlign: 'center' },
  noCompanionTitle: { fontFamily: FONT_HEAD, fontSize: 22, color: colors.ink, marginBottom: 8 },
  noCompanionText: { fontFamily: FONT_BODY, fontSize: 14.5, color: colors.inkSoft, textAlign: 'center', lineHeight: 22 },
});
