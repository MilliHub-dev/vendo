import { Package, UtensilsCrossed } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Order } from '@/api/types';
import { formatDateTime } from '@/lib/dates';
import { formatNaira } from '@/lib/money';
import { isActive, statusLabel } from '@/lib/order-status';
import { radius, spacing, useTheme } from '@/theme';

import { Badge, Text } from './ui';

export const orderTitle = (o: Order) => o.vendor?.name ?? `Package to ${o.receiver?.name ?? o.dropoff.address.split(',')[0]}`;

export function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
  const { colors } = useTheme();
  const Icon = order.type === 'food' ? UtensilsCrossed : Package;
  const tone = order.status === 'delivered' ? 'success' : order.status === 'cancelled' ? 'danger' : 'primary';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${orderTitle(order)}, ${statusLabel(order.status)}`} onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.line }, pressed && { opacity: 0.85 }]}>
      <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
        <Icon size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.between}>
          <Text variant="bodyMedium" color="heading" numberOfLines={1} style={{ flex: 1 }}>
            {orderTitle(order)}
          </Text>
          <Text variant="bodyMedium" color="heading">
            {formatNaira(order.totalKobo)}
          </Text>
        </View>
        <Text variant="small" color="muted" numberOfLines={1}>
          {order.type === 'food' ? `${order.items.reduce((n, i) => n + i.quantity, 0)} items` : order.dropoff.address} · {order.code}
        </Text>
        <View style={styles.between}>
          <Badge label={order.status === 'scheduled' && order.scheduledFor ? `Scheduled · ${formatDateTime(order.scheduledFor)}` : statusLabel(order.status)} tone={tone} />
          {isActive(order.status) ? null : (
            <Text variant="caption" color="subtle">
              {formatDateTime(order.createdAt)}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
  icon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
});
