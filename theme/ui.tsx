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
import { spacing, radii, type Theme } from './tokens';
import { FONT_HEAD, FONT_BODY, FONT_MEDIUM, FONT_BOLD, FONT_EDITORIAL } from './fonts';
import { useApp } from '../providers/AppProvider';

export function useTheme(): Theme {
  return useApp().theme;
}

export function Card({
  children,
  style,
  theme,
  tone = 'surface',
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  theme: Theme;
  tone?: 'surface' | 'soft' | 'raised';
}) {
  const bg = tone === 'soft' ? theme.surfaceSoft : tone === 'raised' ? theme.surfaceRaised : theme.surface;
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: radii.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.line,
          padding: spacing.xl,
          shadowColor: theme.shadowColor,
          shadowOpacity: theme.shadowOpacity,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionLabel({
  children,
  color,
  theme,
}: {
  children: string;
  color?: string;
  theme: Theme;
}) {
  return (
    <Text
      style={{
        fontSize: 11.5,
        letterSpacing: 2.2,
        color: color ?? theme.inkFaint,
        fontWeight: '600',
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Text>
  );
}

export function Heading({
  children,
  style,
  theme,
}: {
  children: string;
  style?: TextStyle | TextStyle[];
  theme: Theme;
}) {
  return (
    <Text style={[{ fontFamily: FONT_HEAD, fontSize: 26, color: theme.ink, lineHeight: 32 }, style]}>
      {children}
    </Text>
  );
}

export function Body({
  children,
  style,
  theme,
}: {
  children: string;
  style?: TextStyle | TextStyle[];
  theme: Theme;
}) {
  return (
    <Text style={[{ fontFamily: FONT_BODY, fontSize: 15.5, color: theme.inkSoft, lineHeight: 24 }, style]}>
      {children}
    </Text>
  );
}

export function EditorialAccent({
  children,
  style,
  theme,
}: {
  children: string;
  style?: TextStyle | TextStyle[];
  theme: Theme;
}) {
  return (
    <Text
      style={[
        { fontFamily: FONT_EDITORIAL, fontSize: 19, color: theme.coral, lineHeight: 26 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

type BtnVariant = 'primary' | 'ghost' | 'quiet' | 'gold';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  italic,
  theme,
}: {
  label: string;
  onPress: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle | ViewStyle[];
  italic?: boolean;
  theme: Theme;
}) {
  const palette: Record<BtnVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: theme.accent, fg: theme.accentOn },
    gold: { bg: theme.gold, fg: theme.mode === 'moonlit' ? theme.inkOnColor : '#3E2F14' },
    ghost: { bg: 'transparent', fg: theme.accent, border: theme.accent },
    quiet: { bg: 'transparent', fg: theme.inkSoft },
  };
  const v = palette[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: v.bg,
          borderRadius: radii.md,
          minHeight: 52,
          paddingHorizontal: spacing.xl,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing.sm,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        v.border && { borderWidth: 1.5, borderColor: v.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text
          style={{
            color: v.fg,
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
  theme,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  keyboardType?: 'default' | 'email-address';
  multiline?: boolean;
  style?: TextStyle | TextStyle[];
  theme: Theme;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.inkFaint}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      keyboardType={keyboardType}
      multiline={multiline}
      style={[
        {
          backgroundColor: theme.surfaceSoft,
          borderWidth: 1,
          borderColor: theme.line,
          borderRadius: radii.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          fontSize: 15.5,
          fontFamily: FONT_MEDIUM,
          color: theme.ink,
        },
        multiline && { minHeight: 120, textAlignVertical: 'top', lineHeight: 24 },
        style,
      ]}
    />
  );
}

export function ErrorNote({ children, theme }: { children: string; theme: Theme }) {
  if (!children) return null;
  return (
    <View
      style={{
        backgroundColor: theme.dangerSoft,
        borderRadius: radii.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        marginBottom: spacing.md,
      }}
    >
      <Text style={{ color: theme.danger, fontFamily: FONT_MEDIUM, fontSize: 13.5 }}>{children}</Text>
    </View>
  );
}

export function Pill({
  children,
  tone = 'mint',
  theme,
}: {
  children: string;
  tone?: 'mint' | 'coral' | 'gold' | 'plum';
  theme: Theme;
}) {
  const map = {
    mint: { bg: theme.mintSoft, fg: theme.mint },
    coral: { bg: theme.coralSoft, fg: theme.coral },
    gold: { bg: theme.goldSoft, fg: theme.gold },
    plum: { bg: theme.accentSoft, fg: theme.accent },
  } as const;
  const c = map[tone];
  return (
    <View
      style={{
        backgroundColor: c.bg,
        borderRadius: radii.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: 5,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: c.fg, fontFamily: FONT_MEDIUM, fontSize: 12 }}>{children}</Text>
    </View>
  );
}

export function Loading({ label, theme }: { label?: string; theme: Theme }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.bg,
        gap: spacing.md,
      }}
    >
      <ActivityIndicator color={theme.accent} />
      {label ? (
        <Text style={{ color: theme.inkFaint, fontFamily: FONT_BODY, fontSize: 13.5 }}>{label}</Text>
      ) : null}
    </View>
  );
}

export function EmptyState({
  title,
  subtitle,
  theme,
}: {
  title: string;
  subtitle?: string;
  theme: Theme;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm }}>
      <Text style={{ fontFamily: FONT_HEAD, fontSize: 17, color: theme.ink }}>{title}</Text>
      {subtitle ? (
        <Text
          style={{
            fontFamily: FONT_EDITORIAL,
            fontSize: 16,
            color: theme.inkFaint,
            textAlign: 'center',
            lineHeight: 22,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
