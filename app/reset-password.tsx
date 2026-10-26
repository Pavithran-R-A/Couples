import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/providers/AppProvider';
import { Button, Input, ErrorNote, Card, SectionLabel, useTheme } from '@/theme/ui';
import { spacing } from '@/theme/tokens';
import { FONT_HEAD, FONT_BODY, FONT_EDITORIAL } from '@/theme/fonts';
import { WaxSeal, EngravedDivider } from '@/components/Ornaments';
import { parseRecoveryLink } from '@/services/recoveryLink';

type Phase = 'checking' | 'ready' | 'invalid';

export default function ResetPassword() {
  const { production, applyRecoveryTokens } = useApp();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const url = Linking.useURL();
  const [phase, setPhase] = useState<Phase>('checking');
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (phase !== 'checking') return;
    const parsed = parseRecoveryLink(url);
    if (parsed.kind === 'none') return;
    let cancelled = false;
    const run = async () => {
      // Every state transition below happens after an await, so the effect
      // never sets state synchronously during commit.
      await Promise.resolve();
      if (cancelled) return;
      if (parsed.kind === 'error') {
        setReason(parsed.message);
        setPhase('invalid');
        return;
      }
      if (!production) {
        setReason('This device has no connected Project Two account service.');
        setPhase('invalid');
        return;
      }
      try {
        await applyRecoveryTokens(parsed.accessToken, parsed.refreshToken);
        if (!cancelled) setPhase('ready');
      } catch (e) {
        if (!cancelled) {
          setReason(e instanceof Error ? e.message : 'That recovery link could not be opened.');
          setPhase('invalid');
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [url, phase, production, applyRecoveryTokens]);

  // Never leave the user on "unsealing your link" forever: if no recovery
  // payload arrives (manual navigation, dropped link), offer a way back. A
  // present link owns the flow — its exchange may legitimately take longer.
  useEffect(() => {
    if (phase !== 'checking') return;
    if (parseRecoveryLink(url).kind !== 'none') return;
    const timer = setTimeout(() => {
      setReason('No recovery link was detected. Request a fresh one from the sign-in screen.');
      setPhase('invalid');
    }, 6000);
    return () => clearTimeout(timer);
  }, [phase, url]);

  const submit = async () => {
    setError('');
    if (!production) return;
    if (password.length < 8) {
      setError('Password needs at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await production.updatePassword(password);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not set the new password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 44 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: theme.inkFaint }]}>Recovery</Text>
            <Text style={[styles.title, { color: theme.ink }]}>A new key for your space.</Text>
          </View>
          <WaxSeal size={62} />
        </View>

        <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
          {phase === 'checking' && (
            <Card theme={theme}>
              <SectionLabel theme={theme}>Unsealing your link</SectionLabel>
              <Text style={[styles.body, { color: theme.inkSoft }]}>
                One moment — the recovery link is opening…
              </Text>
            </Card>
          )}

          {phase === 'invalid' && (
            <Card theme={theme}>
              <SectionLabel theme={theme} color={theme.coral}>
                Link not usable
              </SectionLabel>
              <Text style={[styles.body, { color: theme.inkSoft }]}>{reason}</Text>
              <EngravedDivider width={180} />
              <Button label="Back to sign in" onPress={() => router.replace('/onboarding')} theme={theme} />
            </Card>
          )}

          {phase === 'ready' && !done && (
            <Card theme={theme}>
              <SectionLabel theme={theme}>Choose a new password</SectionLabel>
              <Input value={password} onChangeText={setPassword} placeholder="New password" secureTextEntry theme={theme} />
              <Input value={confirm} onChangeText={setConfirm} placeholder="Repeat the new password" secureTextEntry theme={theme} />
              <ErrorNote theme={theme}>{error}</ErrorNote>
              <Button label="Set the new password" onPress={submit} loading={busy} theme={theme} style={{ marginTop: spacing.sm }} />
            </Card>
          )}

          {done && (
            <Card theme={theme}>
              <SectionLabel theme={theme}>Sealed</SectionLabel>
              <Text style={[styles.body, { color: theme.inkSoft }]}>
                Your new password is set. Your letters are exactly where you left them.
              </Text>
              <Button label="Go to our space" onPress={() => router.replace('/(tabs)')} theme={theme} style={{ marginTop: spacing.sm }} />
            </Card>
          )}

          {phase !== 'invalid' && (
            <Button label="Start over" variant="quiet" onPress={() => router.replace('/onboarding')} theme={theme} />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xl },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  eyebrow: { fontFamily: FONT_BODY, fontSize: 13, letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontFamily: FONT_HEAD, fontSize: 30, marginTop: 4 },
  body: { fontFamily: FONT_EDITORIAL, fontSize: 15.5, lineHeight: 23, marginTop: spacing.sm },
});
