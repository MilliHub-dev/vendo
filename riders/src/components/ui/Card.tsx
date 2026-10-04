import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

type Props = ViewProps & { onPress?: PressableProps['onPress']; style?: StyleProp<ViewStyle>; accessibilityLabel?: string };

export function Card({ onPress, style, children, accessibilityLabel, ...rest }: Props) {
  const { colors } = useTheme();
  const base = [styles.card, { backgroundColor: colors.surface, borderColor: colors.line }, style];
  if (!onPress) {
    return (
      <View style={base} {...rest}>
        {children}
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
});
