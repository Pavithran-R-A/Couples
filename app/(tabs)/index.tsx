import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useApp } from '@/providers/AppProvider';
import { colors, spacing, radii } from '@/theme/tokens';
import { Card, SectionLabel, Button, ErrorNote, Pill, EmptyState } from '@/theme/ui';
import { FONT_HEAD, FONT_BODY, FONT_HEAD_ITALIC, FONT_BOLD, FONT_MEDIUM } from '@/theme/fonts';
import { EngravedDivider, WaxSeal } from '@/components/Ornaments';
import { ReactionRow } from '@/components/ReactionRow';
import type { LetterResponse, Reaction } from '@/domain/types';

export default function LettersTab() {
  const { backend, session, mode } = useApp();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [letter, setLetter] = useState<{ letterId: string; question: { id: string; text: string; category: string } } | null>(null);
  const [myResponse, setMyResponse] = useState<LetterResponse | null>(null);
  const [partnerResponse, setPartnerResponse] = useState<LetterResponse | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<Array<{ letterId: string; question: { text: string }; date: string; bothReplied: boolean }>>([]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      setError('');
      try {
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
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load today\u2019s letter');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [backend]
  );

  useEffect(() => {
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

  const react = async (kind: 'heart' | 'smile' | 'spark') => {
    if (!letter || !partnerResponse) return;
    try {
      await backend.reactToResponse(partnerResponse.id, kind);
      setReactions(await backend.getReactions(letter.letterId));
    } catch {
      setError('Could not send that reaction');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.oxide} />
      </View>
    );
  }

  const bothReplied = Boolean(myResponse && partnerResponse);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.oxide} />}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
            <Text style={styles.title}>Today&apos;s letter</Text>
          </View>
          <WaxSeal />
        </View>

        <ErrorNote>{error}</ErrorNote>

        {!letter ? (
          <Card>
            <EmptyState title="No letter yet" subtitle="Letters begin once you and your partner have paired." />
            <Button label="Go to pairing" variant="ghost" onPress={() => router.push('/pairing')} />
          </Card>
        ) : (
          <Card style={styles.letterCard}>
            <SectionLabel color={colors.oxide}>Question of the day</SectionLabel>
            <Text style={styles.question}>{letter.question.text}</Text>
            <Pill tone="brass">{letter.question.category}</Pill>
            <View style={{ marginTop: spacing.lg }}>
              {myResponse ? (
                <View style={styles.answeredBox}>
                  <Text style={styles.answeredLabel}>Your answer, sealed</Text>
                  <Text style={styles.myAnswer}>{myResponse.body}</Text>
                </View>
              ) : (
                <>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Write quietly, only you can see this until you both answer..."
                    placeholderTextColor={colors.inkFaint}
                    multiline
                    style={styles.draftInput}
                  />
                  <Button label="Seal and send" onPress={submit} loading={submitting} disabled={!draft.trim()} style={{ marginTop: spacing.md }} />
                </>
              )}
            </View>
          </Card>
        )}

        {bothReplied && partnerResponse && (
          <Card style={styles.revealCard}>
            <SectionLabel color={colors.oxide}>Revealed</SectionLabel>
            <Text style={styles.partnerName}>{mode === 'demo' ? 'Theo' : 'Your partner'} wrote</Text>
            <Text style={styles.partnerAnswer}>{partnerResponse.body}</Text>
            <EngravedDivider />
            <ReactionRow
              onReact={react}
              activeKind={reactions.find((r) => r.responseId === partnerResponse.id)?.kind ?? null}
            />
          </Card>
        )}

        {myResponse && !partnerResponse && (
          <Card>
            <Text style={styles.waitingTitle}>Sealed and waiting.</Text>
            <Text style={styles.waitingText}>
              Your answer is tucked away. The envelope opens only when you have both written.
            </Text>
          </Card>
        )}

        {!myResponse && partnerResponse && (
          <Card>
            <Text style={styles.waitingTitle}>A surprise waits.</Text>
            <Text style={styles.waitingText}>
              Something is already sealed in today&apos;s envelope. Write your answer to open it.
            </Text>
          </Card>
        )}

        <View style={{ marginTop: spacing.xl }}>
          <SectionLabel>Recent letters</SectionLabel>
          {history.length === 0 ? (
            <Text style={styles.emptyHistory}>Your shared story starts with today&apos;s letter.</Text>
          ) : (
            history.slice(0, 10).map((h) => (
              <Pressable key={h.letterId} style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyQuestion} numberOfLines={1}>{h.question.text}</Text>
                  <Text style={styles.historyDate}>
                    {new Date(h.date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <Pill tone={h.bothReplied ? 'sage' : 'brass'}>{h.bothReplied ? 'Revealed' : 'Waiting'}</Pill>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.parchment },
  content: { padding: spacing.xl, paddingTop: 72, paddingBottom: 48 },
  center: { flex: 1, backgroundColor: colors.parchment, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl },
  eyebrow: { fontSize: 11.5, letterSpacing: 2, color: colors.inkFaint, fontFamily: FONT_BODY, textTransform: 'uppercase', marginBottom: 6 },
  title: { fontFamily: FONT_HEAD, fontSize: 32, color: colors.ink },
  letterCard: { marginBottom: spacing.lg },
  question: { fontFamily: FONT_HEAD, fontSize: 22, color: colors.ink, lineHeight: 30, marginBottom: spacing.md },
  draftInput: {
    backgroundColor: colors.parchment,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    minHeight: 130,
    padding: spacing.lg,
    fontSize: 15.5,
    fontFamily: FONT_MEDIUM,
    color: colors.ink,
    textAlignVertical: 'top',
    lineHeight: 24,
  },
  answeredBox: { backgroundColor: colors.parchment, borderRadius: radii.sm, padding: spacing.lg, borderWidth: 1, borderColor: colors.line },
  answeredLabel: { fontSize: 11, letterSpacing: 1.5, color: colors.brass, fontFamily: FONT_BOLD, textTransform: 'uppercase', marginBottom: 8 },
  myAnswer: { fontFamily: FONT_BODY, fontSize: 15, color: colors.ink, lineHeight: 23 },
  revealCard: { marginBottom: spacing.lg, borderColor: colors.brass },
  partnerName: { fontFamily: FONT_HEAD_ITALIC, fontSize: 15, color: colors.inkFaint, marginBottom: spacing.sm },
  partnerAnswer: { fontFamily: FONT_BODY, fontSize: 16, color: colors.ink, lineHeight: 25 },
  waitingTitle: { fontFamily: FONT_HEAD, fontSize: 19, color: colors.ink, marginBottom: 8 },
  waitingText: { fontFamily: FONT_BODY, fontSize: 14.5, color: colors.inkSoft, lineHeight: 22 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    gap: spacing.md,
  },
  historyQuestion: { fontFamily: FONT_MEDIUM, fontSize: 14.5, color: colors.ink },
  historyDate: { fontFamily: FONT_BODY, fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  emptyHistory: { fontFamily: FONT_HEAD_ITALIC, fontSize: 14, color: colors.inkFaint },
});
