import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';
import { View } from 'react-native';

import { useOrder } from '@/api/queries';
import { Button, Screen, Text } from '@/components/ui';
import { formatDateTime } from '@/lib/dates';
import { formatNaira } from '@/lib/money';
import { spacing, useTheme } from '@/theme';

export default function OrderPlacedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const { data: order } = useOrder(id);
  const scheduled = order?.status === 'scheduled';

  return (
    <Screen
      safeTop
      scroll={false}
      contentStyle={{ alignItems: 'center', justifyContent: 'center', gap: spacing.md }}
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button title={scheduled ? 'View order' : 'Track order'} onPress={() => router.replace({ pathname: scheduled ? '/order/[id]' : '/order/[id]/track', params: { id } })} />
          <Button title="Back to home" variant="ghost" onPress={() => router.dismissTo('/')} />
        </View>
      }>
      <Image source={require('@/assets/images/art-rider.png')} style={{ width: 240, height: 200 }} contentFit="contain" />
      <CircleCheck size={44} color={colors.success} />
      <Text variant="display" center>
        Order placed!
      </Text>
      <Text color="muted" center>
        {scheduled && order?.scheduledFor
          ? `Scheduled for ${formatDateTime(order.scheduledFor)}. We’ll find a rider shortly before.`
          : `${order?.vendor?.name ?? 'The vendor'} has your order and we’re finding the nearest rider.`}
      </Text>
      {order ? (
        <Text variant="bodyMedium" color="heading" center>
          {order.code} · {formatNaira(order.totalKobo)}
        </Text>
      ) : null}
    </Screen>
  );
}
