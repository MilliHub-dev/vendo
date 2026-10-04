import { Image, type ImageSource } from 'expo-image';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { spacing } from '@/theme';

import { Text } from './Text';

export function EmptyState({ art, title, description, action }: { art: ImageSource | number; title: string; description: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl }}>
      <Image source={art} style={{ width: 200, height: 170 }} contentFit="contain" />
      <Text variant="title" center>
        {title}
      </Text>
      <Text color="muted" center>
        {description}
      </Text>
      {action ? <View style={{ marginTop: spacing.sm, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}
