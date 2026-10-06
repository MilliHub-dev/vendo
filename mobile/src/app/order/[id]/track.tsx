import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bike, House, MessageCircle, Navigation, PackageCheck, Phone, Share2, Star } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Linking, Share, StyleSheet, View } from 'react-native';

import { useMessages, useOrder, useRateOrder, useTracking } from '@/api/queries';
import { RouteMap } from '@/components/RouteMap';
import { RatingSheet } from '@/components/sheets';
import { Button, Card, IconButton, Screen, Text } from '@/components/ui';
import { distanceMeters, formatDistance } from '@/lib/geo';
import { canCancel, canChat, statusLabel, trackingProgress, trackingSteps } from '@/lib/order-status';
import { useChatSeen } from '@/store/chat';
import { useCancelFlow } from '@/lib/use-cancel-order';
import { radius, spacing, useTheme } from '@/theme';

const stepIcons = [Bike, PackageCheck, Navigation, House];

const headline: Record<string, [string, string]> = {
  searching_rider: ['Finding the nearest rider…', 'This usually takes under a minute.'],
  awaiting_vendor: ['Waiting for the vendor', 'They’re confirming your order.'],
  rider_assigned: ['Your rider is heading to the pickup', 'You’ll see them move once they have your order.'],
  picked_up: ['Picked up', 'Your order is with the rider.'],
  on_the_way: ['Your rider is on the way', 'Please be ready to receive your order.'],
  delivered: ['Delivered', 'Enjoy! Thanks for using Vendo.'],
  cancelled: ['Order cancelled', 'Any wallet payment has been refunded.'],
};

