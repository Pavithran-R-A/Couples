export const colors = {
  ink: '#1D2927',
  inkSoft: '#4A5A57',
  inkFaint: '#7A8683',
  parchment: '#F6F0E6',
  parchmentDeep: '#EFE6D6',
  chalk: '#FFFCF8',
  oxide: '#BC5B47',
  oxideDeep: '#A3482F',
  oxideMist: '#F3DDD5',
  sage: '#9AA99B',
  sageMist: '#E4EAE2',
  brass: '#B89A6A',
  brassMist: '#F0E6D2',
  white: '#FFFFFF',
  line: '#E4DCCB',
  danger: '#A3402E',
  success: '#5E7D5A',
} as const;

export const palette = colors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const fonts = {
  heading: 'Fraunces_600SemiBold',
  headingItalic: 'Fraunces_600SemiBold_Italic',
  bodyRegular: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bold: 'DMSans_700Bold',
} as const;

export const type = {
  display: 34,
  title: 26,
  heading: 21,
  body: 15.5,
  small: 13,
  tiny: 11,
  label: 12,
} as const;
