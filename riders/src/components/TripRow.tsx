import { ChevronRight, Package, UtensilsCrossed } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Trip } from '@/api/types';
import { formatTime } from '@/lib/dates';
import { formatDistance } from '@/lib/geo';
import { formatNaira } from '@/lib/money';
import { radius, spacing, useTheme } from '@/theme';

import { Text } from './ui';

export function TripRow({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  const { colors } = useTheme();
  const Icon = trip.type === 'food' ? UtensilsCrossed : Package;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${trip.title}, earned ${formatNaira(trip.earningKobo)}`} onPress={onPress} style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: colors.line }, pressed && { opacity: 0.85 }]}>
      <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
        <Icon size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium" color="heading" numberOfLines={1}>
          {trip.title}
        </Text>
        <Text variant="small" color="muted" numberOfLines={1}>
          {formatTime(new Date(trip.completedAt))} · {formatDistance(trip.distanceM)} · {trip.code}
        </Text>
      </View>
      <Text variant="bodyMedium" color="success">
        +{formatNaira(trip.earningKobo)}
      </Text>
      <ChevronRight size={16} color={colors.subtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