/** Live tracking — after the reference: map, live banner, four steps, distance and ETA, rider card. */
export default function TrackOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const { data: order, isPending } = useOrder(id);
  const { data: tracking } = useTracking(id);
  const cancelling = useCancelFlow(order);
  const rate = useRateOrder();
  const [rating, setRating] = useState(false);
  const chat = useMessages(id, !!order?.rider && canChat(order.status));
  const seen = useChatSeen((s) => s.seen[id] ?? 0);
  const unread = Math.max(0, (chat.data?.filter((m) => m.from === 'rider').length ?? 0) - seen);

  if (isPending || !order) return <Screen scroll={false}>{isPending ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} /> : <Text color="danger">Order not found.</Text>}</Screen>;

  const status = tracking?.status ?? order.status;
  const done = trackingProgress(status);
  const total = distanceMeters(order.pickup, order.dropoff) || 1;
  const moving = status === 'picked_up' || status === 'on_the_way';
  const progress = status === 'delivered' ? 1 : moving && tracking?.distanceMeters !== undefined ? 1 - tracking.distanceMeters / total : 0;
  const [title, subtitle] = headline[status] ?? [statusLabel(status), ''];
  const live = !['delivered', 'cancelled'].includes(status);
  const rider = order.rider;

  return (
    <Screen>
      <View>
        <RouteMap pickupLabel={order.vendor?.name ?? 'Pickup'} dropoffLabel={order.type === 'dispatch' ? (order.receiver?.name ?? 'Drop-off') : 'You'} progress={rider ? progress : undefined} height={260} />
        {live ? (
          <View style={[styles.live, { backgroundColor: colors.surface }]}>
            <View style={[styles.liveDot, { backgroundColor: colors.danger }]} />
            <Text variant="caption" color="danger">
              LIVE
            </Text>
            <Text variant="caption" color="heading">
              {statusLabel(status)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ gap: 2 }}>
        <Text variant="heading">{title}</Text>
        {subtitle ? <Text color="muted">{subtitle}</Text> : null}
      </View>

      {status !== 'cancelled' ? (
        <Card>
          <View style={styles.steps}>
            {trackingSteps.map((step, i) => {
              const Icon = stepIcons[i];
              const on = i < done;
              return (
                <View key={step.status} style={styles.step}>
                  {i > 0 ? <View style={[styles.bar, { backgroundColor: on ? colors.primary : colors.line }]} /> : null}
                  <View style={[styles.stepIcon, { backgroundColor: on ? colors.primary : colors.surfaceAlt }]}>
                    <Icon size={18} color={on ? colors.onPrimary : colors.subtle} />
                  </View>
                  <Text variant="caption" color={on ? 'heading' : 'subtle'} center>
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
          {moving && tracking?.distanceMeters !== undefined ? (
            <View style={[styles.stats, { backgroundColor: colors.primarySoft }]}>
              <Stat value={formatDistance(tracking.distanceMeters)} label="Distance left" />
              <View style={[styles.statRule, { backgroundColor: colors.line }]} />
              <Stat value={`${tracking.etaMinutes ?? '–'} min`} label="Arriving in" />
            </View>
          ) : null}
        </Card>
      ) : null}

      {order.deliveryCode && live ? (
        <Card style={{ alignItems: 'center' }}>
          <Text variant="eyebrow">Delivery code</Text>
          <Text variant="display" color="primary" style={{ letterSpacing: 10 }} accessibilityLabel={`Delivery code ${order.deliveryCode.split('').join(' ')}`}>
            {order.deliveryCode}
          </Text>
          <Text variant="small" color="muted" center>
            Give this to {order.receiver?.name ?? 'the receiver'}. The rider must enter it to complete the delivery — only share it when the package has arrived.
          </Text>
          <Button
            title="Share code"
            variant="secondary"
            icon={<Share2 size={18} color={colors.heading} />}
            onPress={() => Share.share({ message: `Your Vendo delivery code is ${order.deliveryCode}. Give it to the rider only when your package arrives. Order ${order.code}.` })}
          />
        </Card>
      ) : null}

      {rider ? (
        <Card style={styles.rider}>
          <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
            <Text variant="heading" color="primary">
              {rider.name.slice(0, 1)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text variant="bodyMedium" color="heading">
                {rider.name}
              </Text>
              {rider.rating ? (
                <>
                  <Star size={13} color={colors.warning} fill={colors.warning} />
                  <Text variant="small" color="heading">
                    {rider.rating.toFixed(1)}
                  </Text>
                </>
              ) : null}
            </View>
            <Text variant="small" color="muted">
              Your rider · {rider.plateNumber}
            </Text>
          </View>
          {canChat(status) ? (
            <>
              <IconButton icon={Phone} label={`Call ${rider.name}`} tone="soft" onPress={() => Linking.openURL(`tel:${rider.phone}`)} />
              <View>
                <IconButton
                  icon={MessageCircle}
                  label={unread ? `Chat with ${rider.name}, ${unread} new message${unread === 1 ? '' : 's'}` : `Chat with ${rider.name}`}
                  tone="soft"
                  onPress={() => router.push({ pathname: '/order/[id]/chat', params: { id } })}
                />
                {unread > 0 ? (
                  <View style={[styles.unread, { backgroundColor: colors.danger, borderColor: colors.surface }]}>
                    <Text variant="caption" style={{ color: '#fff', fontSize: 11, lineHeight: 14 }} maxFontSizeMultiplier={1}>
                      {unread > 9 ? '9+' : unread}
                    </Text>
                  </View>
                ) : null}
              </View>
            </>
          ) : null}
        </Card>
      ) : null}

      {status === 'delivered' && !order.rating ? <Button title="Rate your delivery" onPress={() => setRating(true)} /> : null}
      <Button title="View order details" variant="secondary" onPress={() => router.push({ pathname: '/order/[id]', params: { id } })} />
      {canCancel(status) ? <Button title="Cancel order" variant="ghost" loading={cancelling.busy} onPress={cancelling.start} /> : null}
      {cancelling.error ? <Text color="danger">{cancelling.error}</Text> : null}

      <RatingSheet visible={rating} riderName={rider?.name} loading={rate.isPending} onClose={() => setRating(false)} onSubmit={(stars, comment) => rate.mutate({ id, rating: stars, comment }, { onSuccess: () => setRating(false) })} />
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text variant="bodyMedium" color="heading">
        {value}
      </Text>
      <Text variant="caption" color="muted">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  live: { position: 'absolute', top: spacing.md, left: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  steps: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  stepIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  // connector from the previous step's icon to this one (stops at both icons' edges)
  bar: { position: 'absolute', top: 18, left: '-50%', right: '50%', marginHorizontal: 20, height: 4, borderRadius: 2 },
  stats: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, marginTop: spacing.sm },
  statRule: { width: 1, height: 28 },
  rider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  unread: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
