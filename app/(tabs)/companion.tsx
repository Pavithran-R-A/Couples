import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/providers/AppProvider';
import { spacing, radii } from '@/theme/tokens';
import { ErrorNote, useTheme } from '@/theme/ui';
import { FONT_HEAD, FONT_BODY, FONT_BOLD, FONT_EDITORIAL, FONT_MEDIUM } from '@/theme/fonts';
import { LanternSeed } from '@/components/LanternSeed';
import { GardenGround, FlowerSprig, Constellation, KeepsakeStamp } from '@/components/Illustrations';
import type { CompanionState } from '@/domain/types';

const CARE_ACTIONS = [
  { kind: 'water' as const, label: 'Give water', hint: 'A slow, careful drink', tone: 'mint' as const },
  { kind: 'sunlight' as const, label: 'Turn to the sun', hint: 'A warm moment of light', tone: 'gold' as const },
  { kind: 'play' as const, label: 'Play together', hint: 'A little game, a little joy', tone: 'coral' as const },
];

const CARE_ACCENT: Record<string, string> = {
  mint: '#A9D6C4',
  gold: '#F5C779',
  coral: '#E67883',
};

export default function CompanionTab() {
  const insets = useSafeAreaInsets();
  const { backend, reducedMotion } = useApp();
  const theme = useTheme();
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount data load
    load();
  }, [load]);

  const care = async (kind: 'water' | 'sunlight' | 'play') => {
    setBusy(kind);
    setError('');
    try {
      const next = await backend.careForCompanion(kind);
      setState(next);
      setFlash(kind === 'water' ? 'Lumi drinks slowly, content.' : kind === 'sunlight' ? 'Lumi leans into the warmth.' : 'Lumi wobbles with delight.');
      setTimeout(() => setFlash(''), 2600);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not care for your companion');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!state) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg, padding: 32 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ marginBottom: spacing.lg }}>
          <GardenGround width={260} moonlit={theme.mode === 'moonlit'} />
        </View>
        <Text style={[styles.noCompanionTitle, { color: theme.ink }]}>No companion yet</Text>
        <Text style={[styles.noCompanionText, { color: theme.inkSoft, fontFamily: FONT_EDITORIAL, fontSize: 17 }]}>
          Lumi sprouts once you and your partner have paired.
        </Text>
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
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 28 }]}>
          <Text style={[styles.eyebrow, { color: theme.inkFaint }]}>Your companion</Text>
          <Text style={[styles.title, { color: theme.ink }]}>Lumi, the lantern-seed</Text>
          <Text style={[styles.tagline, { color: theme.inkFaint, fontFamily: FONT_EDITORIAL, fontSize: 17 }]}>
            It grows with care, never with guilt. Missing a day costs nothing.
          </Text>

          {/* illustrated environment */}
          <View style={[styles.stage, { backgroundColor: theme.mode === 'moonlit' ? theme.bgDeep : theme.goldSoft }]}>
            <View style={styles.stageSky}>
              <Constellation size={80} variant={2} color={theme.gold} />
            </View>
            <View style={styles.stageFlora}>
              <FlowerSprig size={34} color={theme.coral} />
              <FlowerSprig size={26} color={theme.gold} flip />
            </View>
            <LanternSeed
              mood={state.mood}
              affection={state.affection}
              size={reducedMotion ? 170 : 185}
              onPress={reducedMotion ? undefined : () => setFlash('Lumi blinks up at you, pleased.')}
            />
            <GardenGround width={330} moonlit={theme.mode === 'moonlit'} />
            {flash ? (
              <View style={[styles.flashPill, { backgroundColor: theme.surface, borderColor: theme.gold }]}>
                <Text style={[styles.flashText, { color: theme.ink }]}>{flash}</Text>
              </View>
            ) : null}
          </View>

          <ErrorNote theme={theme}>{error}</ErrorNote>

          <View style={[styles.statusCard, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <View style={styles.statusRow}>
              <KeepsakeStamp size={40} glyph={state.mood === 'sleepy' ? 'moon' : 'seed'} tone={theme.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.moodLine, { color: theme.ink }]}>{moodLabel[state.mood] ?? state.mood}</Text>
                <Text style={[styles.affectionLabel, { color: theme.inkFaint }]}>Warmth {Math.round(state.affection)} / 100</Text>
              </View>
            </View>
            <View style={[styles.affectionTrack, { backgroundColor: theme.surfaceSoft }]}>
              <View
                style={[
                  styles.affectionFill,
                  {
                    width: `${Math.max(6, state.affection)}%`,
                    backgroundColor: theme.gold,
                  },
                ]}
              />
            </View>
          </View>

          <Text style={[styles.sectionHint, { color: theme.inkFaint }]}>Care for Lumi together</Text>
          <View style={styles.actions}>
            {CARE_ACTIONS.map((a) => (
              <Pressable
                key={a.kind}
                onPress={() => care(a.kind)}
                disabled={busy !== null}
                style={({ pressed }) => [
                  styles.actionCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.line,
                    opacity: busy === a.kind ? 0.6 : pressed ? 0.94 : 1,
                  },
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
              >
                <View style={[styles.actionGlyphWrap, { backgroundColor: CARE_ACCENT[a.tone] + '22' }]}>
                  <View style={[styles.actionGlyphDot, { backgroundColor: CARE_ACCENT[a.tone] }]} />
                </View>
                <Text style={[styles.actionLabel, { color: theme.ink }]}>{a.label}</Text>
                <Text style={[styles.actionHint, { color: theme.inkFaint }]}>{a.hint}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.note, { color: theme.inkFaint }]}>
            Both of you can care for Lumi. Its warmth is shared — every gentle action from either
            partner is kept here.
          </Text>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow: {
    fontSize: 11.5,
    letterSpacing: 2,
    fontFamily: FONT_MEDIUM,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: { fontFamily: FONT_HEAD, fontSize: 30, lineHeight: 38 },
  tagline: { marginTop: 4, lineHeight: 24 },
  stage: {
    alignItems: 'center',
    borderRadius: radii.xl,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    paddingTop: spacing.lg,
    overflow: 'hidden',
  },
  stageSky: { position: 'absolute', top: 10, right: 18 },
  stageFlora: { position: 'absolute', bottom: 88, left: 26, flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  flashPill: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 7,
  },
  flashText: { fontFamily: FONT_EDITORIAL, fontSize: 14.5 },
  statusCard: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.xl },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  moodLine: { fontFamily: FONT_HEAD, fontSize: 18, marginBottom: 2 },
  affectionLabel: { fontFamily: FONT_BODY, fontSize: 12 },
  affectionTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  affectionFill: { height: 8, borderRadius: 4 },
  sectionHint: {
    fontSize: 11.5,
    letterSpacing: 2.2,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  actions: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  actionCard: {
    flex: 1,
    minWidth: 140,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  actionGlyphWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  actionGlyphDot: { width: 16, height: 16, borderRadius: 8 },
  actionLabel: { fontFamily: FONT_BOLD, fontSize: 14, textAlign: 'center' },
  actionHint: { fontFamily: FONT_BODY, fontSize: 11.5, textAlign: 'center', lineHeight: 16 },
  note: { fontFamily: FONT_BODY, fontSize: 13, lineHeight: 20, marginTop: spacing.xl, textAlign: 'center' },
  noCompanionTitle: { fontFamily: FONT_HEAD, fontSize: 22, marginBottom: 8 },
  noCompanionText: { textAlign: 'center', lineHeight: 24 },
});
