import { Minus, Plus, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, useTheme, type ThemeColors } from '@/theme';

import { Text } from './Text';

/** Emoji on a tinted tile — placeholder art until vendors supply photos. */
export function Thumb({ emoji, size = 64, emojiSize, rounded = radius.md, style }: { emoji?: string; size?: number; /** defaults to half the tile */ emojiSize?: number; rounded?: number; style?: StyleProp<ViewStyle> }) {
  const glyph = emojiSize ?? size * 0.5;
  const { colors } = useTheme();
  return (
    <View style={[{ width: size, height: size, borderRadius: rounded, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      <Text style={{ fontSize: glyph, lineHeight: glyph * 1.25 }} maxFontSizeMultiplier={1}>
        {emoji ?? '🍽️'}
      </Text>
    </View>
  );
}

export function Chip({ label, selected, onPress, left }: { label: string; selected?: boolean; onPress?: () => void; left?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.line }]}>
      {left}
      <Text variant="smallMedium" color={selected ? 'onPrimary' : 'heading'}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'primary' }: { label: string; tone?: 'primary' | 'success' | 'muted' | 'danger' | 'warning' }) {
  const { colors } = useTheme();
  const fg: keyof ThemeColors = tone === 'muted' ? 'muted' : tone;
  return (
    <View style={[styles.badge, { backgroundColor: tone === 'primary' ? colors.primarySoft : colors.surfaceAlt }]}>
      <Text variant="caption" color={fg}>
        {label}
      </Text>
    </View>
  );
}

export function IconButton({ icon: Icon, label, onPress, tone = 'surface', size = 44 }: { icon: LucideIcon; label: string; onPress?: () => void; tone?: 'surface' | 'soft' | 'primary'; size?: number }) {
  const { colors } = useTheme();
  const bg = tone === 'primary' ? colors.primary : tone === 'soft' ? colors.primarySoft : colors.surface;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: radius.pill, backgroundColor: bg, borderWidth: tone === 'surface' ? 1 : 0, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}>
      <Icon size={size * 0.45} color={tone === 'primary' ? colors.onPrimary : tone === 'soft' ? colors.primary : colors.heading} />
    </Pressable>
  );
}

export function Stepper({ value, onChange, min = 0, label }: { value: number; onChange: (v: number) => void; min?: number; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stepper, { borderColor: colors.line, backgroundColor: colors.surface }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Fewer ${label}`} disabled={value <= min} onPress={() => onChange(value - 1)} style={[styles.step, value <= min && { opacity: 0.3 }]}>
        <Minus size={16} color={colors.heading} />
      </Pressable>
      <Text variant="bodyMedium" style={styles.qty} accessibilityLabel={`${value} ${label}`}>
        {String(value).padStart(2, '0')}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`More ${label}`} onPress={() => onChange(value + 1)} style={styles.step}>
        <Plus size={16} color={colors.primary} />
      </Pressable>
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.segmented, { backgroundColor: colors.surfaceAlt }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.value)} style={[styles.segment, on && { backgroundColor: colors.surface }]}>
            <Text variant="smallMedium" color={on ? 'heading' : 'muted'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Radio-style option card, as in the reference checkout. */
export function OptionRow({ title, subtitle, selected, onPress, left, right }: { title: string; subtitle?: string; selected: boolean; onPress: () => void; left?: ReactNode; right?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.option, { backgroundColor: colors.surface, borderColor: selected ? colors.primary : colors.line }]}>
      {left}
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium">{title}</Text>
        {subtitle ? (
          <Text variant="small" color="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (
        <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.subtle }]}>{selected ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}</View>
      )}
    </Pressable>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
        {title}
      </Text>
      {action ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10}>
          <Text variant="smallMedium" color="primary">
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text variant={strong ? 'bodyMedium' : 'small'} color={strong ? 'heading' : 'muted'} style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant={strong ? 'heading' : 'smallMedium'} color={strong ? 'primary' : 'heading'}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.pill },
  step: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 26, textAlign: 'center' },
  segmented: { flexDirection: 'row', padding: 4, borderRadius: radius.pill },
  segment: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1.5 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
