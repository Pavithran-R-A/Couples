import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useApp } from '@/providers/AppProvider';
import { Card, SectionLabel, Button, ErrorNote } from '@/theme/ui';
import { colors, spacing } from '@/theme/tokens';
import { FONT_HEAD, FONT_BODY, FONT_HEAD_ITALIC, FONT_BOLD } from '@/theme/fonts';

export default function Pairing() {
  const { backend, refreshSession } = useApp();
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

  const copyCode = () => {
    if (!invitation) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>Pairing</Text>
        <Text style={styles.title}>Find your other half.</Text>
        <Text style={styles.tagline}>One of you creates an invitation. The other enters the code.</Text>

        <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
          <ErrorNote>{error}</ErrorNote>

          <Card>
            <SectionLabel>Create an invitation</SectionLabel>
            {invitation ? (
              <>
                <Text style={styles.codeLabel}>Share this code with your partner</Text>
                <Text style={styles.code}>{invitation.code}</Text>
                <Button label={copied ? 'Copied to your heart' : 'I shared it'} variant="quiet" onPress={copyCode} />
                <Text style={styles.expires}>
                  Valid for 7 days, single use only.
                </Text>
              </>
            ) : (
              <Button label="Generate my invitation" onPress={loadInvitation} loading={busy} />
            )}
          </Card>

          <Card>
            <SectionLabel>Join with a code</SectionLabel>
            <TextInput
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="ENTER CODE"
              autoCapitalize="characters"
              maxLength={6}
              style={styles.codeInput}
              placeholderTextColor={colors.inkFaint}
            />
            <Button label="Join my partner" onPress={join} disabled={code.length < 6} loading={busy} style={{ marginTop: spacing.md }} />
          </Card>

          <Button label="Pair later" variant="quiet" onPress={skip} />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.parchment },
  content: { padding: spacing.xl, paddingTop: 96, paddingBottom: 64 },
  eyebrow: { fontSize: 12, letterSpacing: 2.5, color: colors.oxide, fontFamily: FONT_BODY, marginBottom: spacing.md, textTransform: 'uppercase' },
  title: { fontFamily: FONT_HEAD, fontSize: 34, color: colors.ink, lineHeight: 42, marginBottom: spacing.sm },
  tagline: { fontFamily: FONT_HEAD_ITALIC, fontSize: 15.5, color: colors.inkFaint, lineHeight: 22 },
  codeLabel: { fontFamily: FONT_BODY, fontSize: 13.5, color: colors.inkSoft, marginBottom: spacing.sm },
  code: { fontFamily: FONT_HEAD, fontSize: 38, letterSpacing: 8, color: colors.oxide, marginBottom: spacing.md },
  expires: { fontFamily: FONT_BODY, fontSize: 12, color: colors.inkFaint, marginTop: spacing.md, textAlign: 'center' },
  codeInput: {
    backgroundColor: colors.parchment,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: spacing.lg,
    fontSize: 26,
    letterSpacing: 8,
    textAlign: 'center',
    fontFamily: FONT_BOLD,
    color: colors.ink,
  },
});
