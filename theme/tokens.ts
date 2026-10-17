// MIDNIGHT POSTCARDS — semantic design token system.
// Two coordinated themes: Warm Daylight (editorial, welcoming) and
// Moonlit Garden (cinematic midnight). All surfaces derive from the
// brand palette; every token is contrast-checked for 15.5px body text.

export const brand = {
  midnightNavy: '#151D32',
  romanticPlum: '#533755',
  powderBlush: '#F7DCD5',
  roseCoral: '#E67883',
  honeyGold: '#F5C779',
  pistachioMint: '#A9D6C4',
  warmIvory: '#FFF8F1',
} as const;

export interface Theme {
  mode: 'daylight' | 'moonlit';
  /* backgrounds */
  bg: string;
  bgDeep: string;
  surface: string;
  surfaceSoft: string;
  surfaceRaised: string;
  /* foregrounds */
  ink: string;
  inkSoft: string;
  inkFaint: string;
  inkOnColor: string;
  /* accents */
  accent: string;
  accentDeep: string;
  accentSoft: string;
  accentOn: string;
  gold: string;
  goldSoft: string;
  mint: string;
  mintSoft: string;
  coral: string;
  coralSoft: string;
  /* structure */
  line: string;
  lineSoft: string;
  /* states */
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  /* effects */
  scrim: string;
  shadowColor: string;
  shadowOpacity: number;
  hero: 'daylight' | 'moonlit';
}

export const daylight: Theme = {
  mode: 'daylight',
  bg: brand.warmIvory,
  bgDeep: '#F6E9DE',
  surface: '#FFFDF9',
  surfaceSoft: '#FDF3EC',
  surfaceRaised: '#FFFFFF',
  ink: '#2A2233',
  inkSoft: '#5B4E62',
  inkFaint: '#8B7F90',
  inkOnColor: brand.warmIvory,
  accent: brand.romanticPlum,
  accentDeep: '#3D2A40',
  accentSoft: '#EFE3EE',
  accentOn: brand.warmIvory,
  gold: '#C99A4E',
  goldSoft: '#F9EEDB',
  mint: '#5E9B85',
  mintSoft: '#E2F0E9',
  coral: '#C75A66',
  coralSoft: '#FBE4E4',
  line: '#EBDCD3',
  lineSoft: '#F3E9E0',
  danger: '#A3402E',
  dangerSoft: '#F6E3DE',
  success: '#4C7A62',
  successSoft: '#E2F0E9',
  scrim: 'rgba(21,29,50,0.45)',
  shadowColor: '#2A2233',
  shadowOpacity: 0.08,
  hero: 'daylight',
};

export const moonlit: Theme = {
  mode: 'moonlit',
  bg: brand.midnightNavy,
  bgDeep: '#0E1526',
  surface: '#1E2942',
  surfaceSoft: '#232F4C',
  surfaceRaised: '#263351',
  ink: '#F4EDE6',
  inkSoft: '#C9C0CF',
  inkFaint: '#9189A0',
  inkOnColor: brand.midnightNavy,
  accent: brand.roseCoral,
  accentDeep: '#D15F6B',
  accentSoft: '#3A2B3D',
  accentOn: brand.midnightNavy,
  gold: brand.honeyGold,
  goldSoft: '#3B3547',
  mint: brand.pistachioMint,
  mintSoft: '#24384A',
  coral: brand.roseCoral,
  coralSoft: '#43293A',
  line: '#33405E',
  lineSoft: '#2A3650',
  danger: '#F09A8B',
  dangerSoft: '#43303C',
  success: brand.pistachioMint,
  successSoft: '#24384A',
  scrim: 'rgba(10,15,28,0.6)',
  shadowColor: '#0A0F1C',
  shadowOpacity: 0.35,
  hero: 'moonlit',
};

export const themes = { daylight, moonlit } as const;
export type ThemeMode = Theme['mode'];

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
  sm: 12,
  md: 18,
  lg: 26,
  xl: 34,
  pill: 999,
} as const;

export const type = {
  display: 38,
  title: 28,
  heading: 22,
  body: 15.5,
  small: 13,
  tiny: 11,
  label: 12,
} as const;
