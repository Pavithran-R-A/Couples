import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Ellipse, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import type { CompanionMood } from '../domain/types';
import { colors } from '../theme/tokens';

interface Props {
  mood: CompanionMood;
  affection: number; // 0..100 — glow intensity derives from this
  size?: number;
  reducedMotion?: boolean;
}

// Original three-leaf lantern-seed companion.
// A warm seed body that glows with affection, crowned by three leaves whose
// posture follows its mood. All original vector artwork. Breathing/sway are
// driven by shared values so a future animated layer can read them; the
// drawn glyph re-renders per state change (cheap, and reduced-motion safe).
export function LanternSeed({ mood, affection, size = 140, reducedMotion = false }: Props) {
  const breath = useSharedValue(0);
  const sway = useSharedValue(0);
  const [blinkOpen, setBlinkOpen] = useState(true);

  useEffect(() => {
    if (reducedMotion) return;
    breath.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    sway.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [reducedMotion, breath, sway]);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = setInterval(() => {
      setBlinkOpen(false);
      setTimeout(() => setBlinkOpen(true), 150);
    }, 4200);
    return () => clearInterval(timer);
  }, [reducedMotion]);

  const glow = 0.25 + (affection / 100) * 0.55;

  const mouthPath = useMemo(() => {
    if (mood === 'delighted') return 'M 84 118 Q 100 134 116 118';
    if (mood === 'sleepy') return 'M 88 122 Q 100 128 112 122';
    if (mood === 'cared') return 'M 88 120 Q 100 130 112 120';
    return 'M 90 121 Q 100 127 110 121';
  }, [mood]);

  return (
    <View style={[styles.wrap, { width: size, height: size * 1.15 }]}>
      <View style={[styles.halo, { opacity: reducedMotion ? glow * 0.5 : 0.6 }]}>
        <Circle cx={100} cy={105} r={82} fill={colors.brass} fillOpacity={0.12} />
      </View>
      <View style={reducedMotion ? undefined : { transform: [{ rotate: '-1.2deg' }] }}>
        <Svg width={size} height={size * 1.15} viewBox="0 0 200 230">
          <Defs>
            <LinearGradient id="seedGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#F3E4C8" />
              <Stop offset="1" stopColor="#E7D2A8" />
            </LinearGradient>
            <LinearGradient id="leafA" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#A9BCA6" />
              <Stop offset="1" stopColor={colors.sage} />
            </LinearGradient>
          </Defs>

          <Path d="M 100 52 Q 98 38 100 26" stroke="#7E8E7C" strokeWidth={5} fill="none" strokeLinecap="round" />

          <Path d="M 100 40 Q 68 18 44 34 Q 62 54 100 46 Z" fill="url(#leafA)" />
          <Path d="M 100 30 Q 96 6 100 0 Q 116 8 112 28 Q 106 34 100 30 Z" fill="#8FA38D" />
          <Path d="M 100 40 Q 132 18 156 34 Q 138 54 100 46 Z" fill="url(#leafA)" />
          <Path d="M 96 42 Q 72 32 52 36" stroke="#F6F0E6" strokeWidth={1.6} fill="none" opacity={0.6} />
          <Path d="M 104 42 Q 128 32 148 36" stroke="#F6F0E6" strokeWidth={1.6} fill="none" opacity={0.6} />

          <Path
            d="M 100 52 C 148 52 168 96 162 132 C 156 172 132 196 100 196 C 68 196 44 172 38 132 C 32 96 52 52 100 52 Z"
            fill="url(#seedGrad)"
          />
          <Path d="M 62 100 Q 100 92 138 100" stroke="#C9B07E" strokeWidth={1.4} fill="none" opacity={0.55} />
          <Path d="M 56 130 Q 100 122 144 130" stroke="#C9B07E" strokeWidth={1.4} fill="none" opacity={0.55} />
          <Path d="M 64 158 Q 100 152 136 158" stroke="#C9B07E" strokeWidth={1.4} fill="none" opacity={0.55} />

          <Ellipse cx={100} cy={128} rx={44} ry={52} fill="#FFF3D6" fillOpacity={reducedMotion ? glow : glow * 0.85} />

          {mood === 'sleepy' ? (
            <>
              <Path d="M 76 108 Q 86 116 96 108" stroke={colors.ink} strokeWidth={3.4} fill="none" strokeLinecap="round" />
              <Path d="M 106 108 Q 116 116 126 108" stroke={colors.ink} strokeWidth={3.4} fill="none" strokeLinecap="round" />
            </>
          ) : (
            <>
              <Ellipse cx={84} cy={106} rx={5.5} ry={blinkOpen ? 7.5 : 1.4} fill={colors.ink} />
              <Ellipse cx={118} cy={106} rx={5.5} ry={blinkOpen ? 7.5 : 1.4} fill={colors.ink} />
              <Circle cx={70} cy={120} r={6} fill={colors.oxide} fillOpacity={0.22} />
              <Circle cx={132} cy={120} r={6} fill={colors.oxide} fillOpacity={0.22} />
            </>
          )}
          <Path d={mouthPath} stroke={colors.ink} strokeWidth={3} fill="none" strokeLinecap="round" />

          {mood === 'delighted' && (
            <Path d="M 148 74 L 152 62 L 156 74 L 168 78 L 156 82 L 152 94 L 148 82 L 136 78 Z" fill={colors.brass} />
          )}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 200, height: 200, borderRadius: 100 },
});
