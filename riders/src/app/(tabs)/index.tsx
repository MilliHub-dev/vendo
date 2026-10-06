import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Bell, ChevronRight, Navigation, Star } from 'lucide-react-native';
import { StyleSheet, Switch, View } from 'react-native';

import { useEarnings, useJob, useMe, useRider, useSetOnline, useTrips } from '@/api/queries';
import { TripRow } from '@/components/TripRow';
import { Card, IconButton, Screen, SectionHeader, Text } from '@/components/ui';
import { hasBackgroundPermission } from '@/lib/location';
import { formatNaira } from '@/lib/money';
import { palette, radius, shadows, spacing, useTheme } from '@/theme';

const jobStep = { rider_assigned: 'Head to the pickup', picked_up: 'Picked up — start the delivery', on_the_way: 'On the way to the drop-off', delivered: 'Delivered', cancelled: 'Cancelled' };

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const me = useMe();
  const rider = useRider();
  const job = useJob();
  const earnings = useEarnings();
  const trips = useTrips();
  const setOnline = useSetOnline();

  const presence = rider.data?.presence ?? 'offline';
  const online = presence !== 'offline';
  const busy = !!job.data;

  // without "allow all the time", the phone stops sharing location when the app leaves the screen and the server takes the rider offline
  const background = useQuery({ queryKey: ['background-location', online], queryFn: hasBackgroundPermission, enabled: online });

  return (
    <Screen safeTop>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text variant="title">Hi {me.data?.name.split(' ')[0] ?? 'there'} 👋</Text>
          <View style={styles.rating}>
            <Star size={14} color={colors.warning} fill={colors.warning} />
            <Text variant="small" color="muted">
              {rider.data?.rating ? `${rider.data.rating.toFixed(1)} · ` : ''}
              {rider.data?.plateNumber}
            </Text>
          </View>
        </View>
        <IconButton icon={Bell} label="Notifications" onPress={() => router.push('/notifications')} />
      </View>

      <View style={[styles.status, online ? [shadows.primary, { backgroundColor: palette.blue }] : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.dotRow}>
            <View style={[styles.dot, { backgroundColor: online ? '#7CFFB2' : colors.subtle }]} />
            <Text variant="heading" style={{ color: online ? '#fff' : colors.heading }}>
              {busy ? 'On a delivery' : online ? 'You’re online' : 'You’re offline'}
            </Text>
          </View>
          <Text variant="small" style={{ color: online ? 'rgba(255,255,255,0.85)' : colors.muted }}>
            {busy ? 'New orders pause until you finish.' : online ? 'Looking for orders near you…' : 'Go online to receive delivery requests.'}
          </Text>
          {online && !busy && background.data === false ? (
            <Text variant="small" style={{ color: '#fff' }}>
              Keep Vendo Rider open: location is only allowed while the app is on screen. Choose “Allow all the time” in your phone’s settings to stay online with the screen off.
            </Text>
          ) : null}
          {setOnline.isError ? (
            <Text variant="small" style={{ color: online ? '#fff' : colors.danger }}>
              {setOnline.error.message}
            </Text>
          ) : null}
        </View>
        <Switch
          accessibilityLabel={online ? 'Go offline' : 'Go online'}
          value={online}
          disabled={setOnline.isPending || busy}
          onValueChange={(next) => setOnline.mutate(next)}
          trackColor={{ true: 'rgba(255,255,255,0.35)', false: colors.line }}
          thumbColor="#fff"
          style={{ transform: [{ scale: 1.25 }] }}
        />
      </View>

      {job.data ? (
        <Card onPress={() => router.push('/job')} accessibilityLabel="Open current delivery" style={[styles.job, { borderColor: colors.primary }]}>
          <View style={[styles.jobIcon, { backgroundColor: colors.primary }]}>
            <Navigation size={18} color={colors.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="primary">
              CURRENT DELIVERY · {job.data.code}
            </Text>
            <Text variant="bodyMedium" color="heading">
              {jobStep[job.data.status]}
            </Text>
            <Text variant="small" color="muted" numberOfLines={1}>
              {job.data.status === 'rider_assigned' ? job.data.pickup.address : job.data.dropoff.address}
            </Text>
          </View>
          <ChevronRight size={18} color={colors.primary} />
        </Card>
      ) : null}

      <SectionHeader title="Today" action="Earnings" onAction={() => router.push('/earnings')} />
      <View style={styles.stats}>
        <Stat value={earnings.data ? formatNaira(earnings.data.today.earnedKobo) : '—'} label="Earned" accent />
        <Stat value={String(earnings.data?.today.trips ?? '—')} label="Trips" />
        <Stat value={earnings.data ? formatNaira(earnings.data.week.earnedKobo) : '—'} label="This week" />
      </View>

      <SectionHeader title="Recent trips" action={trips.data?.length ? 'See all' : undefined} onAction={() => router.push('/trips')} />
      {trips.data?.length === 0 ? <Text color="muted">Your completed deliveries will show here.</Text> : null}
      {trips.data?.slice(0, 3).map((t) => (
        <TripRow key={t.id} trip={t} onPress={() => router.push({ pathname: '/trip/[id]', params: { id: t.id } })} />
      ))}
    </Screen>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <Card style={styles.stat}>
      <Text variant="heading" color={accent ? 'primary' : 'heading'} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="caption" color="muted">
        {label}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.xl, borderRadius: radius.xl },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  job: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1.5 },
  jobIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, gap: 2, padding: spacing.md },
});
