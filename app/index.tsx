import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/providers/AppProvider';
import { EngravedDivider } from '@/components/Ornaments';
import { SectionLabel, useTheme } from '@/theme/ui';
import { FONT_HEAD, FONT_EDITORIAL } from '@/theme/fonts';
import { Constellation } from '@/components/Illustrations';

export default function Welcome() {
  const { authReady, session, mode } = useApp();
  const theme = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (!authReady) return;
    const t = setTimeout(() => {
      router.replace(session ? '/(tabs)' : '/onboarding');
    }, mode === 'demo' && !session ? 1400 : 0);
    return () => clearTimeout(t);
  }, [authReady, session, mode, router]);

  return (
    <View style={[styles.container, { backgroundColor: theme.mode === 'moonlit' ? theme.bgDeep : theme.bg }]}>
      <Constellation size={120} variant={0} color={theme.gold} />
      <View style={styles.mark}>
        <Text style={[styles.markGlyph, { color: theme.coral }]}>❦</Text>
      </View>
      <SectionLabel theme={theme}>Project Two</SectionLabel>
      <Text style={[styles.title, { color: theme.ink }]}>A quiet place{'\n'}for two.</Text>
      <EngravedDivider width={200} />
      <Text style={[styles.subtitle, { color: theme.inkFaint, fontFamily: FONT_EDITORIAL, fontSize: 19 }]}>
        One small moment, every day.
      </Text>
      {!authReady && <ActivityIndicator color={theme.accent} style={{ marginTop: 32 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  mark: { marginTop: 8 },
  markGlyph: { fontSize: 44, textAlign: 'center' },
  title: { fontFamily: FONT_HEAD, fontSize: 40, textAlign: 'center', lineHeight: 48, marginBottom: 4 },
  subtitle: { textAlign: 'center' },
});
