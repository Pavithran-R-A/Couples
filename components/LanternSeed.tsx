import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Svg, { Path, Circle, Ellipse, Defs, LinearGradient, Stop, RadialGradient } from 'react-native-svg';
import type { CompanionMood } from '../domain/types';
import { useApp } from '../providers/AppProvider';
import { brand } from '../theme/tokens';

interface Props {
  mood: CompanionMood;
  affection: number; // 0..100 — glow intensity derives from this
  size?: number;
  onPress?: () => void;
}

// LUMI — original lantern-seed companion. Leaf-like ears, softly glowing
// core, oversized expressive eyes, blush. Drawn entirely for Project Two;
// resembles no existing character.
export function LanternSeed({ mood, affection, size = 160, onPress }: Props) {
  const { theme, reducedMotion } = useApp();
  const [blinkOpen, setBlinkOpen] = useState(true);
  const [squish, setSquish] = useState(false);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = setInterval(() => {
      setBlinkOpen(false);
      setTimeout(() => setBlinkOpen(true), 150);
    }, 4200);
    return () => clearInterval(timer);
  }, [reducedMotion]);

  const glow = 0.3 + (affection / 100) * 0.6;
  const coreColor = mood === 'sleepy' ? '#B7A6E8' : brand.honeyGold;

  const mouthPath = useMemo(() => {
    if (mood === 'delighted') return 'M 86 128 Q 100 144 114 128';
    if (mood === 'sleepy') return 'M 90 132 Q 100 138 110 132';
    if (mood === 'cared') return 'M 88 130 Q 100 140 112 130';
    if (mood === 'greeting') return 'M 88 128 Q 100 138 112 128';
    return 'M 90 131 Q 100 136 110 131';
  }, [mood]);

  // ear posture follows mood
  const earDroop = mood === 'sleepy' ? 10 : mood === 'delighted' ? -6 : 0;

  const handlePress = () => {
    if (reducedMotion) return;
    setSquish(true);
    setTimeout(() => setSquish(false), 220);
    onPress?.();
  };

  const body = (
    <Svg width={size} height={size * 1.2} viewBox="0 0 200 240">
      <Defs>
        <RadialGradient id="lumiHalo" cx="0.5" cy="0.5" rx="0.5" ry="0.5">
          <Stop offset="0" stopColor={coreColor} stopOpacity={glow * 0.55} />
          <Stop offset="1" stopColor={coreColor} stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="lumiBody" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={theme.mode === 'moonlit' ? '#4A3A5E' : '#F3E4C8'} />
          <Stop offset="1" stopColor={theme.mode === 'moonlit' ? '#332747' : '#E7D2A8'} />
        </LinearGradient>
        <LinearGradient id="lumiLeaf" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#A9D6C4" />
          <Stop offset="1" stopColor="#5E9B85" />
        </LinearGradient>
        <RadialGradient id="lumiCore" cx="0.5" cy="0.42" rx="0.55" ry="0.55">
          <Stop offset="0" stopColor="#FFF6DE" stopOpacity={glow} />
          <Stop offset="1" stopColor={coreColor} stopOpacity={glow * 0.5} />
        </RadialGradient>
      </Defs>

      {/* halo */}
      <Circle cx={100} cy={128} r={92} fill="url(#lumiHalo)" />

      {/* stem */}
      <Path
        d={`M 100 66 Q 98 ${50 + earDroop} 100 ${40 + earDroop}`}
        stroke="#5E9B85"
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
      />

      {/* leaf ears — posture follows mood */}
      <Path
        d={`M 100 ${54 + earDroop} Q 64 ${30 + earDroop} 40 ${46 + earDroop} Q 60 ${68 + earDroop} 100 ${60 + earDroop} Z`}
        fill="url(#lumiLeaf)"
      />
      <Path
        d={`M 100 ${44 + earDroop} Q 96 ${18 + earDroop} 100 ${10 + earDroop} Q 118 ${18 + earDroop} 114 ${40 + earDroop} Q 107 ${47 + earDroop} 100 ${44 + earDroop} Z`}
        fill="#7FB89F"
      />
      <Path
        d={`M 100 ${54 + earDroop} Q 136 ${30 + earDroop} 160 ${46 + earDroop} Q 140 ${68 + earDroop} 100 ${60 + earDroop} Z`}
        fill="url(#lumiLeaf)"
      />
      {/* leaf veins */}
      <Path d={`M 96 ${58 + earDroop} Q 70 ${48 + earDroop} 50 ${50 + earDroop}`} stroke="#FFF8F1" strokeWidth={1.5} fill="none" opacity={0.55} />
      <Path d={`M 104 ${58 + earDroop} Q 130 ${48 + earDroop} 150 ${50 + earDroop}`} stroke="#FFF8F1" strokeWidth={1.5} fill="none" opacity={0.55} />

      {/* body */}
      <Path
        d="M 100 66 C 152 66 174 112 168 150 C 162 192 136 218 100 218 C 64 218 38 192 32 150 C 26 112 48 66 100 66 Z"
        fill="url(#lumiBody)"
      />

      {/* glowing core */}
      <Ellipse cx={100} cy={138} rx={48} ry={56} fill="url(#lumiCore)" />
      <Ellipse cx={100} cy={138} rx={48} ry={56} fill="none" stroke={coreColor} strokeWidth={1.4} opacity={glow * 0.6} />

      {/* delighted spark */}
      {mood === 'delighted' && (
        <Path d="M 156 84 L 160 72 L 164 84 L 176 88 L 164 92 L 160 104 L 156 92 L 144 88 Z" fill={brand.honeyGold} />
      )}
      {mood === 'greeting' && (
        <>
          <Circle cx={40} cy={92} r={2.4} fill={brand.honeyGold} opacity={0.85} />
          <Circle cx={166} cy={100} r={1.9} fill={brand.roseCoral} opacity={0.85} />
        </>
      )}

      {/* eyes — oversized, expressive */}
      {mood === 'sleepy' ? (
        <>
          <Path d="M 72 122 Q 84 132 96 122" stroke={theme.ink} strokeWidth={4} fill="none" strokeLinecap="round" />
          <Path d="M 106 122 Q 118 132 130 122" stroke={theme.ink} strokeWidth={4} fill="none" strokeLinecap="round" />
          <Path d="M 96 108 Q 100 104 104 108" stroke={theme.ink} strokeWidth={2.4} fill="none" strokeLinecap="round" opacity={0.7} />
        </>
      ) : (
        <>
          <Ellipse cx={82} cy={120} rx={9} ry={blinkOpen ? 12.5 : 2} fill={theme.ink} />
          <Ellipse cx={118} cy={120} rx={9} ry={blinkOpen ? 12.5 : 2} fill={theme.ink} />
          {!blinkOpen ? null : (
            <>
              <Circle cx={85} cy={115} r={3} fill="#FFF8F1" />
              <Circle cx={121} cy={115} r={3} fill="#FFF8F1" />
            </>
          )}
          {/* blush */}
          <Ellipse cx={66} cy={136} rx={8} ry={4.6} fill={brand.roseCoral} opacity={mood === 'cared' ? 0.5 : 0.32} />
          <Ellipse cx={134} cy={136} rx={8} ry={4.6} fill={brand.roseCoral} opacity={mood === 'cared' ? 0.5 : 0.32} />
        </>
      )}
      <Path d={mouthPath} stroke={theme.ink} strokeWidth={3.2} fill="none" strokeLinecap="round" />
    </Svg>
  );

  if (!onPress) {
    return (
      <View style={[styles.wrap, { width: size, height: size * 1.2 }, squish && { transform: [{ scale: 0.97 }] }]}>
        {body}
      </View>
    );
  }

  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.wrap, { width: size, height: size * 1.2 }, (squish || pressed) && { transform: [{ scale: 0.96 }] }]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
