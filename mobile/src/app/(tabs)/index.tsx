import { useRouter } from 'expo-router';
import { Bell, ChevronDown, MapPin, Search, SlidersHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useMe, usePicks, useVendors } from '@/api/queries';
import type { VendorCategory } from '@/api/types';
import { PromoCarousel } from '@/components/PromoCarousel';
import { ItemTile, VendorTile } from '@/components/Tiles';
import { IconButton, Screen, SectionHeader, Text } from '@/components/ui';
import { useAddToCart } from '@/lib/use-add-to-cart';
import { useAddresses } from '@/store/addresses';
import { radius, shadows, spacing, useTheme } from '@/theme';

const categories: { value: VendorCategory | undefined; label: string; emoji: string }[] = [
  { value: undefined, label: 'All', emoji: '🍽️' },
  { value: 'restaurant', label: 'Restaurants', emoji: '🍛' },
  { value: 'fast_food', label: 'Fast food', emoji: '🍢' },
  { value: 'drinks', label: 'Drinks', emoji: '🥤' },
  { value: 'groceries', label: 'Groceries', emoji: '🛒' },
  { value: 'pharmacy', label: 'Pharmacy', emoji: '💊' },
];

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const me = useMe();
  const [category, setCategory] = useState<VendorCategory | undefined>(undefined);
  const vendors = useVendors(category);
  const picks = usePicks();
  const addToCart = useAddToCart();
  const home = useAddresses((s) => s.addresses[0]);
  const openVendor = (id: string) => router.push({ pathname: '/vendor/[id]', params: { id } });

  return (
    <Screen safeTop bleed contentStyle={{ gap: spacing.xl }}>
      <View style={styles.pad}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Delivery address" onPress={() => router.push('/addresses')} style={{ flex: 1 }}>
            <Text variant="caption" color="subtle">
              Deliver to
            </Text>
            <View style={styles.location}>
              <MapPin size={16} color={colors.primary} />
              <Text variant="bodyMedium" color="heading" numberOfLines={1} style={{ flexShrink: 1 }}>
                {home ? home.address : 'Set your address'}
              </Text>
              <ChevronDown size={16} color={colors.heading} />
            </View>
          </Pressable>
          <IconButton icon={Bell} label="Notifications" onPress={() => router.push('/notifications')} />
        </View>

        <Text variant="title">Hi {me.data?.name.split(' ')[0] ?? 'there'} 👋</Text>

        <View style={styles.searchRow}>
          <Pressable accessibilityRole="search" onPress={() => router.push('/search')} style={[styles.search, shadows.card, { backgroundColor: colors.surface }]}>
            <Search size={20} color={colors.subtle} />
            <Text color="subtle">Search food, vendors…</Text>
          </Pressable>
          <IconButton icon={SlidersHorizontal} label="Filters" size={52} onPress={() => router.push('/search')} />
        </View>
      </View>

      <PromoCarousel />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
        {categories.map((c) => {
          const on = c.value === category;
          return (
            <Pressable
              key={c.label}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setCategory(c.value)}
              style={[styles.cat, { backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.line }]}>
              <View style={[styles.catIcon, { backgroundColor: on ? 'rgba(255,255,255,0.22)' : colors.surfaceAlt }]}>
                <Text style={{ fontSize: 18, lineHeight: 24 }} maxFontSizeMultiplier={1}>
                  {c.emoji}
                </Text>
              </View>
              <Text variant="smallMedium" color={on ? 'onPrimary' : 'heading'}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ gap: spacing.md }}>
        <View style={styles.pad}>
          <SectionHeader title="Popular near you" action="See all" onAction={() => router.push('/search')} />
        </View>
        {vendors.isPending ? (
          <ActivityIndicator color={colors.primary} style={{ height: 220 }} />
        ) : vendors.isError ? (
          <Text color="danger" style={styles.pad}>
            Couldn’t load vendors. Check your connection.
          </Text>
        ) : vendors.data.length === 0 ? (
          <Text color="muted" style={styles.pad}>
            No vendors in this category yet — more are joining soon.
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
            {vendors.data.map((v) => (
              <VendorTile key={v.id} vendor={v} onPress={() => openVendor(v.id)} />
            ))}
          </ScrollView>
        )}
      </View>

      <View style={{ gap: spacing.md }}>
        <View style={styles.pad}>
          <SectionHeader title="Picks for you" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
          {picks.data?.map((item) => (
            <ItemTile key={item.id} item={item} vendorName={item.vendorName} onPress={() => openVendor(item.vendorId)} onAdd={() => addToCart(item, item.vendorName)} />
          ))}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  location: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.lg, borderRadius: radius.pill },
  hscroll: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.sm },
  cat: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: 6, paddingRight: spacing.lg, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1 },
  catIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
