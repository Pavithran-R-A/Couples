import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, G, Defs, LinearGradient, Stop, RadialGradient, Rect, Text as SvgText, Ellipse } from 'react-native-svg';
import { brand } from '../theme/tokens';

// Midnight Postcards — original vector illustrations.
// Every shape here is bespoke artwork drawn for Project Two.

/* ---------- Celestial garden hero backdrop ---------- */

export function CelestialGarden({
  width,
  height,
  moonlit,
}: {
  width: number;
  height: number;
  moonlit: boolean;
}) {
  const sky1 = moonlit ? '#1B2542' : '#3D2A50';
  const sky2 = moonlit ? brand.midnightNavy : '#533755';
  const star = moonlit ? '#F4EDE6' : '#F9EEDB';
  const hill1 = moonlit ? '#1A2338' : '#2C2036';
  const hill2 = moonlit ? '#151D32' : brand.romanticPlum;
  const stars: Array<[number, number, number]> = [
    [24, 30, 1.4], [58, 16, 1], [92, 44, 1.6], [130, 22, 1.1], [168, 52, 1],
    [205, 30, 1.5], [238, 14, 1], [272, 48, 1.3], [306, 26, 1], [34, 66, 1],
    [150, 74, 1.2], [250, 70, 1.4], [320, 62, 1], [200, 90, 1], [80, 84, 1.1],
  ];
  return (
    <Svg width={width} height={height} viewBox="0 0 360 200" preserveAspectRatio="xMidYMax slice">
      <Defs>
        <LinearGradient id="cgSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={sky1} />
          <Stop offset="1" stopColor={sky2} />
        </LinearGradient>
      </Defs>
      <Rect width={360} height={200} fill="url(#cgSky)" />
      {stars.map(([x, y, r], i) => (
        <Circle key={i} cx={x} cy={y} r={r} fill={star} opacity={0.85} />
      ))}
      {/* crescent moon */}
      <Path
        d="M 292 34 A 22 22 0 1 0 312 62 A 17 17 0 1 1 292 34 Z"
        fill={moonlit ? brand.honeyGold : '#F7DCD5'}
        opacity={0.95}
      />
      {/* distant hills */}
      <Path d="M 0 158 Q 60 118 120 150 Q 180 182 240 142 Q 300 104 360 148 L 360 200 L 0 200 Z" fill={hill1} opacity={0.85} />
      <Path d="M 0 178 Q 90 146 170 172 Q 260 200 360 168 L 360 200 L 0 200 Z" fill={hill2} />
      {/* botanical silhouettes */}
      <Path d="M 40 200 Q 44 168 36 148 Q 50 160 52 200 Z" fill={hill2} opacity={0.9} />
      <Path d="M 322 200 Q 316 160 328 138 Q 334 164 330 200 Z" fill={hill2} opacity={0.9} />
      <Path d="M 70 200 Q 74 180 68 168 Q 80 176 80 200 Z" fill={hill1} opacity={0.7} />
    </Svg>
  );
}

/* ---------- Illustrated envelope + letter ---------- */

export function EnvelopeArt({
  size = 120,
  open = false,
  letterColor = '#FFF8F1',
  flapColor = '#533755',
  bodyColor = '#EFE3EE',
  sealColor = '#E67883',
}: {
  size?: number;
  open?: boolean;
  letterColor?: string;
  flapColor?: string;
  bodyColor?: string;
  sealColor?: string;
}) {
  const w = size;
  const h = size * 0.72;
  return (
    <Svg width={w} height={h} viewBox="0 0 200 144">
      {/* letter peeking when open */}
      {open && (
        <G>
          <Rect x={44} y={open ? 8 : 40} width={112} height={86} rx={6} fill={letterColor} />
          <Path d="M 58 28 H 142 M 58 44 H 128 M 58 60 H 136" stroke="#C9B0A8" strokeWidth={3} strokeLinecap="round" opacity={0.55} />
        </G>
      )}
      {/* envelope pocket */}
      <Path d="M 12 52 L 100 112 L 188 52 L 188 132 Q 188 140 180 140 L 20 140 Q 12 140 12 132 Z" fill={bodyColor} />
      <Path d="M 12 52 L 100 112 L 188 52" fill="none" stroke={flapColor} strokeWidth={2} opacity={0.35} />
      {/* flap */}
      {open ? (
        <Path d="M 12 52 L 100 6 L 188 52" fill="none" stroke={flapColor} strokeWidth={2.5} opacity={0.7} strokeLinecap="round" />
      ) : (
        <Path d="M 12 52 L 100 108 L 188 52 L 188 44 Q 188 36 180 36 L 20 36 Q 12 36 12 44 Z" fill={flapColor} />
      )}
      {/* wax seal */}
      <Circle cx={100} cy={open ? 24 : 82} r={open ? 12 : 16} fill={sealColor} />
      <Circle cx={100} cy={open ? 24 : 82} r={open ? 12 : 16} fill="none" stroke="#C75A66" strokeWidth={2} opacity={0.6} />
      <Path
        d={open ? 'M 100 18 Q 104 24 100 30 Q 96 24 100 18 Z' : 'M 100 74 Q 106 82 100 90 Q 94 82 100 74 Z'}
        fill="#FFF8F1"
        opacity={0.9}
      />
    </Svg>
  );
}

/* ---------- Seasonal flowers ---------- */

