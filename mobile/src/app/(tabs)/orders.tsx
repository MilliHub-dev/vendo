import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { useOrders } from '@/api/queries';
import { OrderCard } from '@/components/OrderCard';
import { Button, EmptyState, Screen, Segmented, Text } from '@/components/ui';
import { isActive } from '@/lib/order-status';
import { spacing, useTheme } from '@/theme';

export default function OrdersScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<'active' | 'past'>('active');
  const orders = useOrders(filter);

  return (
    <Screen safeTop>
      <Text variant="title">Orders</Text>
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'active', label: 'Active' },
          { value: 'past', label: 'Past' },
        ]}
      />
      {orders.isPending ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : orders.data?.length ? (
        orders.data.map((o) => (
          <OrderCard key={o.id} order={o} onPress={() => router.push({ pathname: isActive(o.status) && o.status !== 'scheduled' ? '/order/[id]/track' : '/order/[id]', params: { id: o.id } })} />
        ))
      ) : (
        <EmptyState
          art={require('@/assets/images/art-boxes.png')}
          title={filter === 'active' ? 'Nothing on the way' : 'No past orders yet'}
          description={filter === 'active' ? 'Order food or send a package and you can follow it here, live.' : 'Completed and cancelled orders will be listed here.'}
          action={filter === 'active' ? <Button title="Order food" onPress={() => router.push('/')} /> : undefined}
        />
      )}
    </Screen>
  );
}
