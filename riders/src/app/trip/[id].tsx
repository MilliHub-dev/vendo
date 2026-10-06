import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTrip } from '@/api/queries';
import { RouteMap } from '@/components/RouteMap';
import { Badge, Card, Row, Screen, Text } from '@/components/ui';
import { formatDateTime } from '@/lib/dates';
import { formatDistance } from '@/lib/geo';
import { formatNaira } from '@/lib/money';
import { spacing, useTheme } from '@/theme';

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { data: trip, isPending } = useTrip(id);
  if (isPending || !trip) return <Screen scroll={false}>{isPending ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} /> : <Text color="danger">Trip not found.</Text>}</Screen>;

  return (
    <Screen>
      {trip.pickup && trip.dropoff ? <RouteMap pickupLabel={trip.pickup.split(',')[0]} dropoffLabel={trip.dropoff.split(',')[0]} height={180} /> : null}
      <View style={{ gap: 6 }}>
        <Text variant="title">{trip.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Badge label="Delivered" tone="success" />
          <Text variant="small" color="muted">
            {trip.type ? `${trip.type === 'food' ? 'Food order' : 'Dispatch'} · ` : ''}
            {trip.code} · {formatDateTime(trip.completedAt)}
          </Text>
        </View>
      </View>
      {trip.pickup && trip.dropoff ? (
        <Card>
          <Text variant="caption" color="subtle">
            PICKED UP FROM
          </Text>
          <Text variant="bodyMedium">{trip.pickup}</Text>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: spacing.xs }} />
          <Text variant="caption" color="subtle">
            DELIVERED TO
          </Text>
          <Text variant="bodyMedium">{trip.dropoff}</Text>
        </Card>
      ) : null}
      <Card>
        {trip.distanceM !== undefined ? <Row label="Distance" value={formatDistance(trip.distanceM)} /> : null}
        <Row label="You earned" value={formatNaira(trip.earningKobo)} strong />
      </Card>
    </Screen>
  );
}
