import { Bell } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useNotifications } from '@/api/queries';
import { Screen, Text } from '@/components/ui';
import { formatDateTime } from '@/lib/dates';
import { radius, spacing, useTheme } from '@/theme';

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { data, isPending } = useNotifications();

  return (
    <Screen>
      {isPending ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /> : null}
      {data?.map((n) => (
        <View key={n.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
            <Bell size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyMedium" color="heading">
              {n.title}
            </Text>
            <Text variant="small" color="muted">
              {n.body}
            </Text>
            <Text variant="caption" color="subtle">
              {formatDateTime(n.createdAt)}
            </Text>
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
