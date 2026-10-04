import { useRouter } from 'expo-router';
import { Plus, ShoppingCart, Trash2 } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { PromoCode } from '@/components/PromoCode';
import { Button, EmptyState, Screen, Stepper, Text, Thumb } from '@/components/ui';
import { cartCount, cartSubtotal } from '@/lib/cart';
import { formatNaira } from '@/lib/money';
import { useCart } from '@/store/cart';
import { radius, spacing, useTheme } from '@/theme';

export default function CartScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { lines, vendorId, vendorName, setQuantity } = useCart();
  const count = cartCount(lines);

  if (lines.length === 0) {
    return (
      <Screen>
        <EmptyState
          art={require('@/assets/images/art-food.png')}
          title="Your cart is empty"
          description="Add something tasty from a vendor near you and it will show up here."
          action={<Button title="Browse vendors" onPress={() => router.replace('/')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen footer={<Button title={`Checkout · ${formatNaira(cartSubtotal(lines))}`} onPress={() => router.push('/checkout')} />}>
      <View style={[styles.banner, { backgroundColor: colors.primarySoft }]}>
        <ShoppingCart size={22} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium" color="heading">
            {count} item{count === 1 ? '' : 's'} in your cart
          </Text>
          <Text variant="small" color="muted">
            From {vendorName}
          </Text>
        </View>
      </View>

      {lines.map((line) => (
        <View key={line.menuItemId} style={[styles.line, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Thumb emoji={line.emoji} size={84} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={styles.between}>
              <Text variant="bodyMedium" color="heading" style={{ flex: 1 }}>
                {line.name}
              </Text>
              <Text variant="bodyMedium" color="primary">
                {formatNaira(line.unitPriceKobo * line.quantity)}
              </Text>
            </View>
            {line.note ? (
              <Text variant="small" color="muted" numberOfLines={2}>
                “{line.note}”
              </Text>
            ) : null}
            <View style={styles.between}>
              <Stepper value={line.quantity} min={1} onChange={(q) => setQuantity(line.menuItemId, q)} label={line.name} />
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${line.name}`} onPress={() => setQuantity(line.menuItemId, 0)} hitSlop={8} style={[styles.trash, { backgroundColor: colors.surfaceAlt }]}>
                <Trash2 size={18} color={colors.danger} />
              </Pressable>
            </View>
          </View>
        </View>
      ))}

      <PromoCode />

      <Pressable
        accessibilityRole="button"
        onPress={() => (vendorId ? router.push({ pathname: '/vendor/[id]', params: { id: vendorId } }) : router.back())}
        style={[styles.more, { borderColor: colors.line, backgroundColor: colors.surface }]}>
        <Plus size={18} color={colors.heading} />
        <Text variant="bodyMedium">Add more items</Text>
      </Pressable>
      <Text variant="small" color="subtle" center>
        The delivery fee is added at checkout.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg },
  line: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  trash: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 52, borderRadius: radius.pill, borderWidth: 1 },
});
