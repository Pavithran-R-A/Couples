import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, Platform, Share } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/providers/AppProvider';
import { Card, SectionLabel, Button, ErrorNote, useTheme } from '@/theme/ui';
import { spacing, radii } from '@/theme/tokens';
import { FONT_HEAD, FONT_BODY, FONT_BOLD, FONT_EDITORIAL } from '@/theme/fonts';
import { EnvelopeArt, Constellation } from '@/components/Illustrations';

export default function Pairing() {
  const insets = useSafeAreaInsets();
  const { backend, refreshSession } = useApp();
  const th = useTheme();
  const router = useRouter();
  const [invitation, setInvitation] = useState<{ code: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadInvitation = async () => {
    setBusy(true);
    setError('');
    try {
      const inv = await backend.getActiveInvitation();
      if (inv) {
        setInvitation(inv);
      } else {
        setInvitation(await backend.createInvitation());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create an invitation');
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    setBusy(true);
    setError('');
    try {
      await backend.joinWithCode(code);
      await refreshSession();
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join with that code');
      setBusy(false);
    }
  };

  const skip = () => {
    Alert.alert(
      'Pair later',
      'You can create or join a couple any time from Settings. Some features stay hidden until you pair.',
      [{ text: 'Keep waiting', style: 'cancel' }, { text: 'Continue solo', onPress: () => router.replace('/(tabs)') }]
    );
  };

  const copyCode = async () => {
    if (!invitation) return;
    try {
      if (Platform.OS === 'web') {
        const clipboard = (
          globalThis as { navigator?: { clipboard?: { writeText: (t: string) => Promise<void> } } }
        ).navigator?.clipboard;
        if (!clipboard) throw new Error('clipboard unavailable');
        await clipboard.writeText(invitation.code);
      } else {
        await Share.share({ message: `Join me on Project Two — your invitation code: ${invitation.code}` });
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // The code stays on screen so it can be read out or typed by hand.
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: th.bg }}>
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 44 }]} keyboardShouldPersistTaps="handled">
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.eyebrow, { color: th.inkFaint }]}>Pairing</Text>
              <Text style={[styles.title, { color: th.ink }]}>Find your other half.</Text>
              <Text style={[styles.tagline, { color: th.inkFaint, fontFamily: FONT_EDITORIAL, fontSize: 17 }]}>
                One of you creates an invitation. The other enters the code.
              </Text>
            </View>
            <EnvelopeArt size={86} open={false} flapColor={th.accent} sealColor={th.coral} bodyColor={th.accentSoft} />
          </View>

          <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
            <ErrorNote theme={th}>{error}</ErrorNote>

            <Card theme={th}>
              <SectionLabel theme={th}>Create an invitation</SectionLabel>
              {invitation ? (
                <>
                  <Text style={[styles.codeLabel, { color: th.inkSoft }]}>Share this code with your partner</Text>
                  <Text style={[styles.code, { color: th.accent }]}>{invitation.code}</Text>
                  <Button label={copied ? 'Copied to your heart' : 'Copy the code'} variant="quiet" onPress={copyCode} theme={th} />
                  <Text style={[styles.expires, { color: th.inkFaint }]}>Valid for 7 days, single use only.</Text>
                </>
              ) : (
                <>
                  <Constellation size={90} variant={2} color={th.gold} />
                  <Button label="Generate my invitation" onPress={loadInvitation} loading={busy} theme={th} style={{ marginTop: spacing.sm }} />
                </>
              )}
            </Card>

            <Card theme={th}>
              <SectionLabel theme={th}>Join with a code</SectionLabel>
              <TextInput
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                placeholder="ENTER CODE"
                autoCapitalize="characters"
                maxLength={6}
                style={[styles.codeInput, { backgroundColor: th.surfaceSoft, borderColor: th.line, color: th.ink }]}
                placeholderTextColor={th.inkFaint}
              />
              <Button label="Join my partner" onPress={join} disabled={code.length < 6} loading={busy} theme={th} style={{ marginTop: spacing.md }} />
            </Card>

            <Button label="Pair later" variant="quiet" onPress={skip} theme={th} />
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: 64 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 2.5,
    fontFamily: FONT_BODY,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
  },
  title: { fontFamily: FONT_HEAD, fontSize: 34, lineHeight: 42, marginBottom: spacing.sm },
  tagline: { lineHeight: 24 },
  codeLabel: { fontFamily: FONT_BODY, fontSize: 13.5, marginBottom: spacing.sm },
  code: { fontFamily: FONT_HEAD, fontSize: 38, letterSpacing: 8, marginBottom: spacing.md },
  expires: { fontFamily: FONT_BODY, fontSize: 12, marginTop: spacing.md, textAlign: 'center' },
  codeInput: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.lg,
    fontSize: 26,
    letterSpacing: 8,
    textAlign: 'center',
    fontFamily: FONT_BOLD,
  },
});
