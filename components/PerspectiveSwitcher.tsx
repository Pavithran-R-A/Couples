import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useApp } from '../providers/AppProvider';
import { spacing, radii } from '../theme/tokens';
import { FONT_BOLD, FONT_MEDIUM } from '../theme/fonts';

// Mara/Theo perspective switcher — demo mode only. Swaps the session to the
// other fictional partner so every screen re-renders from their view.
export function PerspectiveSwitcher() {
  const { demo, backend, session, mode, refreshSession } = useApp();
  if (mode !== 'demo') return null;

  const isA = session?.id === 'demo-user-a';
  const current = isA ? 'Mara' : 'Theo';
  const other: 'a' | 'b' = isA ? 'b' : 'a';

  const switchTo = async () => {
    await demo.signInAsPartner(other);
    await refreshSession();
  };

  return (
    <View style={[styles.bar, { backgroundColor: backend.mode === 'demo' ? '#2C2036' : '#2C2036' }]} pointerEvents="box-none">
      <Text style={styles.label}>Viewing as</Text>
      <View style={styles.pillRow}>
        {(['a', 'b'] as const).map((p) => {
          const name = p === 'a' ? 'Mara' : 'Theo';
          const active = (p === 'a') === isA;
          return (
            <Pressable
              key={p}
              onPress={active ? undefined : switchTo}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{name}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>Switch to see {other === 'a' ? "Mara's" : "Theo's"} view</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  label: { color: '#C9C0CF', fontFamily: FONT_MEDIUM, fontSize: 12.5 },
  pillRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,248,241,0.12)',
    borderRadius: radii.pill,
    padding: 3,
    gap: 2,
  },
  pill: { borderRadius: radii.pill, paddingHorizontal: 18, paddingVertical: 6, minHeight: 32, justifyContent: 'center' },
  pillActive: { backgroundColor: '#F5C779' },
  pillText: { color: '#E9D9E4', fontFamily: FONT_BOLD, fontSize: 13 },
  pillTextActive: { color: '#151D32' },
  hint: { color: '#9189A0', fontFamily: FONT_MEDIUM, fontSize: 11.5, maxWidth: 90 },
});
