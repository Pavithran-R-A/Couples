import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { colors, spacing, radii } from '../theme/tokens';
import { FONT_BOLD, FONT_BODY, FONT_HEAD_ITALIC } from '../theme/fonts';
import type { Memory } from '../domain/types';

export function MemoryCard({
  memory,
  onEdit,
  onDelete,
}: {
  memory: Memory;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const date = new Date(memory.memoryDate + 'T00:00:00');
  const dateLabel = date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <View style={styles.card}>
      {memory.photoUri ? (
        <Image source={{ uri: memory.photoUri }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={[styles.photo, styles.photoFallback]}>
          <Text style={styles.photoGlyph}>✦</Text>
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.date}>{dateLabel}</Text>
        <Text style={styles.title}>{memory.title}</Text>
        {memory.note ? <Text style={styles.note}>{memory.note}</Text> : null}
        <View style={styles.actions}>
          <Pressable onPress={onEdit} hitSlop={8}>
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={8}>
            <Text style={[styles.actionText, styles.deleteText]}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.chalk,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  photo: { width: '100%', height: 150, backgroundColor: colors.parchmentDeep },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  photoGlyph: { fontSize: 28, color: colors.brass },
  body: { padding: spacing.xl },
  date: { fontFamily: FONT_BODY, fontSize: 11.5, letterSpacing: 1.5, color: colors.inkFaint, textTransform: 'uppercase', marginBottom: 6 },
  title: { fontFamily: FONT_BOLD, fontSize: 18, color: colors.ink, marginBottom: 6 },
  note: { fontFamily: FONT_BODY, fontSize: 14.5, color: colors.inkSoft, lineHeight: 22, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.lg },
  actionText: { fontFamily: FONT_BOLD, fontSize: 13, color: colors.brass },
  deleteText: { color: colors.danger },
});
