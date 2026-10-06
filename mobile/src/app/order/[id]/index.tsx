import { useLocalSearchParams, useRouter } from 'expo-router';
import { Star } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useOrder, usePayOrder, useRateOrder } from '@/api/queries';
import { orderTitle } from '@/components/OrderCard';
import { paymentLabels, RatingSheet } from '@/components/sheets';
import { Badge, Button, Card, Row, Screen, Text } from '@/components/ui';
import { formatDateTime } from '@/lib/dates';
import { lineKey } from '@/lib/cart';
import { formatNaira } from '@/lib/money';
import { useCancelFlow } from '@/lib/use-cancel-order';
import { canCancel, isActive, orderTypeLabel, statusLabel } from '@/lib/order-status';
import { useCart } from '@/store/cart';
import { packageSizes, useDispatchDraft } from '@/store/dispatch';
import { spacing, useTheme } from '@/theme';

/** Receipt: what was ordered, where it went, what it cost — with re-order, rate and cancel. */
export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const { data: order, isPending } = useOrder(id);
  const cancelling = useCancelFlow(order);
  const rate = useRateOrder();
  const pay = usePayOrder();
  const replaceCart = useCart((s) => s.replace);
  const resetSendForm = useDispatchDraft((s) => s.resetForm);
  const [rating, setRating] = useState(false);

  if (isPending || !order) return <Screen scroll={false}>{isPending ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} /> : <Text color="danger">Order not found.</Text>}</Screen>;

  const tone = order.status === 'delivered' ? 'success' : order.status === 'cancelled' ? 'danger' : 'primary';
  const size = packageSizes.find((s) => s.value === order.packageSize);
  const unpaid = order.status === 'pending_payment' && order.isPaid === false;

  const again = () => {
    if (order.type === 'food' && order.vendor) {
      // dishes with choices (protein, size…) have to be picked again, so those orders reopen the vendor's menu
      if (order.items.some((i) => i.options)) return router.push({ pathname: '/vendor/[id]', params: { id: order.vendor.id } });
      replaceCart(
        order.vendor.id,
        order.vendor.name,
        order.items.map((i) => ({ key: lineKey(i.menuItemId), menuItemId: i.menuItemId, vendorId: order.vendor!.id, name: i.name, unitPriceKobo: i.unitPriceKobo, quantity: i.quantity })),
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
            <Row key={`${i.menuItemId}-${i.options ?? ''}`} label={`${i.quantity} × ${i.name}${i.options ? ` (${i.options})` : ''}`} value={formatNaira(i.unitPriceKobo * i.quantity)} />
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
        <Row label={unpaid ? 'Paying with' : 'Paid with'} value={paymentLabels[order.paymentMethod]} />
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

      {unpaid ? (
        <>
          <Text color="muted">This order hasn’t been paid for yet, so it hasn’t been sent to {order.type === 'food' ? 'the vendor' : 'a rider'}.</Text>
          <Button title={`Pay ${formatNaira(order.totalKobo)}`} loading={pay.isPending} onPress={() => pay.mutate(id)} />
          {pay.isError ? <Text color="danger">{pay.error.message}</Text> : null}
        </>
      ) : null}
      {isActive(order.status) && order.status !== 'scheduled' && !unpaid ? <Button title="Track order" onPress={() => router.push({ pathname: '/order/[id]/track', params: { id } })} /> : null}
      {order.status === 'delivered' && !order.rating ? <Button title="Rate your delivery" onPress={() => setRating(true)} /> : null}
      {!isActive(order.status) ? <Button title={order.type === 'food' ? 'Order again' : 'Send again'} variant="secondary" onPress={again} /> : null}
      {canCancel(order.status) ? <Button title="Cancel order" variant="ghost" loading={cancelling.busy} onPress={cancelling.start} /> : null}
      {cancelling.error ? <Text color="danger">{cancelling.error}</Text> : null}

      <RatingSheet visible={rating} riderName={order.rider?.name} loading={rate.isPending} onClose={() => setRating(false)} onSubmit={(stars, comment) => rate.mutate({ id, rating: stars, comment }, { onSuccess: () => setRating(false) })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
});
