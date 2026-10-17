import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radii, spacing } from './tokens';
import { FONT_BOLD, FONT_BODY, FONT_MEDIUM } from './fonts';

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.chalk,
          borderRadius: radii.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.line,
          padding: spacing.xl,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionLabel({ children, color }: { children: string; color?: string }) {
  return (
    <Text
      style={{
        fontSize: 11.5,
        letterSpacing: 2.2,
        color: color ?? colors.inkFaint,
        fontWeight: '600',
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Text>
  );
}

export function Heading({ children, style }: { children: string; style?: TextStyle | TextStyle[] }) {
  return (
    <Text style={[{ fontFamily: FONT_BOLD, fontSize: 26, color: colors.ink, lineHeight: 32 }, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, style }: { children: string; style?: TextStyle | TextStyle[] }) {
  return (
    <Text style={[{ fontFamily: FONT_BODY, fontSize: 15.5, color: colors.inkSoft, lineHeight: 24 }, style]}>
      {children}
    </Text>
  );
}

type BtnVariant = 'primary' | 'ghost' | 'quiet';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  italic,
}: {
  label: string;
  onPress: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle | ViewStyle[];
  italic?: boolean;
}) {
  const bg = variant === 'primary' ? colors.ink : 'transparent';
  const fg = variant === 'primary' ? colors.chalk : variant === 'ghost' ? colors.oxide : colors.inkSoft;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radii.md,
          minHeight: 52,
          paddingHorizontal: spacing.xl,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing.sm,
          opacity: disabled ? 0.45 : pressed ? 0.82 : 1,
        },
        variant === 'ghost' && { borderWidth: 1.5, borderColor: colors.oxide },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text
          style={{
            color: fg,
            fontFamily: FONT_BOLD,
            fontSize: 15,
            fontStyle: italic ? 'italic' : 'normal',
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Input({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize = 'none',
  keyboardType = 'default',
  multiline,
  style,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  keyboardType?: 'default' | 'email-address';
  multiline?: boolean;
  style?: TextStyle | TextStyle[];
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.inkFaint}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      keyboardType={keyboardType}
      multiline={multiline}
      style={[
        {
          backgroundColor: colors.chalk,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: radii.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          fontSize: 15.5,
          fontFamily: FONT_MEDIUM,
          color: colors.ink,
        },
        multiline && { minHeight: 120, textAlignVertical: 'top', lineHeight: 24 },
        style,
      ]}
    />
  );
}

export function ErrorNote({ children }: { children: string }) {
  if (!children) return null;
  return (
    <View
      style={{
        backgroundColor: '#F6E3DE',
        borderRadius: radii.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        marginBottom: spacing.md,
      }}
    >
      <Text style={{ color: colors.danger, fontFamily: FONT_MEDIUM, fontSize: 13.5 }}>{children}</Text>
    </View>
  );
}

export function Pill({ children, tone = 'sage' }: { children: string; tone?: 'sage' | 'oxide' | 'brass' }) {
  const bg = tone === 'sage' ? colors.sageMist : tone === 'oxide' ? colors.oxideMist : colors.brassMist;
  const fg = tone === 'sage' ? '#4A5F4C' : tone === 'oxide' ? colors.oxideDeep : '#8A6F42';
  return (
    <View style={{ backgroundColor: bg, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 5, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontFamily: FONT_MEDIUM, fontSize: 12 }}>{children}</Text>
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.parchment, gap: spacing.md }}>
      <ActivityIndicator color={colors.oxide} />
      {label ? <Text style={{ color: colors.inkFaint, fontFamily: FONT_BODY, fontSize: 13.5 }}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm }}>
      <Text style={{ fontFamily: FONT_BOLD, fontSize: 17, color: colors.ink }}>{title}</Text>
      {subtitle ? <Text style={{ fontFamily: FONT_BODY, fontSize: 14, color: colors.inkFaint, textAlign: 'center' }}>{subtitle}</Text> : null}
    </View>
  );
}
