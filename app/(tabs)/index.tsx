import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/providers/AppProvider';
import { spacing, radii } from '@/theme/tokens';
import { Card, SectionLabel, Button, ErrorNote, Pill, EmptyState, useTheme } from '@/theme/ui';
import {
  FONT_HEAD,
  FONT_BODY,
  FONT_BOLD,
  FONT_MEDIUM,
  FONT_EDITORIAL,
} from '@/theme/fonts';
import { EngravedDivider, WaxSeal } from '@/components/Ornaments';
import { EnvelopeArt, FlowerSprig, KeepsakeStamp, Constellation } from '@/components/Illustrations';
import { PerspectiveSwitcher } from '@/components/PerspectiveSwitcher';
import { ReactionRow } from '@/components/ReactionRow';
import { AdventureStage } from '@/components/AdventureStage';
import type { LetterResponse, Reaction, WeeklyAdventure } from '@/domain/types';

export default function LettersTab() {
  const { backend, mode, session, reducedMotion } = useApp();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDemo = mode === 'demo';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [letter, setLetter] = useState<{ letterId: string; question: { id: string; text: string; category: string } } | null>(null);
  const [myResponse, setMyResponse] = useState<LetterResponse | null>(null);
  const [partnerResponse, setPartnerResponse] = useState<LetterResponse | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<{ letterId: string; question: { text: string }; date: string; bothReplied: boolean }[]>([]);
  const [adventure, setAdventure] = useState<WeeklyAdventure | null>(null);
  const [adventureEntry, setAdventureEntry] = useState('');
  const [adventureBusy, setAdventureBusy] = useState(false);
  // Which side of the couple the current perspective sits on ('a' = partner A).
  const [mySide, setMySide] = useState<'a' | 'b' | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      setError('');
      try {
        // Resolve the viewer's side from the authorized couple record, so the
        // same screen renders correctly for either partner (both modes).
        let side: 'a' | 'b' | null = null;
        if (session) {
          const couple = await backend.getCouple();
          if (couple) side = couple.partnerAId === session.id ? 'a' : 'b';
        }
        setMySide(side);
        const today = await backend.getTodayLetter();
        setLetter(today);
        if (today) {
          const mine = await backend.getMyResponse(today.letterId);
          setMyResponse(mine);
          setDraft(mine?.body ?? '');
          if (mine) {
            const theirs = await backend.getPartnerResponse(today.letterId);
            setPartnerResponse(theirs);
            if (theirs) setReactions(await backend.getReactions(today.letterId));
          } else {
            setPartnerResponse(null);
          }
        }
        setHistory(await backend.getLetterHistory());
        try {
          const adv = await backend.getWeeklyAdventure();
          setAdventure(adv);
          if (adv) setAdventureEntry((side === 'b' ? adv.partnerBEntry : adv.partnerAEntry) ?? '');
        } catch {
          setAdventure(null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load today\u2019s letter');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [backend, session]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data load on mount
    load();
  }, [load]);

  const submit = async () => {
    if (!letter || !draft.trim()) return;
    setSubmitting(true);
    try {
      await backend.submitResponse(letter.letterId, draft.trim());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your answer');
    } finally {
      setSubmitting(false);
    }
  };

  const react = async (kind: 'heart' | 'smile' | 'sparkle') => {
    if (!letter || !partnerResponse) return;
    try {
      await backend.reactToResponse(partnerResponse.id, kind);
      setReactions(await backend.getReactions(letter.letterId));
    } catch {
      setError('Could not send that reaction');
    }
  };

  const saveAdventure = async (entryText: string) => {
    if (!adventure) return;
    setAdventureBusy(true);
    try {
      const next = await backend.completeAdventure(adventure.id, entryText);
      setAdventure(next);
    } catch {
      setError('Could not save your part of the adventure');
    } finally {
      setAdventureBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  const bothReplied = Boolean(myResponse && partnerResponse);
  const envelopeOpen = bothReplied;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 28 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.accent} />}
        >
          {/* living-world header */}
          <PerspectiveSwitcher />
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.eyebrow, { color: theme.inkFaint }]}>
                {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
              <Text style={[styles.title, { color: theme.ink }]}>Today&apos;s letter</Text>
            </View>
            <WaxSeal size={42} />
          </View>

          <ErrorNote theme={theme}>{error}</ErrorNote>

          {!letter ? (
            <Card theme={theme}>
              <EmptyState theme={theme} title="No letter yet" subtitle="Letters begin once you and your partner have paired." />
              <Button label="Go to pairing" variant="ghost" onPress={() => router.push('/pairing')} theme={theme} />
            </Card>
          ) : (
            <View
              style={[
                styles.letterStage,
                {
                  backgroundColor: theme.mode === 'moonlit' ? theme.surface : theme.surfaceSoft,
                  borderColor: envelopeOpen ? theme.gold : theme.line,
                },
              ]}
            >
              {/* the envelope — dominant visual */}
              <View style={styles.envelopeRow}>
                <EnvelopeArt
                  size={132}
                  open={envelopeOpen}
                  flapColor={theme.accent}
                  bodyColor={theme.mode === 'moonlit' ? '#3A2B3D' : '#EFE3EE'}
                  sealColor={theme.coral}
                  letterColor={theme.surfaceRaised}
                />
                {!envelopeOpen && <Constellation size={72} variant={1} color={theme.gold} />}
              </View>

              <View style={styles.categoryRow}>
                <Pill tone="plum" theme={theme}>
                  {letter.question.category}
                </Pill>
                <Text style={[styles.sealHint, { color: theme.inkFaint }]}>
                  {envelopeOpen ? 'opened together' : 'answers hidden until you both write'}
                </Text>
              </View>

              <Text style={[styles.question, { color: theme.ink }]}>{letter.question.text}</Text>

              {myResponse ? (
                <View style={[styles.answeredBox, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                  <Text style={[styles.answeredLabel, { color: theme.gold }]}>Your answer, sealed</Text>
                  <Text style={[styles.myAnswer, { color: theme.ink }]}>{myResponse.body}</Text>
                </View>
              ) : (
                <>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Write quietly — only you can see this until you both answer…"
                    placeholderTextColor={theme.inkFaint}
                    multiline
                    style={[
                      styles.draftInput,
                      { backgroundColor: theme.surface, borderColor: theme.line, color: theme.ink },
                    ]}
                  />
                  <Button label="Seal and send" onPress={submit} loading={submitting} disabled={!draft.trim()} theme={theme} style={{ marginTop: spacing.md }} />
                </>
              )}
            </View>
          )}

          {bothReplied && partnerResponse && (
            <Card theme={theme} tone="raised" style={[styles.revealCard, { borderColor: theme.gold }]}>
              <SectionLabel theme={theme} color={theme.coral}>
                Revealed
              </SectionLabel>
              <Text style={[styles.partnerName, { color: theme.inkFaint, fontFamily: FONT_EDITORIAL, fontSize: 17 }]}>
                {mode === 'demo' ? (mySide === 'a' ? 'Theo' : 'Mara') : 'Your partner'} wrote
              </Text>
              <Text style={[styles.partnerAnswer, { color: theme.ink }]}>{partnerResponse.body}</Text>
              <EngravedDivider width={220} />
              <ReactionRow onReact={react} activeKind={reactions.find((r) => r.responseId === partnerResponse.id)?.kind ?? null} theme={theme} />
            </Card>
          )}

          {myResponse && !partnerResponse && (
            <View style={[styles.waitingCard, { backgroundColor: theme.surfaceSoft, borderColor: theme.line }]}>
              <FlowerSprig size={38} color={theme.coral} />
              <Text style={[styles.waitingTitle, { color: theme.ink }]}>Sealed and waiting.</Text>
              <Text style={[styles.waitingText, { color: theme.inkSoft }]}>
                Your answer is tucked away. The envelope opens only when you have both written.
              </Text>
              {isDemo && (
                <Text style={[styles.demoHint, { color: theme.gold, fontFamily: FONT_EDITORIAL, fontSize: 15.5 }]}>
                  Try it: switch to Theo below and write the second answer.
                </Text>
              )}
            </View>
          )}

          {adventure && (
            <View style={[styles.adventureCard, { backgroundColor: theme.surfaceSoft, borderColor: theme.goldSoft ?? theme.line }]}>
              <View style={styles.adventureHead}>
                <KeepsakeStamp size={30} glyph="seed" tone={theme.gold} />
                <SectionLabel theme={theme} color={theme.gold}>
                  This week&apos;s adventure
                </SectionLabel>
                {adventure.partnerADone && adventure.partnerBDone ? (
                  <Pill tone="mint" theme={theme}>
                    Done together
                  </Pill>
                ) : null}
              </View>
              <Text style={[styles.adventureTitle, { color: theme.ink }]}>{adventure.title}</Text>
              <Text style={[styles.adventureDetail, { color: theme.inkSoft }]}>{adventure.detail}</Text>
              {(() => {
                const mine = mySide === 'b' ? adventure.partnerBDone : adventure.partnerADone;
                const partnerDone = mySide === 'b' ? adventure.partnerADone : adventure.partnerBDone;
                const mineEntry = mySide === 'b' ? adventure.partnerBEntry : adventure.partnerAEntry;
                const partnerEntry = mySide === 'b' ? adventure.partnerAEntry : adventure.partnerBEntry;
                return (
                  <AdventureStage
                    kind={adventure.kind}
                    mineDone={mine}
                    mineEntry={mineEntry}
                    partnerDone={partnerDone}
                    partnerEntry={partnerEntry}
                    partnerName={mode === 'demo' ? (mySide === 'a' ? 'Theo' : 'Mara') : 'Your partner'}
                    myLabel={mode === 'demo' ? (mySide === 'a' ? 'Mara' : 'Theo') : 'You'}
                    entry={adventureEntry}
                    onEntryChange={setAdventureEntry}
                    onSubmit={(entry) => saveAdventure(entry ?? adventureEntry)}
                    busy={adventureBusy}
                    canSubmit={adventureEntry.trim().length > 0}
                    theme={theme}
                    reducedMotion={reducedMotion}
                  />
                );
              })()}
            </View>
          )}

          <View style={{ marginTop: spacing.xl }}>
            <SectionLabel theme={theme}>Recent letters</SectionLabel>
            {history.length === 0 ? (
              <Text style={[styles.emptyHistory, { color: theme.inkFaint, fontFamily: FONT_EDITORIAL, fontSize: 16 }]}>
                Your shared story starts with today&apos;s letter.
              </Text>
            ) : (
              history.slice(0, 10).map((h) => (
                <View key={h.letterId} style={[styles.historyRow, { borderBottomColor: theme.lineSoft }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.historyQuestion, { color: theme.ink }]} numberOfLines={1}>
                      {h.question.text}
                    </Text>
                    <Text style={[styles.historyDate, { color: theme.inkFaint }]}>
                      {new Date(h.date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <Pill tone={h.bothReplied ? 'mint' : 'gold'} theme={theme}>
                    {h.bothReplied ? 'Revealed' : 'Waiting'}
                  </Pill>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  eyebrow: {
    fontSize: 11.5,
    letterSpacing: 2,
    fontFamily: FONT_MEDIUM,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: { fontFamily: FONT_HEAD, fontSize: 32, lineHeight: 40 },
  letterStage: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    shadowColor: '#151D32',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  envelopeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.md },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap', justifyContent: 'center' },
  sealHint: { fontFamily: FONT_BODY, fontSize: 11.5, fontStyle: 'italic' },
  question: {
    fontFamily: FONT_HEAD,
    fontSize: 22,
    lineHeight: 30,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  draftInput: {
    borderWidth: 1,
    borderRadius: radii.sm,
    minHeight: 130,
    padding: spacing.lg,
    fontSize: 15.5,
    fontFamily: FONT_MEDIUM,
    textAlignVertical: 'top',
    lineHeight: 24,
    alignSelf: 'stretch',
  },
  answeredBox: { borderRadius: radii.sm, padding: spacing.lg, borderWidth: 1, alignSelf: 'stretch' },
  answeredLabel: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontFamily: FONT_BOLD,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  myAnswer: { fontFamily: FONT_BODY, fontSize: 15, lineHeight: 23 },
  revealCard: { marginBottom: spacing.lg },
  partnerName: { marginBottom: spacing.sm },
  partnerAnswer: { fontFamily: FONT_BODY, fontSize: 16, lineHeight: 25 },
  waitingCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  waitingTitle: { fontFamily: FONT_HEAD, fontSize: 19 },
  waitingText: { fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 22, textAlign: 'center' },
  demoHint: { textAlign: 'center', marginTop: 2 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  historyQuestion: { fontFamily: FONT_MEDIUM, fontSize: 14.5 },
  historyDate: { fontFamily: FONT_BODY, fontSize: 12, marginTop: 2 },
  emptyHistory: {},
  adventureCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  adventureHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  adventureTitle: { fontFamily: FONT_HEAD, fontSize: 20, lineHeight: 27 },
  adventureDetail: { fontFamily: FONT_BODY, fontSize: 14, lineHeight: 21 },
});
