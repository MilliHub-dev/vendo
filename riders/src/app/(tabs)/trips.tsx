import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useTrips } from '@/api/queries';
import type { Trip } from '@/api/types';
import { TripRow } from '@/components/TripRow';
import { EmptyState, Screen, Text } from '@/components/ui';
import { dayLabel } from '@/lib/dates';
import { formatNaira } from '@/lib/money';
import { spacing, useTheme } from '@/theme';

export default function TripsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const trips = useTrips();

  // group by day, newest first
  const days: { label: string; trips: Trip[] }[] = [];
  for (const t of trips.data ?? []) {
    const label = dayLabel(new Date(t.completedAt));
    const last = days[days.length - 1];
    if (last?.label === label) last.trips.push(t);
    else days.push({ label, trips: [t] });
  }

  return (
    <Screen safeTop>
      <Text variant="title">Trips</Text>
      {trips.isPending ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /> : null}
      {trips.data?.length === 0 ? <EmptyState art={require('@/assets/images/art-boxes.png')} title="No trips yet" description="Go online from Home and your completed deliveries will be listed here." /> : null}
      {days.map((day) => (
        <View key={day.label} style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="smallMedium" color="muted">
              {day.label} · {day.trips.length} trip{day.trips.length === 1 ? '' : 's'}
            </Text>
            <Text variant="smallMedium" color="heading">
              {formatNaira(day.trips.reduce((n, t) => n + t.earningKobo, 0))}
            </Text>
          </View>
          {day.trips.map((t) => (
            <TripRow key={t.id} trip={t} onPress={() => router.push({ pathname: '/trip/[id]', params: { id: t.id } })} />
          ))}
        </View>
      ))}
    </Screen>
  );
}
