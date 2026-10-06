import { useRouter } from 'expo-router';
import { ArrowLeft, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, useTheme } from '@/theme';

import { Text } from './ui';

const STEPS = 3; // phone, code, details

/**
 * Shared frame for the sign-in steps: back button, progress, a badge and heading, the form,
 * and a button bar that stays above the keyboard.
 */
export function AuthScaffold({ step, icon: Icon, title, subtitle, children, footer, onBack }: { step: 1 | 2 | 3; icon: LucideIcon; title: string; subtitle: ReactNode; children: ReactNode; footer: ReactNode; onBack?: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={onBack ?? (() => router.back())} style={[styles.back, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <ArrowLeft size={20} color={colors.heading} />
        </Pressable>
        <View accessibilityRole="progressbar" accessibilityLabel={`Step ${step} of ${STEPS}`} accessibilityValue={{ min: 1, max: STEPS, now: step }} style={styles.progress}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={[styles.bar, { backgroundColor: i < step ? colors.primary : colors.line }]} />
          ))}
        </View>
        <Text variant="small" color="subtle" style={styles.count}>
          {step}/{STEPS}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(350)} style={{ gap: spacing.md }}>
          <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
            <Icon size={26} color={colors.primary} />
          </View>
          <Text variant="display">{title}</Text>
          <Text color="muted">{subtitle}</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(90).duration(350)} style={{ gap: spacing.lg }}>
          {children}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.bg }]}>{footer}</View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  count: { minWidth: 28, textAlign: 'right' },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.xl },
  badge: { width: 60, height: 60, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.sm },
});
