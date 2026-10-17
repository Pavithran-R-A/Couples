import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { spacing, radii, type Theme } from '../theme/tokens';
import { FONT_BOLD, FONT_BODY, FONT_HEAD, FONT_EDITORIAL } from '../theme/fonts';
import { KeepsakeStamp } from './Illustrations';
import type { Memory } from '../domain/types';

// Keepsake scrapbook card — alternating photo/page layouts with a
// pressed-flower stamp accent. Layout variant alternates by index upstream.
export function MemoryCard({
  memory,
  onEdit,
  onDelete,
  theme,
  variant = 0,
}: {
  memory: Memory;
  onEdit: () => void;
  onDelete: () => void;
  theme: Theme;
  variant?: 0 | 1;
}) {
  const date = new Date(memory.memoryDate + 'T00:00:00');
  const day = date.getDate();
  const month = date.toLocaleDateString(undefined, { month: 'short' });
  const year = date.getFullYear();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.line,
          flexDirection: variant === 1 ? 'row-reverse' : 'row',
        },
      ]}
    >
      {memory.photoUri ? (
        <Image source={{ uri: memory.photoUri }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={[styles.photo, { backgroundColor: theme.mode === 'moonlit' ? theme.accentSoft : theme.goldSoft }]}>
          <KeepsakeStamp size={56} tone={variant === 1 ? theme.accent : theme.coral} glyph={variant === 1 ? 'moon' : 'seed'} />
        </View>
      )}
      <View style={styles.body}>
        <View style={[styles.dateChip, { backgroundColor: theme.surfaceSoft, borderColor: theme.line }]}>
          <Text style={[styles.dateDay, { color: theme.accent, fontFamily: FONT_HEAD }]}>{day}</Text>
          <View>
            <Text style={[styles.dateMonth, { color: theme.inkSoft }]}>{month}</Text>
            <Text style={[styles.dateYear, { color: theme.inkFaint }]}>{year}</Text>
          </View>
        </View>
        <Text style={[styles.title, { color: theme.ink }]} numberOfLines={2}>
          {memory.title}
        </Text>
        {memory.note ? (
          <Text style={[styles.note, { color: theme.inkSoft, fontFamily: FONT_EDITORIAL, fontSize: 15.5 }]} numberOfLines={3}>
            {memory.note}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable onPress={onEdit} hitSlop={10} style={styles.actionHit}>
            <Text style={[styles.actionText, { color: theme.gold }]}>Edit</Text>
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={10} style={styles.actionHit}>
            <Text style={[styles.actionText, { color: theme.danger }]}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  photo: { width: 118, minHeight: 170, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, padding: spacing.lg, gap: 6 },
  dateChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dateDay: { fontSize: 20, lineHeight: 24 },
  dateMonth: { fontFamily: FONT_BOLD, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 1 },
  dateYear: { fontFamily: FONT_BODY, fontSize: 10.5 },
  title: { fontFamily: FONT_HEAD, fontSize: 17, lineHeight: 23 },
  note: { lineHeight: 21 },
  actions: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.sm },
  actionHit: { minHeight: 32, justifyContent: 'center' },
  actionText: { fontFamily: FONT_BOLD, fontSize: 13 },
});
