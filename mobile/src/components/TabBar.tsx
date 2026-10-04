import { useRouter } from 'expo-router';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { ClipboardList, House, Send, ShoppingBag, User, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cartCount } from '@/lib/cart';
import { useCart } from '@/store/cart';
import { fonts, radius, useTheme } from '@/theme';

import { Text } from './ui';

/** Bottom bar: Home · Send · (cart) · Orders · Profile. The cart is a raised button that opens the cart screen. */
export function TabBar() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { backgroundColor: colors.tabBar, borderTopColor: colors.line, paddingBottom: Math.max(insets.bottom, 10) }]}>
      <TabTrigger name="home" asChild>
        <TabButton icon={House} label="Home" />
      </TabTrigger>
      <TabTrigger name="send" asChild>
        <TabButton icon={Send} label="Send" />
      </TabTrigger>
      <CartButton />
      <TabTrigger name="orders" asChild>
        <TabButton icon={ClipboardList} label="Orders" />
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

function CartButton() {
  const { colors } = useTheme();
  const count = useCart((s) => cartCount(s.lines));
  const router = useRouter();
  return (
    <View style={styles.tab}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/cart')}
        accessibilityLabel={count ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart, empty'}
        style={({ pressed }) => [styles.cart, { backgroundColor: pressed ? colors.primaryPressed : colors.primary, borderColor: colors.tabBar }]}>
        <ShoppingBag color={colors.onPrimary} size={24} />
        {count > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.heading, borderColor: colors.tabBar }]}>
            <Text variant="caption" style={{ color: colors.bg, fontSize: 11, lineHeight: 14 }} maxFontSizeMultiplier={1}>
              {count > 99 ? '99+' : count}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-end', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4, minHeight: 48 },
  cart: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28, // lifts the button above the bar
    marginBottom: 2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
