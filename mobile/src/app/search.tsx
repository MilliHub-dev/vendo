import { useRouter } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { useSearch, useVendors } from '@/api/queries';
import { MenuRow, VendorRow } from '@/components/Tiles';
import { Chip, Input, Screen, SectionHeader, Text } from '@/components/ui';
import { useAddToCart } from '@/lib/use-add-to-cart';
import { spacing, useTheme } from '@/theme';

const suggestions = ['Jollof', 'Suya', 'Masa', 'Zobo', 'Rice', 'Smoothie'];

export default function SearchScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const results = useSearch(query);
  const all = useVendors();
  const addToCart = useAddToCart();
  const open = (id: string) => router.push({ pathname: '/vendor/[id]', params: { id } });
  const searching = query.trim().length > 1;

  return (
    <Screen>
      <Input
        placeholder="Search food, vendors…"
        value={query}
        onChangeText={setQuery}
        autoFocus
        autoCorrect={false}
        returnKeyType="search"
        left={<Search size={20} color={colors.subtle} />}
        right={
          query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={10}>
              <X size={18} color={colors.subtle} />
            </Pressable>
          ) : null
        }
      />

      {!searching ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {suggestions.map((s) => (
              <Chip key={s} label={s} onPress={() => setQuery(s)} />
            ))}
          </View>
          <SectionHeader title="All vendors" />
          {all.data?.map((v) => (
            <VendorRow key={v.id} vendor={v} onPress={() => open(v.id)} />
          ))}
        </>
      ) : results.isPending ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : results.data && results.data.vendors.length + results.data.items.length === 0 ? (
        <Text color="muted" center style={{ marginTop: spacing.xl }}>
          Nothing found for “{query.trim()}”. Try another dish or vendor name.
        </Text>
      ) : (
        <>
          {results.data?.vendors.length ? <SectionHeader title="Vendors" /> : null}
          {results.data?.vendors.map((v) => (
            <VendorRow key={v.id} vendor={v} onPress={() => open(v.id)} />
          ))}
          {results.data?.items.length ? <SectionHeader title="Dishes" /> : null}
          {results.data?.items.map((item) => (
            <View key={item.id} style={{ gap: 4 }}>
              <MenuRow item={item} onPress={() => open(item.vendorId)} onAdd={() => addToCart(item, item.vendorName)} />
              <Text variant="caption" color="subtle" style={{ marginLeft: spacing.sm }}>
                from {item.vendorName}
              </Text>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}
