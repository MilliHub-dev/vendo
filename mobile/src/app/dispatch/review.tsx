import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useCreateOrder, useQuote } from '@/api/queries';
import type { PaymentMethod } from '@/api/types';
import { RouteMap } from '@/components/RouteMap';
import { paymentLabels, PaymentSheet } from '@/components/sheets';
import { Button, Card, Row, Screen, Text } from '@/components/ui';
import { formatDateTime } from '@/lib/dates';
import { formatDistance } from '@/lib/geo';
import { formatNaira } from '@/lib/money';
import { packageSizes, useDispatchDraft } from '@/store/dispatch';
import { radius, spacing, useTheme } from '@/theme';

/** The fare, shown before anything is charged. The server's quote is the price. */
export default function DispatchReviewScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { draft, setDraft, resetForm } = useDispatchDraft();
  const [payment, setPayment] = useState<PaymentMethod>('wallet');
  const [paySheet, setPaySheet] = useState(false);
  const createOrder = useCreateOrder();
  const request = draft ? ({ type: 'dispatch', pickup: draft.pickup, dropoff: draft.dropoff, packageSize: draft.packageSize, packageNote: draft.packageNote, fragile: draft.fragile, receiver: draft.receiver } as const) : null;
  const quote = useQuote(request);

  if (!draft) return createOrder.isSuccess ? null : <Redirect href="/send" />;
  const size = packageSizes.find((s) => s.value === draft.packageSize)!;

  const submit = () =>
    createOrder.mutate(
      { ...request!, scheduledFor: draft.scheduledFor ?? undefined, paymentMethod: payment },
      {
        onSuccess: (order) => {
          router.dismissTo('/');
          // not paid (payment page closed, or wallet short): open the order, where it can be paid
          router.push({ pathname: order.isPaid === false ? '/order/[id]' : '/order/[id]/track', params: { id: order.id } });
          setDraft(null);
          resetForm();
        },
      },
    );

  return (
    <Screen footer={<Button title={quote.data ? `Confirm & pay · ${formatNaira(quote.data.totalKobo)}` : 'Confirm & pay'} disabled={!quote.data} loading={createOrder.isPending} onPress={submit} />}>
      <RouteMap pickupLabel={draft.pickup.address.split(',')[0]} dropoffLabel={draft.dropoff.address.split(',')[0]} height={190} />

      <Card>
        <Text variant="caption" color="subtle">
          Pick up from
        </Text>
        <Text variant="bodyMedium">{draft.pickup.address}</Text>
        <View style={[styles.rule, { backgroundColor: colors.line }]} />
        <Text variant="caption" color="subtle">
          Deliver to
        </Text>
        <Text variant="bodyMedium">{draft.dropoff.address}</Text>
      </Card>

      <Card>
        <Row label="Package" value={`${size.emoji} ${size.label}`} />
        <Row label="Item" value={draft.packageNote + (draft.fragile ? ' · fragile' : '')} />
        <Row label="Receiver" value={draft.receiver.name} />
        <Row label="Receiver’s phone" value={draft.receiver.phone} />
        <Row label="When" value={draft.scheduledFor ? formatDateTime(draft.scheduledFor) : 'Now'} />
      </Card>

      <Text variant="heading">Price</Text>
      <Card>
        {quote.isPending ? (
          <ActivityIndicator color={colors.primary} />
        ) : quote.isError ? (
          <Text color="danger">{quote.error.message}</Text>
        ) : (
          <>
            <Row label="Distance" value={formatDistance(quote.data.distanceMeters)} />
            <Row label="Estimated delivery time" value={`${quote.data.etaMinutes} min`} />
            <Row label={`Delivery fee (${size.label.toLowerCase()})`} value={formatNaira(quote.data.deliveryFeeKobo)} />
            {quote.data.discountKobo ? <Row label={quote.data.discountLabel ?? 'Discount'} value={`− ${formatNaira(quote.data.discountKobo)}`} /> : null}
            <View style={[styles.rule, { backgroundColor: colors.line }]} />
            <Row label="Total" value={formatNaira(quote.data.totalKobo)} strong />
          </>
        )}
      </Card>

      <Text variant="heading">Payment method</Text>
      <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Text variant="bodyMedium" style={{ flex: 1 }}>
          {paymentLabels[payment]}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Change payment method" onPress={() => setPaySheet(true)} style={[styles.change, { backgroundColor: colors.primary }]}>
          <Text variant="smallMedium" color="onPrimary">
            Change
          </Text>
        </Pressable>
      </View>
      {createOrder.isError ? <Text color="danger">{createOrder.error.message}</Text> : null}
      <Text variant="small" color="subtle" center>
        You’ll get a delivery code to share with the receiver. The rider needs it to complete the delivery. By booking you confirm the package fits the size you chose and contains nothing illegal, dangerous or prohibited.
      </Text>

      <PaymentSheet visible={paySheet} value={payment} totalKobo={quote.data?.totalKobo} onClose={() => setPaySheet(false)} onChange={setPayment} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  rule: { height: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
  change: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
});
