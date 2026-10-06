import { Redirect, useRouter } from 'expo-router';
import { ChevronRight, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useCreateOrder, useQuote } from '@/api/queries';
import type { PaymentMethod, Place, QuoteRequest } from '@/api/types';
import { AddressSheet, paymentLabels, PaymentSheet, WhenPicker } from '@/components/sheets';
import { Button, Card, Input, Row, Screen, Text } from '@/components/ui';
import { cartCount } from '@/lib/cart';
import { formatNaira } from '@/lib/money';
import { useAddresses } from '@/store/addresses';
import { useCart } from '@/store/cart';
import { radius, spacing, useTheme } from '@/theme';

/** Checkout: address, delivery time, order summary, payment — after the reference. */
export default function CheckoutScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { lines, vendorId, vendorName, promo, setPromo, clear } = useCart();
  const firstSaved = useAddresses((s) => s.addresses[0]);
  const [dropoff, setDropoff] = useState<Place | null>(firstSaved ?? null);
  const [note, setNote] = useState(firstSaved?.note ?? '');
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>('wallet');
  const [sheet, setSheet] = useState<'address' | 'payment' | null>(null);
  const createOrder = useCreateOrder();

  const request: QuoteRequest | null =
    vendorId && dropoff ? { type: 'food', vendorId, items: lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, optionIds: l.optionIds, note: l.note })), dropoff: { ...dropoff, note: note.trim() || undefined }, promoCode: promo?.code } : null;
  const quote = useQuote(request);

  if (lines.length === 0 && !createOrder.isSuccess) return <Redirect href="/cart" />;

  const submit = () => {
    if (!request) return;
    createOrder.mutate(
      { ...request, paymentMethod: payment, scheduledFor: scheduledFor ?? undefined },
      {
        onSuccess: (order) => {
          clear();
          // not paid (payment page closed, or wallet short): go to the order, where it can be paid
          router.replace({ pathname: order.isPaid === false ? '/order/[id]' : '/order/[id]/placed', params: { id: order.id } });
        },
      },
    );
  };

  return (
    <Screen footer={<Button title={quote.data ? `Order now · ${formatNaira(quote.data.totalKobo)}` : 'Order now'} disabled={!quote.data} loading={createOrder.isPending} onPress={submit} />}>
      <Text variant="heading">Delivery address</Text>
      <Pressable accessibilityRole="button" onPress={() => setSheet('address')} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <MapPin size={18} color={colors.primary} />
        </View>
        <Text variant="bodyMedium" color={dropoff ? 'heading' : 'subtle'} style={{ flex: 1 }} numberOfLines={2}>
          {dropoff?.address ?? 'Choose where to deliver'}
        </Text>
        <ChevronRight size={18} color={colors.subtle} />
      </Pressable>
      <Input placeholder="Landmark or note for the rider (optional)" value={note} onChangeText={setNote} maxLength={140} />

      <Text variant="heading">Delivery time</Text>
      <WhenPicker value={scheduledFor} onChange={setScheduledFor} nowLabel="Deliver now" nowHint={quote.data ? `About ${quote.data.etaMinutes} min` : 'As soon as it’s ready'} />

      <Text variant="heading">Order summary</Text>
      <Card>
        <Text variant="small" color="muted">
          {vendorName} · {cartCount(lines)} items
        </Text>
        {lines.map((l) => (
          <Row key={l.key} label={`${l.quantity} × ${l.name}${l.options ? ` (${l.options})` : ''}`} value={formatNaira(l.unitPriceKobo * l.quantity)} />
        ))}
        <View style={[styles.rule, { backgroundColor: colors.line }]} />
        <Row label="Items subtotal" value={quote.data ? formatNaira(quote.data.subtotalKobo) : '—'} />
        <Row label="Delivery fee (bike)" value={quote.data ? formatNaira(quote.data.deliveryFeeKobo) : '—'} />
        {quote.data?.discountKobo ? <Row label={quote.data.discountLabel ?? 'Discount'} value={`− ${formatNaira(quote.data.discountKobo)}`} /> : null}
        <View style={[styles.rule, { backgroundColor: colors.line }]} />
        <Row label="Total" value={quote.data ? formatNaira(quote.data.totalKobo) : '—'} strong />
      </Card>

      <Text variant="heading">Payment method</Text>
      <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Text variant="bodyMedium" style={{ flex: 1 }}>
          {paymentLabels[payment]}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Change payment method" onPress={() => setSheet('payment')} style={[styles.change, { backgroundColor: colors.primary }]}>
          <Text variant="smallMedium" color="onPrimary">
            Change
          </Text>
        </Pressable>
      </View>

      {quote.isError ? (
        <>
          <Text color="danger">{quote.error.message}</Text>
          {promo ? <Button title={`Remove promo code ${promo.code}`} variant="secondary" onPress={() => setPromo(null)} /> : null}
        </>
      ) : null}
      {createOrder.isError ? <Text color="danger">{createOrder.error.message}</Text> : null}

      <AddressSheet
        visible={sheet === 'address'}
        title="Deliver to"
        onClose={() => setSheet(null)}
        onSelect={(p) => {
          setDropoff(p);
          setNote(p.note ?? '');
        }}
      />
      <PaymentSheet visible={sheet === 'payment'} value={payment} totalKobo={quote.data?.totalKobo} onClose={() => setSheet(null)} onChange={setPayment} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
  change: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
});