export function FlowerSprig({
  size = 44,
  color = brand.roseCoral,
  stem = '#5E9B85',
  flip = false,
}: {
  size?: number;
  color?: string;
  stem?: string;
  flip?: boolean;
}) {
  return (
    <View style={[styles.sprig, flip && { transform: [{ scaleX: -1 }] }]}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Path d="M 24 46 Q 22 30 24 14" stroke={stem} strokeWidth={2} fill="none" strokeLinecap="round" />
        <Path d="M 23 34 Q 14 30 12 24 Q 20 26 23 32 Z" fill={stem} opacity={0.75} />
        <Path d="M 25 26 Q 34 22 36 16 Q 28 18 25 24 Z" fill={stem} opacity={0.75} />
        {[0, 72, 144, 216, 288].map((deg) => (
          <Path
            key={deg}
            d="M 24 14 Q 19 6 24 2 Q 29 6 24 14 Z"
            fill={color}
            transform={`rotate(${deg} 24 14)`}
            opacity={0.92}
          />
        ))}
        <Circle cx={24} cy={14} r={3} fill={brand.honeyGold} />
      </Svg>
    </View>
  );
}

/* ---------- Keepsake stamp ---------- */

export function KeepsakeStamp({
  size = 52,
  tone = brand.roseCoral,
  glyph = 'seed',
}: {
  size?: number;
  tone?: string;
  glyph?: 'seed' | 'moon' | 'flower';
}) {
  const scallops = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return { cx: 26 + Math.cos(a) * 20, cy: 26 + Math.sin(a) * 20 };
  });
  return (
    <Svg width={size} height={size} viewBox="0 0 52 52">
      {scallops.map((s, i) => (
        <Circle key={i} cx={s.cx} cy={s.cy} r={3.2} fill={tone} opacity={0.9} />
      ))}
      <Rect x={6} y={6} width={40} height={40} rx={4} fill={tone} opacity={0.18} />
      <Rect x={6} y={6} width={40} height={40} rx={4} fill="none" stroke={tone} strokeWidth={1.4} opacity={0.8} />
      {glyph === 'seed' && (
        <Path d="M 26 14 Q 34 22 30 32 Q 26 38 26 38 Q 26 38 22 32 Q 18 22 26 14 Z" fill={tone} />
      )}
      {glyph === 'moon' && (
        <Path d="M 30 16 A 10 10 0 1 0 36 30 A 7.5 7.5 0 1 1 30 16 Z" fill={tone} />
      )}
      {glyph === 'flower' && (
        <G>
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <Path key={deg} d="M 26 22 Q 23 15 26 11 Q 29 15 26 22 Z" fill={tone} transform={`rotate(${deg} 26 20)`} />
          ))}
          <Circle cx={26} cy={20} r={2.6} fill={brand.honeyGold} />
        </G>
      )}
    </Svg>
  );
}

/* ---------- Ribbon banner ---------- */

export function Ribbon({
  width = 160,
  tone = brand.romanticPlum,
  text = 'for you',
  textColor = '#FFF8F1',
}: {
  width?: number;
  tone?: string;
  text?: string;
  textColor?: string;
}) {
  const h = width * 0.2;
  return (
    <Svg width={width} height={h} viewBox="0 0 160 32">
      <Path d="M 0 6 L 14 16 L 0 26 Z" fill={tone} opacity={0.7} />
      <Path d="M 160 6 L 146 16 L 160 26 Z" fill={tone} opacity={0.7} />
      <Rect x={10} y={4} width={140} height={24} rx={4} fill={tone} />
      <SvgText x={80} y={20.5} textAnchor="middle" fill={textColor} fontSize={13} fontFamily="DMSans_700Bold" letterSpacing={2}>
        {text.toUpperCase()}
      </SvgText>
    </Svg>
  );
}

/* ---------- Constellation ornament ---------- */

export function Constellation({
  size = 90,
  color = brand.honeyGold,
  variant = 0,
}: {
  size?: number;
  color?: string;
  variant?: 0 | 1 | 2;
}) {
  const pts =
    variant === 0
      ? [[10, 40], [34, 16], [58, 30], [80, 10]]
      : variant === 1
        ? [[12, 12], [36, 34], [64, 20], [82, 44]]
        : [[10, 20], [30, 44], [56, 28], [80, 40]];
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  return (
    <Svg width={size} height={size * 0.55} viewBox="0 0 90 50">
      <Path d={d} stroke={color} strokeWidth={1} fill="none" opacity={0.55} strokeDasharray="2 3" />
      {pts.map((p, i) => (
        <Circle key={i} cx={p[0]} cy={p[1]} r={i === 0 || i === pts.length - 1 ? 2.2 : 1.6} fill={color} opacity={0.9} />
      ))}
    </Svg>
  );
}

/* ---------- Botanical garden floor for the companion ---------- */

export function GardenGround({ width, moonlit }: { width: number; moonlit: boolean }) {
  const h = width * 0.5;
  const grass = moonlit ? '#24384A' : '#A9D6C4';
  const grassSoft = moonlit ? '#1E2F40' : '#C4E3D5';
  return (
    <Svg width={width} height={h} viewBox="0 0 300 150" preserveAspectRatio="xMidYMax slice">
      <Ellipse cx={150} cy={150} rx={190} ry={70} fill={grassSoft} />
      <Ellipse cx={150} cy={162} rx={210} ry={64} fill={grass} />
      <Path d="M 52 118 Q 50 96 44 88 Q 58 96 58 118 Z" fill={grass} />
      <Path d="M 244 122 Q 248 100 256 92 Q 246 104 250 122 Z" fill={grass} />
      <Path d="M 80 130 Q 82 116 78 110" stroke={grassSoft} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <Path d="M 220 132 Q 218 118 222 112" stroke={grassSoft} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <Circle cx={110} cy={142} r={3} fill={brand.honeyGold} opacity={0.5} />
      <Circle cx={190} cy={146} r={2.4} fill={brand.honeyGold} opacity={0.4} />
      <Circle cx={150} cy={150} r={2.2} fill={brand.roseCoral} opacity={0.4} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  sprig: { alignItems: 'center', justifyContent: 'center' },
});
