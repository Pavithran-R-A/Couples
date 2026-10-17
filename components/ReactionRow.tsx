import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, radii } from '../theme/tokens';
import { FONT_BOLD, FONT_BODY } from '../theme/fonts';

const REACTIONS: Array<{ kind: string; glyph: string; label: string }> = [
  { kind: 'heart', glyph: '♥', label: 'Love' },
  { kind: 'smile', glyph: '☺', label: 'Warm' },
  { kind: 'spark', glyph: '✶', label: 'Spark' },
];

export function ReactionRow({
  onReact,
  activeKind,
}: {
  onReact: (kind: 'heart' | 'smile' | 'spark') => void;
  activeKind?: string | null;
}) {
  return (
    <View style={styles.row}>
      {REACTIONS.map((r) => {
        const active = activeKind === r.kind;
        return (
          <Pressable
            key={r.kind}
            onPress={() => onReact(r.kind as 'heart' | 'smile' | 'spark')}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && { transform: [{ scale: 0.94 }] },
            ]}
            accessibilityLabel={`React with ${r.label}`}
          >
            <Text style={[styles.glyph, active && styles.glyphActive]}>{r.glyph}</Text>
            <Text style={[styles.label, active && styles.labelActive]}>{r.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.parchment,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chipActive: { backgroundColor: colors.oxideMist, borderColor: colors.oxide },
  glyph: { fontSize: 16, color: colors.inkSoft },
  glyphActive: { color: colors.oxideDeep },
  label: { fontFamily: FONT_BODY, fontSize: 13, color: colors.inkSoft },
  labelActive: { fontFamily: FONT_BOLD, color: colors.oxideDeep },
});
