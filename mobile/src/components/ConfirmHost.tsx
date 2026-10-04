import { View } from 'react-native';

import { useConfirm } from '@/store/confirm';
import { spacing, useTheme } from '@/theme';

import { Button, Sheet, Text } from './ui';

/** Renders the app-wide confirmation sheet (see store/confirm.ts). Mounted once in the root layout. */
export function ConfirmHost() {
  const { colors } = useTheme();
  const current = useConfirm((s) => s.current);
  const close = useConfirm((s) => s.close);
  return (
    <Sheet visible={!!current} onClose={close} title={current?.title}>
      <Text color="muted">{current?.message}</Text>
      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        <Button
          title={current?.confirmLabel ?? 'Confirm'}
          style={current?.destructive ? { backgroundColor: colors.danger, boxShadow: 'none' } : undefined}
          onPress={() => {
            current?.onConfirm();
            close();
          }}
        />
        <Button title={current?.cancelLabel ?? 'Not now'} variant="secondary" onPress={close} />
      </View>
    </Sheet>
  );
}
