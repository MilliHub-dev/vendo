import { Bike, Clock, Plus, Star } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { MenuItem, Vendor } from '@/api/types';
import { formatNaira } from '@/lib/money';
import { radius, shadows, spacing, useTheme } from '@/theme';

import { Badge, Text, Thumb } from './ui';

/** Vendor card for the horizontal "Popular near you" row. */
export function VendorTile({ vendor, onPress, width = 210 }: { vendor: Vendor; onPress: () => void; width?: number }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${vendor.name}, ${vendor.cuisine}`} onPress={onPress} style={({ pressed }) => [styles.tile, shadows.card, { width, backgroundColor: colors.surface }, pressed && { opacity: 0.9 }]}>
      <Thumb emoji={vendor.emoji} size={width} emojiSize={58} rounded={0} style={{ height: 112 }} />
      {!vendor.isOpen && (
        <View style={styles.closed}>
          <Badge label="Closed" tone="muted" />
        </View>
      )}
      <View style={styles.tileBody}>
        <View style={styles.rowBetween}>
          <Text variant="bodyMedium" color="heading" numberOfLines={1} style={{ flex: 1 }}>
            {vendor.name}
          </Text>
          <Text variant="smallMedium" color="primary">
            {formatNaira(vendor.deliveryFeeKobo)}
          </Text>
        </View>
        <Text variant="small" color="muted" numberOfLines={1}>
          {vendor.cuisine}
        </Text>
        <View style={styles.meta}>
          <Star size={13} color={colors.warning} fill={colors.warning} />
          <Text variant="caption" color="heading">
            {vendor.rating.toFixed(1)}
          </Text>
          <Text variant="caption" color="subtle">
            ·
          </Text>
          <Clock size={13} color={colors.subtle} />
          <Text variant="caption" color="muted">
            {vendor.etaMinutes[0]}–{vendor.etaMinutes[1]} min
          </Text>
        </View>
        <View style={[styles.tag, { backgroundColor: colors.primarySoft }]}>
          <Bike size={12} color={colors.primary} />
          <Text variant="caption" color="primary">
            Bike delivery
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/** Full-width vendor row for lists and search results. */
export function VendorRow({ vendor, onPress }: { vendor: Vendor; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${vendor.name}, ${vendor.cuisine}`} onPress={onPress} style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: colors.line }, pressed && { opacity: 0.85 }]}>
      <Thumb emoji={vendor.emoji} size={64} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.rowBetween}>
          <Text variant="bodyMedium" color="heading" numberOfLines={1} style={{ flexShrink: 1 }}>
            {vendor.name}
          </Text>
          {!vendor.isOpen && <Badge label="Closed" tone="muted" />}
        </View>
        <Text variant="small" color="muted" numberOfLines={1}>
          {vendor.cuisine}
        </Text>
        <View style={styles.meta}>
          <Star size={13} color={colors.warning} fill={colors.warning} />
          <Text variant="caption" color="heading">
            {vendor.rating.toFixed(1)} ({vendor.ratingCount})
          </Text>
          <Text variant="caption" color="muted">
            · {vendor.etaMinutes[0]}–{vendor.etaMinutes[1]} min · {formatNaira(vendor.deliveryFeeKobo)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/** Dish card for the horizontal "Picks for you" row. */
export function ItemTile({ item, vendorName, onPress, onAdd }: { item: MenuItem; vendorName: string; onPress: () => void; onAdd: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.name} from ${vendorName}, ${formatNaira(item.priceKobo)}`} onPress={onPress} style={({ pressed }) => [styles.tile, shadows.card, { width: 164, backgroundColor: colors.surface }, pressed && { opacity: 0.9 }]}>
      <Thumb emoji={item.emoji} size={164} emojiSize={54} rounded={0} style={{ height: 104 }} />
      <View style={styles.tileBody}>
        <Text variant="smallMedium" color="heading" numberOfLines={1}>
          {item.name}
        </Text>
        <Text variant="caption" color="muted" numberOfLines={1}>
          {vendorName}
        </Text>
        <View style={[styles.rowBetween, { marginTop: 4 }]}>
          <Text variant="bodyMedium" color="primary">
            {formatNaira(item.priceKobo)}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Add ${item.name} to cart`} onPress={onAdd} hitSlop={8} style={[styles.plus, { backgroundColor: colors.primary }]}>
            <Plus size={16} color={colors.onPrimary} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

/** Menu row on the vendor page: photo, name, description, price and a quick-add button. */
export function MenuRow({ item, disabled, onPress, onAdd }: { item: MenuItem; disabled?: boolean; onPress: () => void; onAdd: () => void }) {
  const { colors } = useTheme();
  const off = disabled || !item.isAvailable;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}, ${formatNaira(item.priceKobo)}`} onPress={onPress} disabled={off} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.line }, off && { opacity: 0.55 }]}>
      <Thumb emoji={item.emoji} size={84} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyMedium" color="heading">
          {item.name}
        </Text>
        <Text variant="small" color="muted" numberOfLines={2}>
          {item.description}
        </Text>
        <Text variant="smallMedium" color={item.isAvailable ? 'primary' : 'subtle'}>
          {item.isAvailable ? formatNaira(item.priceKobo) : 'Unavailable'}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Add ${item.name} to cart`} disabled={off} onPress={onAdd} hitSlop={6} style={[styles.plusLg, shadows.primary, { backgroundColor: colors.primary }]}>
        <Plus size={20} color={colors.onPrimary} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius.lg, overflow: 'hidden' },
  tileBody: { padding: spacing.md, gap: 3 },
  closed: { position: 'absolute', top: spacing.sm, left: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  plus: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  plusLg: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
