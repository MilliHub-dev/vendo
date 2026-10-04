import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { typography, useTheme, type ThemeColors, type TypographyVariant } from '@/theme';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: keyof ThemeColors;
  center?: boolean;
};

/** All text goes through this so the Outfit font, theme colours and font scaling stay consistent. */
export function Text({ variant = 'body', color, center, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  const fallback: keyof ThemeColors = variant === 'display' || variant === 'title' || variant === 'heading' ? 'heading' : variant === 'eyebrow' ? 'subtle' : 'text';
  return (
    <RNText
      // respects the phone's text-size setting, capped so layouts survive (PRD: usable at 150%)
      maxFontSizeMultiplier={1.6}
      style={[typography[variant], { color: colors[color ?? fallback] }, center && { textAlign: 'center' }, style]}
      {...rest}
    />
  );
}
