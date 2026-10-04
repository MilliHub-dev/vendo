import { useRouter } from 'expo-router';
import { Compass } from 'lucide-react-native';
import { View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

export default function NotFoundScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Screen scroll={false} contentStyle={{ alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}>
      <Compass size={40} color={colors.primary} />
      <View style={{ gap: spacing.xs }}>
        <Text variant="title" center>
          This screen doesn&apos;t exist
        </Text>
        <Text color="muted" center>
          Even our best riders couldn&apos;t find it.
        </Text>
      </View>
      <Button title="Back to home" onPress={() => router.replace('/')} />
    </Screen>
  );
}
