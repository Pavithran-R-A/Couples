import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useApp } from '@/providers/AppProvider';
import { Card, SectionLabel, Button, Input, ErrorNote } from '@/theme/ui';
import { colors, spacing } from '@/theme/tokens';
import { FONT_HEAD, FONT_BODY, FONT_HEAD_ITALIC } from '@/theme/fonts';

export default function Onboarding() {
  const { backend, mode, demo, refreshSession, backendNotice } = useApp();
  const router = useRouter();
  const [tab, setTab] = useState<'welcome' | 'signin' | 'signup' | 'reset'>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    await refreshSession();
    router.replace('/pairing');
  };

  const startDemo = async () => {
    setBusy(true);
    setError('');
    try {
      await demo.seedDemoCouple();
      await demo.signInAsPartner('a');
      await refreshSession();
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the demo');
      setBusy(false);
    }
  };

  const submitAuth = async () => {
    setBusy(true);
    setError('');
    try {
      if (tab === 'signup') {
        if (!email.includes('@')) throw new Error('Please enter a valid email address');
        if (password.length < 8) throw new Error('Password needs at least 8 characters');
        if (!displayName.trim()) throw new Error('Please add the name your partner will see');
        await backend.signUp(email.trim(), password, displayName.trim());
        await finish();
      } else if (tab === 'reset') {
        await backend.requestPasswordReset(email.trim());
        setError('If that email is registered, a reset link is on its way.');
      } else {
        await backend.signIn(email.trim(), password);
        router.replace('/(tabs)');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {backendNotice ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>{backendNotice}</Text>
          </View>
        ) : null}
        <Text style={styles.eyebrow}>Project Two</Text>
        {tab === 'welcome' ? (
          <>
            <Text style={styles.title}>Two people.{'\n'}One daily letter.</Text>
            <Text style={styles.tagline}>Answer separately, discover together.</Text>
            <View style={{ gap: spacing.md, marginTop: spacing.xxl }}>
              <Button label="Create your space" onPress={() => setTab('signup')} />
              <Button label="I already have an account" variant="quiet" onPress={() => setTab('signin')} />
            </View>
            <View style={{ marginTop: spacing.xxl }}>
              <Card>
                <SectionLabel>Try the demonstration</SectionLabel>
                <Text style={styles.demoText}>
                  Explore the full experience as Mara and Theo, a fictional couple with sample letters,
                  memories and their own companion. Nothing here is real customer data.
                </Text>
                <Button label="Enter the demo" variant="ghost" onPress={startDemo} loading={busy} style={{ marginTop: spacing.md }} />
              </Card>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.title}>{tab === 'signup' ? 'Begin together' : tab === 'reset' ? 'Reset your password' : 'Welcome back'}</Text>
            <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
              <ErrorNote>{error}</ErrorNote>
              {tab === 'signup' && (
                <Input value={displayName} onChangeText={setDisplayName} placeholder="Your first name" autoCapitalize="words" />
              )}
              <Input value={email} onChangeText={setEmail} placeholder="Email address" keyboardType="email-address" />
              {tab !== 'reset' && <Input value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />}
              <Button
                label={tab === 'signup' ? 'Create account' : tab === 'reset' ? 'Send reset link' : 'Sign in'}
                onPress={submitAuth}
                loading={busy}
                disabled={!email || (tab !== 'reset' && !password)}
              />
              {tab === 'signin' && (
                <Button label="Forgot your password?" variant="quiet" onPress={() => { setTab('reset'); setError(''); }} />
              )}
              {tab !== 'reset' && <Button
                label={tab === 'signup' ? 'I have an account' : 'New here? Create an account'}
                variant="quiet"
                onPress={() => setTab(tab === 'signup' ? 'signin' : 'signup')}
              />}
              <Button label="Back" variant="quiet" onPress={() => { setTab('welcome'); setError(''); }} />
            </View>
            {mode === 'demo' && (
              <Text style={styles.demoNote}>Demonstration mode — accounts live only on this device.</Text>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.parchment },
  content: { padding: spacing.xl, paddingTop: 96, paddingBottom: 64 },
  noticeBox: {
    backgroundColor: colors.brassMist,
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
  },
  noticeText: { fontFamily: FONT_BODY, fontSize: 13.5, color: colors.ink, lineHeight: 20 },
  eyebrow: { fontSize: 12, letterSpacing: 2.5, color: colors.oxide, fontFamily: FONT_BODY, marginBottom: spacing.md, textTransform: 'uppercase' },
  title: { fontFamily: FONT_HEAD, fontSize: 36, color: colors.ink, lineHeight: 44, marginBottom: spacing.sm },
  tagline: { fontFamily: FONT_HEAD_ITALIC, fontSize: 16, color: colors.inkFaint },
  demoText: { fontFamily: FONT_BODY, fontSize: 14, color: colors.inkSoft, lineHeight: 21 },
  demoNote: { fontFamily: FONT_BODY, fontSize: 12.5, color: colors.inkFaint, textAlign: 'center', marginTop: spacing.xl },
});
