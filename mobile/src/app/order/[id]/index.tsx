import { useLocalSearchParams, useRouter } from 'expo-router';
import { Star } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useCancelOrder, useOrder, useRateOrder } from '@/api/queries';
import { orderTitle } from '@/components/OrderCard';
import { paymentLabels, RatingSheet } from '@/components/sheets';
import { Badge, Button, Card, Row, Screen, Text } from '@/components/ui';
import { formatDateTime } from '@/lib/dates';
import { formatNaira } from '@/lib/money';
import { canCancel, isActive, orderTypeLabel, statusLabel } from '@/lib/order-status';
import { useCart } from '@/store/cart';
import { confirm } from '@/store/confirm';
import { packageSizes, useDispatchDraft } from '@/store/dispatch';
import { spacing, useTheme } from '@/theme';

/** Receipt: what was ordered, where it went, what it cost — with re-order, rate and cancel. */
export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const { data: order, isPending } = useOrder(id);
  const cancel = useCancelOrder();
  const rate = useRateOrder();
  const replaceCart = useCart((s) => s.replace);
  const resetSendForm = useDispatchDraft((s) => s.resetForm);
  const [rating, setRating] = useState(false);

  if (isPending || !order) return <Screen scroll={false}>{isPending ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} /> : <Text color="danger">Order not found.</Text>}</Screen>;

  const tone = order.status === 'delivered' ? 'success' : order.status === 'cancelled' ? 'danger' : 'primary';
  const size = packageSizes.find((s) => s.value === order.packageSize);

  const again = () => {
    if (order.type === 'food' && order.vendor) {
      replaceCart(
        order.vendor.id,
        order.vendor.name,
        order.items.map((i) => ({ menuItemId: i.menuItemId, vendorId: order.vendor!.id, name: i.name, unitPriceKobo: i.unitPriceKobo, quantity: i.quantity })),
      );
      router.push('/cart');
    } else {
      resetSendForm({ pickup: order.pickup, dropoff: order.dropoff, packageSize: order.packageSize, packageNote: order.packageNote, receiver: order.receiver });
      router.dismissTo('/');
      router.push('/send');
    }
  };

  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <Text variant="title">{orderTitle(order)}</Text>
        <View style={styles.meta}>
          <Badge label={statusLabel(order.status)} tone={tone} />
          <Text variant="small" color="muted">
            {orderTypeLabel(order.type)} · {order.code} · {formatDateTime(order.createdAt)}
          </Text>
        </View>
        {order.scheduledFor ? <Text color="muted">Scheduled for {formatDateTime(order.scheduledFor)}</Text> : null}
      </View>

      <Card>
        <Text variant="caption" color="subtle">
          Pick up from
        </Text>
        <Text variant="bodyMedium">{order.pickup.address}</Text>
        <View style={[styles.rule, { backgroundColor: colors.line }]} />
        <Text variant="caption" color="subtle">
          Deliver to
        </Text>
        <Text variant="bodyMedium">{order.dropoff.address}</Text>
        {order.dropoff.note ? (
          <Text variant="small" color="muted">
            Note: {order.dropoff.note}
          </Text>
        ) : null}
      </Card>

      {order.type === 'food' ? (
        <Card>
          {order.items.map((i) => (
            <Row key={i.menuItemId} label={`${i.quantity} × ${i.name}`} value={formatNaira(i.unitPriceKobo * i.quantity)} />
          ))}
        </Card>
      ) : (
        <Card>
          {size ? <Row label="Package" value={`${size.emoji} ${size.label}`} /> : null}
          {order.packageNote ? <Row label="Item" value={order.packageNote} /> : null}
          {order.receiver ? <Row label="Receiver" value={`${order.receiver.name} · ${order.receiver.phone}`} /> : null}
        </Card>
      )}

      <Card>
        {order.type === 'food' ? <Row label="Items subtotal" value={formatNaira(order.subtotalKobo)} /> : null}
        <Row label="Delivery fee" value={formatNaira(order.deliveryFeeKobo)} />
        {order.discountKobo ? <Row label="Discount" value={`− ${formatNaira(order.discountKobo)}`} /> : null}
        <View style={[styles.rule, { backgroundColor: colors.line }]} />
        <Row label="Total" value={formatNaira(order.totalKobo)} strong />
        <Row label="Paid with" value={paymentLabels[order.paymentMethod]} />
      </Card>

      {order.rider ? (
        <Card>
          <Row label="Rider" value={`${order.rider.name} · ${order.rider.plateNumber}`} />
          {order.rating ? (
            <View style={styles.meta}>
              <Text variant="small" color="muted" style={{ flex: 1 }}>
                Your rating
              </Text>
              {Array.from({ length: order.rating }, (_, i) => (
                <Star key={i} size={16} color={colors.warning} fill={colors.warning} />
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {isActive(order.status) && order.status !== 'scheduled' ? <Button title="Track order" onPress={() => router.push({ pathname: '/order/[id]/track', params: { id } })} /> : null}
      {order.status === 'delivered' && !order.rating ? <Button title="Rate your delivery" onPress={() => setRating(true)} /> : null}
      {!isActive(order.status) ? <Button title={order.type === 'food' ? 'Order again' : 'Send again'} variant="secondary" onPress={again} /> : null}
      {canCancel(order.status) ? (
        <Button
          title="Cancel order"
          variant="ghost"
          loading={cancel.isPending}
          onPress={() =>
            confirm({
              title: 'Cancel this order?',
              message: order.rider ? 'A rider is already on the way, so a cancellation fee may apply.' : 'Cancelling now is free.',
              confirmLabel: 'Yes, cancel order',
              cancelLabel: 'Keep order',
              destructive: true,
              onConfirm: () => cancel.mutate(id),
            })
          }
        />
      ) : null}
      {cancel.isError ? <Text color="danger">{cancel.error.message}</Text> : null}

      <RatingSheet visible={rating} riderName={order.rider?.name} loading={rate.isPending} onClose={() => setRating(false)} onSubmit={(stars, comment) => rate.mutate({ id, rating: stars, comment }, { onSuccess: () => setRating(false) })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
});
