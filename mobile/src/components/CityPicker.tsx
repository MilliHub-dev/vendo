import { ActivityIndicator, View } from 'react-native';

import { useCities, useSetCity } from '@/api/queries';
import { useCart } from '@/store/cart';
import { useCity } from '@/store/city';
import { spacing, useTheme } from '@/theme';

import { Button, OptionRow, Sheet, Text } from './ui';

/**
 * Choose the city to order in. Vendors, fares and the delivery area all depend on it,
 * so changing city empties the cart. With `required` it can't be closed without choosing.
 */
export function CityPicker({ visible, required, onClose }: { visible: boolean; required?: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const cities = useCities();
  const setCity = useSetCity();
  const current = useCity((s) => s.city);
  const clearCart = useCart((s) => s.clear);

  return (
    <Sheet visible={visible} onClose={required ? () => {} : onClose} title="Where are you ordering?">
      <Text color="muted">We show the vendors and delivery prices for your city.</Text>
      {cities.isPending ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} /> : null}
      {cities.isError ? (
        <>
          <Text color="danger">{cities.error.message}</Text>
          <Button title="Try again" variant="secondary" onPress={() => cities.refetch()} />
        </>
      ) : null}
      {cities.data?.length === 0 ? <Text color="muted">Vendo isn’t live in any city yet. Please check back soon.</Text> : null}
      <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
        {cities.data?.map((c) => (
          <OptionRow
            key={c.id}
            title={c.name}
            subtitle={c.isOpen === false ? 'Closed right now — you can still browse' : undefined}
            selected={current?.id === c.id}
            onPress={() => {
              if (current && current.id !== c.id) clearCart();
              setCity.mutate(c);
              onClose();
            }}
          />
        ))}
      </View>
    </Sheet>
  );
}
