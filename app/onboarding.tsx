import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Dimensions,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useApp } from '@/providers/AppProvider';
import { Button, Input, ErrorNote, useTheme } from '@/theme/ui';
import { spacing, radii } from '@/theme/tokens';
import {
  FONT_HEAD,
  FONT_HEAD_LIGHT,
  FONT_BODY,
  FONT_MEDIUM,
  FONT_BOLD,
  FONT_EDITORIAL,
} from '@/theme/fonts';
import { CelestialGarden, EnvelopeArt, Constellation, KeepsakeStamp, FlowerSprig } from '@/components/Illustrations';

const INTRO_LINES = [
  'A little world for just you two.',
  'Small moments become beautiful memories.',
  'Some letters are worth opening together.',
];

export default function Onboarding() {
  const { backend, mode, demo, refreshSession, backendNotice, reducedMotion } = useApp();
  const theme = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<'welcome' | 'signin' | 'signup' | 'reset'>('welcome');
  const [introStep, setIntroStep] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const { width: screenW } = Dimensions.get('window');
  const heroH = Math.min(300, Math.max(230, screenW * 0.62));

  // Gentle auto-advance of the skippable poetic intro.
  useEffect(() => {
    if (tab !== 'welcome' || reducedMotion) return;
    const t = setTimeout(() => setIntroStep((s) => (s + 1) % INTRO_LINES.length), 3600);
    return () => clearTimeout(t);
  }, [introStep, tab, reducedMotion]);

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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { backgroundColor: theme.bg }]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Cinematic hero */}
        <View style={[styles.hero, { height: heroH }]}>
          <CelestialGarden width={screenW} height={heroH} moonlit={theme.mode === 'moonlit'} />
          <View style={styles.heroOverlay}>
            <Text style={[styles.eyebrow, { color: theme.gold }]}>
              Project Two
            </Text>
            <Text style={[styles.heroTitle, { color: '#FFF8F1' }]}>
              Two people.{'\n'}One daily letter.
            </Text>
            <Constellation size={86} variant={0} color={theme.mode === 'moonlit' ? theme.gold : '#F7DCD5'} />
          </View>
          <View style={styles.heroFlora}>
            <FlowerSprig size={40} color={theme.coral} />
            <FlowerSprig size={30} color={theme.gold} stem="#5E9B85" />
          </View>
        </View>

        <View style={[styles.body, { backgroundColor: theme.bg }]}>
          {backendNotice ? (
            <View style={[styles.noticeBox, { backgroundColor: theme.goldSoft, borderColor: theme.gold }]}>
              <Text style={[styles.noticeText, { color: theme.ink }]}>{backendNotice}</Text>
            </View>
          ) : null}

          {tab === 'welcome' ? (
            <>
              {/* skippable three-part poetic intro */}
              <Pressable
                onPress={() => setIntroStep((s) => (s + 1) % INTRO_LINES.length)}
                style={styles.introBlock}
                accessibilityLabel={INTRO_LINES[introStep]}
              >
                {INTRO_LINES.map((line, i) => (
                  <Text
                    key={line}
                    style={[
                      styles.introLine,
                      { color: i === introStep ? theme.accent : theme.inkFaint, opacity: i === introStep ? 1 : 0.55 },
                      i === introStep && { fontFamily: FONT_EDITORIAL, fontSize: 20 },
                    ]}
                  >
                    {line}
                  </Text>
                ))}
                <View style={styles.introDots}>
                  {INTRO_LINES.map((_, i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: i === introStep ? theme.accent : theme.line }]} />
                  ))}
                </View>
              </Pressable>

              <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
                <Button label="Create your space" onPress={() => setTab('signup')} theme={theme} />
                <Button label="I already have an account" variant="quiet" onPress={() => setTab('signin')} theme={theme} />
              </View>

              {/* demo entry — an invitation, not an info card */}
              <Pressable
                onPress={startDemo}
                disabled={busy}
                style={({ pressed }) => [
                  styles.demoCard,
                  {
                    backgroundColor: theme.mode === 'moonlit' ? theme.accentSoft : '#2C2036',
                    borderColor: theme.accent,
                    opacity: pressed || busy ? 0.92 : 1,
                  },
                ]}
              >
                <View style={styles.demoEnvelope}>
                  <EnvelopeArt size={92} open={false} sealColor={theme.gold} />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[styles.demoTitle, { color: '#FFF8F1' }]}>Step inside first</Text>
                  <Text style={[styles.demoText, { color: '#E9D9E4' }]}>
                    Wander through a finished world as Mara and Theo — letters kept, memories pressed, a small
                    glowing friend waiting. Nothing here is real.
                  </Text>
                  <Text style={[styles.demoCta, { color: theme.gold }]}>
                    {busy ? 'Opening the gate…' : 'Enter the demo →'}
                  </Text>
                </View>
                <View style={styles.demoStamp}>
                  <KeepsakeStamp size={34} glyph="seed" tone={theme.gold} />
                </View>
              </Pressable>

              {mode === 'demo' && (
                <Text style={[styles.demoNote, { color: theme.inkFaint }]}>
                  Demonstration mode — accounts live only on this device.
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={[styles.formTitle, { color: theme.ink }]}>
                {tab === 'signup' ? 'Begin together' : tab === 'reset' ? 'Reset your password' : 'Welcome back'}
              </Text>
              <Text style={[styles.formSub, { color: theme.inkFaint, fontFamily: FONT_EDITORIAL, fontSize: 17 }]}>
                {tab === 'signup'
                  ? 'A shared space, made just for the two of you.'
                  : tab === 'reset'
                    ? 'We will send a quiet link to your inbox.'
                    : 'Your letters have been waiting for you.'}
              </Text>
              <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
                <ErrorNote theme={theme}>{error}</ErrorNote>
                {tab === 'signup' && (
                  <Input value={displayName} onChangeText={setDisplayName} placeholder="Your first name" autoCapitalize="words" theme={theme} />
                )}
                <Input value={email} onChangeText={setEmail} placeholder="Email address" keyboardType="email-address" theme={theme} />
                {tab !== 'reset' && <Input value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry theme={theme} />}
                <Button
                  label={tab === 'signup' ? 'Create account' : tab === 'reset' ? 'Send reset link' : 'Sign in'}
                  onPress={submitAuth}
                  loading={busy}
                  disabled={!email || (tab !== 'reset' && !password)}
                  theme={theme}
                />
                {tab === 'signin' && (
                  <Button
                    label="Forgot your password?"
                    variant="quiet"
                    onPress={() => {
                      setTab('reset');
                      setError('');
                    }}
                    theme={theme}
                  />
                )}
                {tab !== 'reset' && (
                  <Button
                    label={tab === 'signup' ? 'I have an account' : 'New here? Create an account'}
                    variant="quiet"
                    onPress={() => setTab(tab === 'signup' ? 'signin' : 'signup')}
                    theme={theme}
                  />
                )}
                <Button label="Back" variant="quiet" onPress={() => { setTab('welcome'); setError(''); }} theme={theme} />
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
  hero: { width: '100%', overflow: 'hidden' },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 18,
    gap: 10,
  },
  heroTitle: {
    fontFamily: FONT_HEAD,
    fontSize: 34,
    lineHeight: 42,
    textAlign: 'center',
    textShadowColor: 'rgba(21,29,50,0.45)',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 2 },
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 3.2,
    fontFamily: FONT_MEDIUM,
    textTransform: 'uppercase',
  },
  heroFlora: {
    position: 'absolute',
    bottom: -4,
    left: 22,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: -6,
  },
  body: {
    flex: 1,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    marginTop: -radii.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  noticeBox: {
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  noticeText: { fontFamily: FONT_BODY, fontSize: 13.5, lineHeight: 20 },
  introBlock: { alignItems: 'center', paddingVertical: spacing.xl, gap: 6, minHeight: 128, justifyContent: 'center' },
  introLine: { fontFamily: FONT_BODY, fontSize: 15.5, lineHeight: 24, textAlign: 'center' },
  introDots: { flexDirection: 'row', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  demoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.md,
    minHeight: 140,
    shadowColor: '#151D32',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  demoEnvelope: { width: 96, alignItems: 'center' },
  demoTitle: { fontFamily: FONT_HEAD, fontSize: 19 },
  demoText: { fontFamily: FONT_BODY, fontSize: 12.5, lineHeight: 18 },
  demoCta: { fontFamily: FONT_BOLD, fontSize: 13.5, marginTop: 4 },
  demoStamp: { alignSelf: 'flex-start' },
  demoNote: { fontFamily: FONT_BODY, fontSize: 12.5, textAlign: 'center', marginTop: spacing.xl },
  formTitle: { fontFamily: FONT_HEAD, fontSize: 30, lineHeight: 38, marginTop: spacing.md },
  formSub: { marginTop: 4 },
});
