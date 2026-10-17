import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { spacing, radii, type Theme } from '../theme/tokens';
import { FONT_BOLD, FONT_BODY } from '../theme/fonts';

const REACTIONS: Array<{ kind: string; glyph: string; label: string }> = [
  { kind: 'heart', glyph: '♥', label: 'Love' },
  { kind: 'smile', glyph: '☺', label: 'Warm' },
  { kind: 'spark', glyph: '✶', label: 'Spark' },
];

export function ReactionRow({
  onReact,
  activeKind,
  theme,
}: {
  onReact: (kind: 'heart' | 'smile' | 'spark') => void;
  activeKind?: string | null;
  theme: Theme;
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
              {
                backgroundColor: active ? theme.coralSoft : theme.surfaceSoft,
                borderColor: active ? theme.coral : theme.line,
              },
              pressed && { transform: [{ scale: 0.94 }] },
            ]}
            accessibilityLabel={`React with ${r.label}`}
          >
            <Text style={[styles.glyph, { color: active ? theme.coral : theme.inkSoft }]}>{r.glyph}</Text>
            <Text style={[styles.label, { color: active ? theme.coral : theme.inkSoft }, active && { fontFamily: FONT_BOLD }]}>
              {r.label}
            </Text>
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
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  glyph: { fontSize: 16 },
  label: { fontFamily: FONT_BODY, fontSize: 13 },
});
