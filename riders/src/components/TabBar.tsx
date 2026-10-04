import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { ClipboardList, House, User, Wallet, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, useTheme } from '@/theme';

import { Text } from './ui';

/** Bottom bar: Home · Trips · Earnings · Profile. */
export function TabBar() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { backgroundColor: colors.tabBar, borderTopColor: colors.line, paddingBottom: Math.max(insets.bottom, 10) }]}>
      <TabTrigger name="home" asChild>
        <TabButton icon={House} label="Home" />
      </TabTrigger>
      <TabTrigger name="trips" asChild>
        <TabButton icon={ClipboardList} label="Trips" />
      </TabTrigger>
      <TabTrigger name="earnings" asChild>
        <TabButton icon={Wallet} label="Earnings" />
      </TabTrigger>
      <TabTrigger name="profile" asChild>
        <TabButton icon={User} label="Profile" />
      </TabTrigger>
    </View>
  );
}

function TabButton({ icon: Icon, label, isFocused, ...props }: TabTriggerSlotProps & { icon: LucideIcon; label: string }) {
  const { colors } = useTheme();
  const color = isFocused ? colors.primary : colors.subtle;
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityState={{ selected: !!isFocused }} style={styles.tab}>
      <Icon color={color} size={24} strokeWidth={isFocused ? 2.4 : 2} />
      <Text variant="caption" style={{ color, fontFamily: isFocused ? fonts.semibold : fonts.medium }} maxFontSizeMultiplier={1.2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 52 },
});
