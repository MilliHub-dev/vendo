import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';

type Props = {
  children: ReactNode;
  /** scroll the content (default) or lay it out in a fixed view */
  scroll?: boolean;
  /** add top safe-area padding — for screens without a navigation header (the tabs) */
  safeTop?: boolean;
  /** pinned to the bottom, above the home indicator — e.g. a checkout button */
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  /** remove the side padding, for screens with edge-to-edge rows */
  bleed?: boolean;
};

export function Screen({ children, scroll = true, safeTop, footer, contentStyle, bleed }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const padding = { paddingTop: (safeTop ? insets.top : 0) + spacing.lg, ...(bleed ? { paddingHorizontal: 0 } : null) };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.content, padding, contentStyle]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill, padding, contentStyle]}>{children}</View>
      )}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.bg, borderTopColor: colors.line }]}>{footer}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
});
