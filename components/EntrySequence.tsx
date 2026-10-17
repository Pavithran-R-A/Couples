import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { useApp } from '../providers/AppProvider';
import { spacing } from '../theme/tokens';
import { FONT_EDITORIAL, FONT_MEDIUM } from '../theme/fonts';
import { CelestialGarden, EnvelopeArt, FlowerSprig, Constellation } from './Illustrations';
import { LanternSeed } from './LanternSeed';
import { Button } from '../theme/ui';

const BEATS = [
  {
    key: 'garden',
    caption: 'Somewhere between your days, a small world keeps a light on for you both.',
  },
  {
    key: 'lumi',
    caption: 'This is Lumi. It glows brighter every time either of you writes.',
  },
  {
    key: 'letter',
    caption: 'Every day, one sealed letter arrives. You each answer apart — and open it together.',
  },
] as const;

// Choreographed first-time entry: garden awakens, Lumi notices, a letter
// arrives. Skippable at any moment; honours reduced motion and mute.
export function EntrySequence({ onDone }: { onDone: () => void }) {
  const { theme, reducedMotion } = useApp();
  const [beat, setBeat] = useState(0);
  const { width: screenW } = Dimensions.get('window');
  const heroH = Math.min(320, Math.max(240, screenW * 0.66));

  useEffect(() => {
    if (reducedMotion) return;
    const t = setTimeout(() => {
      if (beat < BEATS.length - 1) setBeat((b) => b + 1);
    }, beat === 0 ? 2400 : 3200);
    return () => clearTimeout(t);
  }, [beat, reducedMotion]);

  const current = BEATS[beat];
  const showLumi = beat >= 1;
  const showLetter = beat >= 2;

  return (
    <View style={[styles.wrap, { backgroundColor: theme.bg }]}>
      <View style={[styles.hero, { height: heroH }]}>
        <CelestialGarden width={screenW} height={heroH} moonlit={theme.mode === 'moonlit'} />
        <View style={styles.heroContent}>
          {showLumi && <LanternSeed mood={showLetter ? 'delighted' : 'greeting'} affection={showLetter ? 78 : 52} size={showLetter ? 108 : 128} />}
          {showLetter && (
            <View style={styles.envelopeWrap}>
              <EnvelopeArt size={104} open={false} flapColor={theme.accent} sealColor={theme.coral} />
            </View>
          )}
          {!showLetter && <Constellation size={110} variant={0} color={theme.gold} />}
        </View>
        <View style={styles.flora}>
          <FlowerSprig size={34} color={theme.coral} />
          <FlowerSprig size={26} color={theme.gold} flip />
        </View>
      </View>

      <View style={styles.copyBlock}>
        <Text style={[styles.caption, { color: theme.ink, fontFamily: beat === BEATS.length - 1 ? FONT_EDITORIAL : FONT_EDITORIAL, fontSize: 21, lineHeight: 30 }]}>
          {current.caption}
        </Text>
        <View style={styles.dots}>
          {BEATS.map((b, i) => (
            <View key={b.key} style={[styles.dot, { backgroundColor: i === beat ? theme.accent : theme.line }]} />
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        {beat < BEATS.length - 1 ? (
          <Button label="Next" onPress={() => setBeat((b) => b + 1)} theme={theme} />
        ) : (
          <Button label="Open the gate" onPress={onDone} theme={theme} />
        )}
        <Pressable onPress={onDone} hitSlop={12} style={styles.skip}>
          <Text style={[styles.skipText, { color: theme.inkFaint }]}>Skip — explore now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  hero: { width: '100%', overflow: 'hidden' },
  heroContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 26,
  },
  envelopeWrap: { marginTop: -8 },
  flora: { position: 'absolute', bottom: -2, left: 24, flexDirection: 'row', alignItems: 'flex-end' },
  copyBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.lg },
  caption: { textAlign: 'center', maxWidth: 300 },
  dots: { flexDirection: 'row', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  actions: { padding: spacing.xl, paddingBottom: 40, gap: spacing.md, alignItems: 'stretch' },
  skip: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  skipText: { fontFamily: FONT_MEDIUM, fontSize: 13.5 },
});
