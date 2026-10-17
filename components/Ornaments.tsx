import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { colors } from '../theme/tokens';

// Bespoke ornaments in the Afterlight Atelier style.

export function EngravedDivider({ width = 240 }: { width?: number }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 8 }}>
      <Svg width={width} height={14} viewBox={`0 0 ${width} 14`}>
        <Path d={`M 0 7 H ${width * 0.42}`} stroke={colors.brass} strokeWidth={1} opacity={0.5} />
        <Path d={`M ${width * 0.58} 7 H ${width}`} stroke={colors.brass} strokeWidth={1} opacity={0.5} />
        <Path
          d={`M ${width / 2} 2 L ${width / 2 + 5} 7 L ${width / 2} 12 L ${width / 2 - 5} 7 Z`}
          fill="none"
          stroke={colors.brass}
          strokeWidth={1.1}
        />
        <Circle cx={width / 2} cy={7} r={1.4} fill={colors.brass} />
      </Svg>
    </View>
  );
}

export function WaxSeal({ size = 44 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Circle cx={24} cy={24} r={20} fill={colors.oxide} />
      <Circle cx={24} cy={24} r={20} fill="none" stroke={colors.oxideDeep} strokeWidth={2} />
      <Circle cx={24} cy={24} r={13} fill="none" stroke={colors.chalk} strokeWidth={1.2} opacity={0.65} />
      {/* Stylized seed inside the seal */}
      <Path d="M 24 16 C 30 16 32 21 30 26 C 28 31 24 32 24 32 C 24 32 20 31 18 26 C 16 21 18 16 24 16 Z" fill={colors.chalk} opacity={0.9} />
      <Path d="M 24 17 Q 22 12 24 9" stroke={colors.chalk} strokeWidth={1.6} fill="none" opacity={0.9} />
    </Svg>
  );
}

export function SprigCorner({ flip = false }: { flip?: boolean }) {
  return (
    <G transform={flip ? 'scale(-1,1)' : undefined}>
      <Path d="M 0 40 Q 8 20 28 12" stroke={colors.sage} strokeWidth={1.6} fill="none" />
      <Path d="M 10 26 Q 16 22 20 24 Q 16 30 10 26 Z" fill={colors.sageMist} stroke={colors.sage} strokeWidth={1} />
      <Path d="M 18 16 Q 24 12 28 14 Q 24 20 18 16 Z" fill={colors.sageMist} stroke={colors.sage} strokeWidth={1} />
    </G>
  );
}

export function LeafGlyph({ size = 20, color = colors.sage }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M 12 3 C 18 7 19 14 12 21 C 5 14 6 7 12 3 Z" fill={color} />
      <Path d="M 12 6 L 12 18" stroke={colors.chalk} strokeWidth={1.2} opacity={0.7} />
    </Svg>
  );
}
