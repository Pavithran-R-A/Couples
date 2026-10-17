import { useEffect } from 'react';
import { SplashScreen } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium_Italic,
  Fraunces_600SemiBold_Italic,
} from '@expo-google-fonts/fraunces';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  CormorantGaramond_500Medium_Italic,
  CormorantGaramond_600SemiBold_Italic,
} from '@expo-google-fonts/cormorant-garamond';

export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Fraunces_400Regular_Italic,
    Fraunces_500Medium_Italic,
    Fraunces_600SemiBold_Italic,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    CormorantGaramond_500Medium_Italic,
    CormorantGaramond_600SemiBold_Italic,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  return loaded;
}

export const FONT_HEAD = 'Fraunces_600SemiBold';
export const FONT_HEAD_LIGHT = 'Fraunces_400Regular';
export const FONT_HEAD_MEDIUM = 'Fraunces_500Medium';
export const FONT_HEAD_BLACK = 'Fraunces_700Bold';
export const FONT_HEAD_ITALIC = 'Fraunces_500Medium_Italic';
export const FONT_HEAD_SEMI_ITALIC = 'Fraunces_600SemiBold_Italic';
export const FONT_EDITORIAL = 'CormorantGaramond_500Medium_Italic';
export const FONT_EDITORIAL_SEMI = 'CormorantGaramond_600SemiBold_Italic';
export const FONT_BODY = 'DMSans_400Regular';
export const FONT_MEDIUM = 'DMSans_500Medium';
export const FONT_BOLD = 'DMSans_700Bold';
