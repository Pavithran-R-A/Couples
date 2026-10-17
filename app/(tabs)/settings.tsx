import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useApp } from '@/providers/AppProvider';
import { spacing, radii, type ThemeMode } from '@/theme/tokens';
import { Card, SectionLabel, Button, ErrorNote, useTheme } from '@/theme/ui';
import { FONT_HEAD, FONT_BODY, FONT_BOLD, FONT_MEDIUM, FONT_EDITORIAL } from '@/theme/fonts';
import { KeepsakeStamp, Constellation } from '@/components/Illustrations';

export default function SettingsTab() {
  const { backend, demo, session, mode, refreshSession, themeMode, setThemeMode, reducedMotion, setReducedMotion } = useApp();
  const theme = useTheme();
  const router = useRouter();
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data load on mount
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
      await backend.exportData();
      Alert.alert('Your data', 'A copy of your data has been prepared as JSON. In the packaged app this saves a file to your device.', [
        { text: 'OK' },
      ]);
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
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={[styles.eyebrow, { color: theme.inkFaint }]}>Settings</Text>
          <Text style={[styles.title, { color: theme.ink }]}>Your space, your rules.</Text>

          <ErrorNote theme={theme}>{error}</ErrorNote>

          <Card theme={theme} style={{ marginBottom: spacing.lg }}>
            <SectionLabel theme={theme}>Account</SectionLabel>
            <Text style={[styles.value, { color: theme.ink }]}>{profile?.displayName ?? 'Signed in'}</Text>
            <Text style={[styles.sub, { color: theme.inkFaint }]}>{session?.email}</Text>
            <View style={{ marginTop: spacing.md }}>
              <Button label="Sign out" variant="quiet" onPress={signOut} loading={busy} theme={theme} />
            </View>
          </Card>

          <Card theme={theme} style={{ marginBottom: spacing.lg }}>
            <SectionLabel theme={theme}>Couple</SectionLabel>
            <Text style={[styles.value, { color: theme.ink }]}>{partner ? `Paired with ${partner}` : 'Not paired yet'}</Text>
            {stats && (
              <Text style={[styles.sub, { color: theme.inkFaint }]}>
                {stats.lettersCompleted} letters completed · {stats.memoriesCount} keepsakes
                {stats.daysTogether > 0 ? ` · ${stats.daysTogether} days together` : ''}
              </Text>
            )}
            {partner && (
              <View style={{ marginTop: spacing.md }}>
                <Button label="Unlink from partner" variant="quiet" onPress={unlink} theme={theme} />
              </View>
            )}
          </Card>

          <Card theme={theme} style={{ marginBottom: spacing.lg }}>
            <SectionLabel theme={theme}>Atmosphere</SectionLabel>
            <Text style={[styles.themeHint, { color: theme.inkFaint }]}>Choose how your evenings feel.</Text>
            <View style={styles.themeRow}>
              {(['daylight', 'moonlit'] as ThemeMode[]).map((m) => {
                const active = themeMode === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setThemeMode(m)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.themeCard,
                      {
                        backgroundColor: active ? theme.accentSoft : theme.surfaceSoft,
                        borderColor: active ? theme.accent : theme.line,
                      },
                    ]}
                  >
                    {m === 'daylight' ? (
                      <KeepsakeStamp size={34} tone={theme.coral} glyph="flower" />
                    ) : (
                      <Constellation size={44} variant={0} color={theme.gold} />
                    )}
                    <Text style={[styles.themeLabel, { color: active ? theme.accent : theme.inkSoft }]}>
                      {m === 'daylight' ? 'Warm Daylight' : 'Moonlit Garden'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={[styles.switchRow, { borderBottomColor: theme.lineSoft }]}>
              <Text style={[styles.switchLabel, { color: theme.ink }]}>Reduced motion</Text>
              <Switch
                value={reducedMotion}
                onValueChange={setReducedMotion}
                trackColor={{ true: theme.accent, false: theme.line }}
                thumbColor={reducedMotion ? theme.surfaceRaised : theme.surface}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: theme.ink }]}>Gentle daily reminders</Text>
              <Switch
                value={reminders}
                onValueChange={setReminders}
                trackColor={{ true: theme.accent, false: theme.line }}
                thumbColor={reminders ? theme.surfaceRaised : theme.surface}
              />
            </View>
            <Text style={[styles.note, { color: theme.inkFaint }]}>
              {reminders
                ? 'One quiet nudge a day, at a fixed evening hour. Nothing else, ever.'
                : 'Reminders are off. The letter waits for you whenever you come.'}
            </Text>
          </Card>

          <Card theme={theme} style={{ marginBottom: spacing.lg }}>
            <SectionLabel theme={theme}>Your data</SectionLabel>
            <View style={{ gap: spacing.md }}>
              <Button label="Export everything" variant="quiet" onPress={exportData} theme={theme} />
              <Button label="Delete my account" variant="quiet" onPress={deleteAccount} theme={theme} />
            </View>
            <Text style={[styles.note, { color: theme.inkFaint }]}>
              Export gives you a machine-readable copy. Deletion is permanent and complete.
            </Text>
          </Card>

          {mode === 'demo' && (
            <Card theme={theme} tone="soft" style={{ marginBottom: spacing.lg, borderColor: theme.gold }}>
              <SectionLabel theme={theme} color={theme.gold}>
                Demonstration tour
              </SectionLabel>
              <Text style={[styles.note, { color: theme.inkSoft }]}>
                Everything you see is a fictional world for Mara and Theo — no accounts, no real data.
                You can leave the tour whenever you like.
              </Text>
              <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                <Button label="Exit tour — create a real account" onPress={() => router.replace('/onboarding')} theme={theme} />
                <Button label="Reset the tour to its beginning" variant="ghost" onPress={resetDemo} theme={theme} />
              </View>
            </Card>
          )}

          <Text style={[styles.footer, { color: theme.inkFaint, fontFamily: FONT_EDITORIAL, fontSize: 14.5 }]}>
            Project Two · Midnight Postcards
          </Text>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: spacing.xl, paddingTop: 68, paddingBottom: 48 },
  eyebrow: {
    fontSize: 11.5,
    letterSpacing: 2,
    fontFamily: FONT_MEDIUM,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: { fontFamily: FONT_HEAD, fontSize: 30, lineHeight: 38, marginBottom: spacing.xl },
  value: { fontFamily: FONT_HEAD, fontSize: 19 },
  sub: { fontFamily: FONT_BODY, fontSize: 13.5, marginTop: 4 },
  themeHint: { fontFamily: FONT_BODY, fontSize: 13, marginBottom: spacing.md },
  themeRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  themeCard: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1.5,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 8,
    minHeight: 96,
    justifyContent: 'center',
  },
  themeLabel: { fontFamily: FONT_BOLD, fontSize: 13.5 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  switchLabel: { fontFamily: FONT_MEDIUM, fontSize: 15 },
  note: { fontFamily: FONT_BODY, fontSize: 12.5, lineHeight: 19, marginTop: spacing.sm },
  footer: { textAlign: 'center', marginTop: spacing.xl },
});
