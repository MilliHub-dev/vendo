import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { radius, shadows, spacing, useTheme } from '@/theme';

import { Text } from './Text';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: ReactNode;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, variant = 'primary', icon, loading, disabled, style, ...rest }: Props) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const textColor = variant === 'primary' ? 'onPrimary' : variant === 'secondary' ? 'heading' : 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && { backgroundColor: pressed ? colors.primaryPressed : colors.primary },
        variant === 'primary' && !inactive && shadows.primary,
        variant === 'secondary' && { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
        variant !== 'primary' && pressed && { opacity: 0.7 },
        inactive && { opacity: 0.5 },
        style,
      ]}
      {...rest}>
      {loading ? <ActivityIndicator color={colors[textColor]} /> : icon}
      <Text variant="bodyMedium" color={textColor} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54, // grows with large text instead of clipping it
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
