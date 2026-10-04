/**
 * Design tokens — the same palette as the website (web/app/globals.css),
 * so the app and vendoltd.com read as one brand in light and dark mode.
 */

export const palette = {
  blue: '#0064FF',
  blue600: '#0052D6',
  blue400: '#4D93FF',
  navy: '#0A1633',
  white: '#FFFFFF',
  green: '#16A34A',
  amber: '#E8A92C',
  red: '#E5484D',
} as const;

export type ThemeColors = {
  /** page background */
  bg: string;
  /** cards, sheets, inputs */
  surface: string;
  /** tinted fills: image placeholders, chips */
  surfaceAlt: string;
  /** headings and primary text */
  heading: string;
  text: string;
  muted: string;
  subtle: string;
  line: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  /** soft blue tint behind icons / selected chips */
  primarySoft: string;
  success: string;
  warning: string;
  danger: string;
  tabBar: string;
};

export const lightColors: ThemeColors = {
  bg: '#F6F8FC',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF3FB',
  heading: '#0A1633',
  text: '#141D33',
  muted: '#5B6781',
  subtle: '#8B97AD',
  line: '#E3E8F0',
  primary: palette.blue,
  primaryPressed: palette.blue600,
  onPrimary: '#FFFFFF',
  primarySoft: '#EEF4FF',
  success: palette.green,
  warning: palette.amber,
  danger: palette.red,
  tabBar: '#FFFFFF',
};

export const darkColors: ThemeColors = {
  bg: '#0B1222',
  surface: '#121B31',
  surfaceAlt: '#16213B',
  heading: '#F2F5FB',
  text: '#D9E0EE',
  muted: '#9AA7C2',
  subtle: '#7684A3',
  line: '#223052',
  primary: palette.blue,
  primaryPressed: palette.blue400,
  onPrimary: '#FFFFFF',
  primarySoft: 'rgba(0, 100, 255, 0.16)',
  success: '#4ADE80',
  warning: palette.amber,
  danger: '#FF6B6F',
  tabBar: '#121B31',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

/** Soft elevation. `boxShadow` works on iOS, Android and web in this React Native version. */
export const shadows = {
  card: { boxShadow: '0 6px 18px rgba(10, 22, 51, 0.07)' },
  raised: { boxShadow: '0 10px 28px rgba(10, 22, 51, 0.14)' },
  primary: { boxShadow: '0 8px 18px rgba(0, 100, 255, 0.35)' },
} as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

/** Outfit, loaded in src/app/_layout.tsx. Use these names, never fontWeight alone. */
export const fonts = {
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
} as const;

export const typography = {
  display: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 36, letterSpacing: -0.6 },
  title: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  smallMedium: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  eyebrow: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, letterSpacing: 2.4, textTransform: 'uppercase' },
} as const;

export type TypographyVariant = keyof typeof typography;
