import { Check, Moon, Smartphone, Sun, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { useSettings, type Appearance } from '@/store/settings';
import { radius, spacing, useTheme } from '@/theme';

const options: { value: Appearance; label: string; hint: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'Match phone', hint: 'Follow this phone’s light or dark setting', icon: Smartphone },
  { value: 'light', label: 'Light', hint: 'Always light', icon: Sun },
  { value: 'dark', label: 'Dark', hint: 'Always dark', icon: Moon },
];

export default function AppearanceScreen() {
  const { colors } = useTheme();
  const appearance = useSettings((s) => s.appearance);
  const setAppearance = useSettings((s) => s.setAppearance);

  return (
    <Screen>
      <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
        {options.map(({ value, label, hint, icon: Icon }) => {
          const selected = appearance === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setAppearance(value)}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: selected ? colors.primary : colors.line }]}>
              <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
                <Icon size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">{label}</Text>
                <Text variant="small" color="muted">
                  {hint}
                </Text>
              </View>
              {selected && <Check size={20} color={colors.primary} />}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 68, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1.5 },
  icon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
