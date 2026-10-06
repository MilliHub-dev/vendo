import { useRouter } from 'expo-router';
import { CircleDot, MapPin, Package, UtensilsCrossed } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useJob, useOffer, useRespondToOffer } from '@/api/queries';
import type { Offer } from '@/api/types';
import { formatDistance } from '@/lib/geo';
import { formatNaira } from '@/lib/money';
import { useSession } from '@/store/session';
import { radius, spacing, useTheme } from '@/theme';

import { Badge, Button, Text } from './ui';

/**
 * The incoming-order popup. Mounted once at the root, so an offer appears over whatever
 * screen the rider is on while they're online and free. The countdown runs from the
 * server's `expiresAt`, never from a timer started on the phone.
 */
export function OfferHost() {
  const online = useSession((s) => s.rider?.approval === 'approved' && s.rider.presence === 'online');
  const job = useJob();
  const offer = useOffer(online && !job.data);
  return offer.data && online ? <OfferModal key={offer.data.id} offer={offer.data} /> : null;
}

function OfferModal({ offer }: { offer: Offer }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const respond = useRespondToOffer();
  const [now, setNow] = useState(() => Date.now());
  const expires = new Date(offer.expiresAt).getTime();
  const total = 30;
  const left = Math.max(0, Math.ceil((expires - now) / 1000));

  useEffect(() => {
    if (Platform.OS !== 'web') Vibration.vibrate([0, 400, 200, 400]);
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, []);

  if (left <= 0) return null; // timed out — the next poll clears it

  const Icon = offer.type === 'food' ? UtensilsCrossed : Package;
  const urgent = left <= 10;

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={() => undefined}>
      <View style={styles.backdrop}>
        <View style={[styles.panel, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]} accessibilityViewIsModal>
          <View style={styles.top}>
            <View style={[styles.type, { backgroundColor: colors.primarySoft }]}>
              <Icon size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="heading" accessibilityRole="header">
                New {offer.type === 'food' ? 'food order' : 'dispatch'}
              </Text>
              <Text variant="small" color="muted" numberOfLines={1}>
                {offer.summary}
              </Text>
            </View>
            <View style={[styles.timer, { borderColor: urgent ? colors.danger : colors.primary }]} accessibilityLabel={`${left} seconds left to accept`} accessibilityLiveRegion="polite">
              <Text variant="heading" color={urgent ? 'danger' : 'primary'} maxFontSizeMultiplier={1.2}>
                {left}
              </Text>
            </View>
          </View>
          <View style={[styles.track, { backgroundColor: colors.line }]}>
            <View style={[styles.fill, { width: `${(left / total) * 100}%`, backgroundColor: urgent ? colors.danger : colors.primary }]} />
          </View>

          <View style={[styles.earn, { backgroundColor: colors.surfaceAlt }]}>
            <View style={{ flex: 1 }}>
              <Text variant="small" color="muted">
                {offer.earningKobo !== undefined ? 'You’ll earn' : offer.type === 'food' ? 'Food delivery' : 'Package delivery'}
              </Text>
              <Text variant={offer.earningKobo !== undefined ? 'display' : 'heading'} color="primary">
                {offer.earningKobo !== undefined ? formatNaira(offer.earningKobo) : offer.summary}
              </Text>
            </View>
            <Badge label={`${formatDistance(offer.tripDistanceM)} trip`} tone="muted" />
          </View>

          <View style={{ gap: spacing.md }}>
            <Stop icon={<CircleDot size={18} color={colors.primary} />} label={`Pickup · ${formatDistance(offer.distanceToPickupM)} away`} address={offer.pickup.address} />
            <Stop icon={<MapPin size={18} color={colors.primary} />} label="Drop-off" address={offer.dropoff.address} />
          </View>

          {respond.isError ? <Text color="danger">{respond.error.message}</Text> : null}
          <View style={styles.actions}>
            <Button title="Reject" variant="secondary" style={{ flex: 1 }} disabled={respond.isPending} onPress={() => respond.mutate({ id: offer.id, action: 'reject' })} />
            <Button
              title="Accept"
              style={{ flex: 2 }}
              loading={respond.isPending && respond.variables?.action === 'accept'}
              disabled={respond.isPending}
              onPress={() => respond.mutate({ id: offer.id, action: 'accept' }, { onSuccess: (job) => job && router.push('/job') })}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Stop({ icon, label, address }: { icon: React.ReactNode; label: string; address: string }) {
  return (
    <View style={styles.stop}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text variant="caption" color="subtle">
          {label}
        </Text>
        <Text variant="bodyMedium" color="heading" numberOfLines={2}>
          {address}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(6, 13, 34, 0.6)' },
  panel: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.lg },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  type: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  timer: { width: 52, height: 52, borderRadius: 26, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  earn: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg },
  stop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
