import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';

import { Button, Screen, Text } from '@/components/ui';
import { formatNaira } from '@/lib/money';
import { spacing, useTheme } from '@/theme';

export default function JobDoneScreen() {
  const { earning, title, code } = useLocalSearchParams<{ earning: string; title: string; code: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Screen safeTop scroll={false} contentStyle={{ alignItems: 'center', justifyContent: 'center', gap: spacing.md }} footer={<Button title="Back to home" onPress={() => router.dismissTo('/')} />}>
      <Image source={require('@/assets/images/art-rider.png')} style={{ width: 220, height: 180 }} contentFit="contain" />
      <CircleCheck size={44} color={colors.success} />
      <Text variant="display" center>
        Delivery complete
      </Text>
      <Text color="muted" center>
        {title} · {code}
      </Text>
      {earning ? (
        <>
          <Text variant="eyebrow">You earned</Text>
          <Text variant="display" color="primary" style={{ fontSize: 44, lineHeight: 50 }}>
            {formatNaira(Number(earning))}
          </Text>
        </>
      ) : null}
      <Text variant="small" color="subtle" center>
        {earning ? 'Added to your Vendo balance.' : 'Your earning is being added to your Vendo balance.'} You’re back online for new orders.
      </Text>
    </Screen>
  );
}
