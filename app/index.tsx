import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/providers/AppProvider';
import { colors } from '@/theme/tokens';
import { EngravedDivider } from '@/components/Ornaments';
import { SectionLabel } from '@/theme/ui';
import { FONT_HEAD, FONT_BODY, FONT_HEAD_ITALIC } from '@/theme/fonts';
import { Text } from 'react-native';

export default function Welcome() {
  const { authReady, session, mode } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!authReady) return;
    const t = setTimeout(() => {
      router.replace(session ? '/(tabs)' : '/onboarding');
    }, mode === 'demo' && !session ? 1400 : 0);
    return () => clearTimeout(t);
  }, [authReady, session, mode, router]);

  return (
    <View style={styles.container}>
      <View style={styles.mark}>
        <Text style={styles.markGlyph}>❦</Text>
      </View>
      <SectionLabel>Project Two</SectionLabel>
      <Text style={styles.title}>A quiet place{'\n'}for two.</Text>
      <EngravedDivider />
      <Text style={styles.subtitle}>One small moment, every day.</Text>
      {!authReady && <ActivityIndicator color={colors.oxide} style={{ marginTop: 32 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.parchment, alignItems: 'center', justifyContent: 'center', padding: 32 },
  mark: { marginBottom: 24 },
  markGlyph: { fontSize: 44, color: colors.oxide, textAlign: 'center' },
  title: { fontFamily: FONT_HEAD, fontSize: 40, color: colors.ink, textAlign: 'center', lineHeight: 48, marginBottom: 8 },
  subtitle: { fontFamily: FONT_HEAD_ITALIC, fontSize: 16, color: colors.inkFaint, textAlign: 'center' },
});
