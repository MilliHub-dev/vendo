import { useRouter } from 'expo-router';
import { MapPin, Plus, Trash2 } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, EmptyState, Screen, Text } from '@/components/ui';
import { useAddresses } from '@/store/addresses';
import { confirm } from '@/store/confirm';
import { radius, spacing, useTheme } from '@/theme';

export default function AddressesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { addresses, remove } = useAddresses();
  const add = <Button title="Add address" icon={<Plus size={18} color={colors.onPrimary} />} onPress={() => router.push('/addresses/pick')} />;

  if (addresses.length === 0) {
    return (
      <Screen>
        <EmptyState art={require('@/assets/images/art-parcel.png')} title="No saved addresses" description="Save home, the office and other places so ordering takes one tap." action={add} />
      </Screen>
    );
  }

  return (
    <Screen footer={add}>
      {addresses.map((a) => (
        <View key={a.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
            <MapPin size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium" color="heading">
              {a.label}
            </Text>
            <Text variant="small" color="muted">
              {a.address}
            </Text>
            {a.note ? (
              <Text variant="small" color="subtle">
                {a.note}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${a.label}`}
            hitSlop={8}
            onPress={() => confirm({ title: `Delete “${a.label}”?`, message: a.address, confirmLabel: 'Delete address', cancelLabel: 'Keep it', destructive: true, onConfirm: () => remove(a.id) })}
            style={[styles.trash, { backgroundColor: colors.surfaceAlt }]}>
            <Trash2 size={18} color={colors.danger} />
          </Pressable>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  trash: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
