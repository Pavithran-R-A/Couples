import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Switch, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useApp } from '@/providers/AppProvider';
import { colors, spacing, radii } from '@/theme/tokens';
import { Card, SectionLabel, Button, ErrorNote } from '@/theme/ui';
import { FONT_HEAD, FONT_BODY, FONT_BOLD, FONT_MEDIUM } from '@/theme/fonts';

export default function SettingsTab() {
  const { backend, demo, session, mode, refreshSession } = useApp();
  const router = useRouter();
  const [reducedMotion, setReducedMotion] = useState(false);
  const [reminders, setReminders] = useState(true);
  const [profile, setProfile] = useState<{ displayName: string; email: string } | null>(null);
  const [partner, setPartner] = useState<string | null>(null);
  const [stats, setStats] = useState<{ lettersCompleted: number; memoriesCount: number; daysTogether: number } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const me = await backend.getMyProfile();
      const p = await backend.getPartnerProfile();
      setProfile(me ? { displayName: me.displayName, email: me.email } : null);
      setPartner(p?.displayName ?? null);
      setStats(await backend.getStats());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load settings');
    }
  }, [backend]);

  useEffect(() => {
    load();
  }, [load]);

  const signOut = async () => {
    setBusy(true);
    try {
      await backend.signOut();
      await refreshSession();
      router.replace('/onboarding');
    } catch {
      setError('Could not sign out. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const unlink = () => {
    Alert.alert(
      'Unlink from your partner',
      'Your letters, memories and companion will stay with each of you, but the connection ends. This cannot be undone from here.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            try {
              await backend.unlinkPartner();
              await refreshSession();
              router.replace('/pairing');
            } catch {
              setError('Could not unlink right now');
            }
          },
        },
      ]
    );
  };

  const exportData = async () => {
    try {
      const data = await backend.exportData();
      Alert.alert('Your data', 'A copy of your data has been prepared as JSON. In the packaged app this saves a file to your device.', [
        { text: 'OK' },
      ]);
      return data;
    } catch {
      setError('Could not export your data right now');
    }
  };

  const deleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This permanently removes your account, your letters, memories and companion. There is no way back.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await backend.deleteAccount();
              await refreshSession();
              router.replace('/onboarding');
            } catch {
              setError('Could not delete your account right now');
            }
          },
        },
      ]
    );
  };

  const resetDemo = async () => {
    await demo.resetDemo();
    await refreshSession();
    router.replace('/onboarding');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Settings</Text>
        <Text style={styles.title}>Your space, your rules.</Text>

        <ErrorNote>{error}</ErrorNote>

        <Card style={{ marginBottom: spacing.lg }}>
          <SectionLabel>Account</SectionLabel>
          <Text style={styles.value}>{profile?.displayName ?? 'Signed in'}</Text>
          <Text style={styles.sub}>{session?.email}</Text>
          <View style={{ marginTop: spacing.md }}>
            <Button label="Sign out" variant="quiet" onPress={signOut} loading={busy} />
          </View>
        </Card>

        <Card style={{ marginBottom: spacing.lg }}>
          <SectionLabel>Couple</SectionLabel>
          <Text style={styles.value}>{partner ? `Paired with ${partner}` : 'Not paired yet'}</Text>
          {stats && (
            <Text style={styles.sub}>
              {stats.lettersCompleted} letters completed · {stats.memoriesCount} keepsakes
              {stats.daysTogether > 0 ? ` · ${stats.daysTogether} days together` : ''}
            </Text>
          )}
          {partner && (
            <View style={{ marginTop: spacing.md }}>
              <Button label="Unlink from partner" variant="quiet" onPress={unlink} />
            </View>
          )}
        </Card>

        <Card style={{ marginBottom: spacing.lg }}>
          <SectionLabel>Comfort</SectionLabel>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Reduced motion</Text>
            <Switch value={reducedMotion} onValueChange={setReducedMotion} trackColor={{ true: colors.sage, false: colors.line }} />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Gentle daily reminders</Text>
            <Switch value={reminders} onValueChange={setReminders} trackColor={{ true: colors.sage, false: colors.line }} />
          </View>
          <Text style={styles.note}>
            {reminders
              ? 'One quiet nudge a day, at a fixed evening hour. Nothing else, ever.'
              : 'Reminders are off. The letter waits for you whenever you come.'}
          </Text>
        </Card>

        <Card style={{ marginBottom: spacing.lg }}>
          <SectionLabel>Your data</SectionLabel>
          <View style={{ gap: spacing.md }}>
            <Button label="Export everything" variant="quiet" onPress={exportData} />
            <Button label="Delete my account" variant="quiet" onPress={deleteAccount} />
          </View>
          <Text style={styles.note}>Export gives you a machine-readable copy. Deletion is permanent and complete.</Text>
        </Card>

        {mode === 'demo' && (
          <Card style={{ marginBottom: spacing.lg, borderColor: colors.brass }}>
            <SectionLabel color={colors.brass}>Demonstration mode</SectionLabel>
            <Text style={styles.note}>You are exploring Project Two with fictional partners and synthetic data.</Text>
            <View style={{ marginTop: spacing.md }}>
              <Button label="Reset demo data" variant="ghost" onPress={resetDemo} />
            </View>
          </Card>
        )}

        <Text style={styles.footer}>Project Two · Afterlight Atelier edition</Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.parchment },
  content: { padding: spacing.xl, paddingTop: 72, paddingBottom: 48 },
  eyebrow: { fontSize: 11.5, letterSpacing: 2, color: colors.inkFaint, fontFamily: FONT_BODY, textTransform: 'uppercase', marginBottom: 6 },
  title: { fontFamily: FONT_HEAD, fontSize: 30, color: colors.ink, marginBottom: spacing.xl },
  value: { fontFamily: FONT_HEAD, fontSize: 19, color: colors.ink },
  sub: { fontFamily: FONT_BODY, fontSize: 13.5, color: colors.inkFaint, marginTop: 4 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  switchLabel: { fontFamily: FONT_MEDIUM, fontSize: 15, color: colors.ink },
  note: { fontFamily: FONT_BODY, fontSize: 12.5, color: colors.inkFaint, lineHeight: 19, marginTop: spacing.sm },
  footer: { fontFamily: FONT_BODY, fontSize: 12, color: colors.inkFaint, textAlign: 'center', marginTop: spacing.xl },
});
