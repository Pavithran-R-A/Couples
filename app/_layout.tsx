import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AppProvider, useApp } from '@/providers/AppProvider';
import { useAppFonts } from '@/theme/fonts';
import { colors } from '@/theme/tokens';

function RootGate() {
  const { authReady, session, backend, mode } = useApp();
  const [needsPairing, setNeedsPairing] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!authReady) return;
    if (!session) {
      router.replace('/onboarding');
      return;
    }
    // In demo mode the pre-seeded couple already exists; on Supabase a
    // signed-in user without a couple goes through the pairing flow.
    if (mode === 'supabase') {
      backend
        .getMyProfile()
        .then((p) => setNeedsPairing(!p?.coupleId))
        .catch(() => setNeedsPairing(false));
    } else {
      setNeedsPairing(false);
    }
  }, [authReady, session, mode, backend, router]);

  useEffect(() => {
    if (needsPairing) router.replace('/pairing');
  }, [needsPairing, router]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.parchment } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="pairing" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useFrameworkReady();
  const loaded = useAppFonts();

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.parchment, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.oxide} />
      </View>
    );
  }

  return (
    <AppProvider>
      <StatusBar style="dark" />
      <RootGate />
    </AppProvider>
  );
}
