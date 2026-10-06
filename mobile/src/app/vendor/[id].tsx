import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Bike, Clock, Star } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useVendor } from '@/api/queries';
import type { MenuItem } from '@/api/types';
import { ItemSheet } from '@/components/sheets';
import { MenuRow } from '@/components/Tiles';
import { Badge, Button, IconButton, Text, Thumb } from '@/components/ui';
import { cartCount, cartSubtotal } from '@/lib/cart';
import { formatNaira } from '@/lib/money';
import { needsChoice, useAddToCart } from '@/lib/use-add-to-cart';
import { useCart } from '@/store/cart';
import { spacing, useTheme } from '@/theme';

/** Vendor page: hero, rating line, menu category tabs, item rows and the item sheet — after the reference. */
export default function VendorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isPending, isError } = useVendor(id);
  const addToCart = useAddToCart();
  const lines = useCart((s) => s.lines);
  const cartVendor = useCart((s) => s.vendorId);
  const [tab, setTab] = useState('All');
  const [selected, setSelected] = useState<MenuItem | null>(null);

  if (isPending || isError) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        {isPending ? <ActivityIndicator color={colors.primary} /> : <Text color="danger">Couldn’t load this vendor.</Text>}
        {isError ? <Button title="Go back" variant="secondary" onPress={() => router.back()} /> : null}
      </View>
    );
  }

  const { vendor, menu } = data;
  const tabs = ['All', ...Array.from(new Set(menu.map((m) => m.category)))];
  const shown = tab === 'All' ? menu : menu.filter((m) => m.category === tab);
  const count = cartVendor === vendor.id ? cartCount(lines) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxl }} stickyHeaderIndices={[2]}>
        <View>
          <Thumb uri={vendor.imageUrl} emoji={vendor.emoji} size={220} emojiSize={96} rounded={0} style={{ width: '100%', height: 220 + insets.top }} />
          <View style={[styles.back, { top: insets.top + spacing.sm }]}>
            <IconButton icon={ArrowLeft} label="Back" onPress={() => router.back()} />
          </View>
          {vendor.emoji ? (
            <View style={[styles.avatar, { backgroundColor: colors.surface, borderColor: colors.bg }]}>
              <Text style={{ fontSize: 30, lineHeight: 38 }} maxFontSizeMultiplier={1}>
                {vendor.emoji}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.info, !vendor.emoji && { paddingTop: spacing.lg }]}>
          <View style={styles.titleRow}>
            <Text variant="title" style={{ flexShrink: 1 }}>
              {vendor.name}
            </Text>
            {vendor.rating >= 4.7 ? <Badge label="Top rated" /> : null}
            {!vendor.isOpen ? <Badge label="Closed" tone="danger" /> : null}
          </View>
          <Text color="muted">{vendor.cuisine}</Text>
          <View style={styles.meta}>
            <Star size={15} color={colors.warning} fill={colors.warning} />
            <Text variant="smallMedium" color="heading">
              {vendor.rating.toFixed(1)}
            </Text>
            <Text variant="small" color="muted">
              {vendor.ratingCount !== undefined ? `(${vendor.ratingCount} reviews) ` : ''}·
            </Text>
            <Clock size={14} color={colors.subtle} />
            <Text variant="small" color="muted">
              {vendor.etaMinutes[0]}–{vendor.etaMinutes[1]} min ·
            </Text>
            <Bike size={14} color={colors.primary} />
            <Text variant="small" color="primary">
              Bike delivery
            </Text>
          </View>
          <Text variant="small" color="muted">
            {vendor.deliveryFeeKobo !== undefined ? (
              <>
                Delivery fee:{' '}
                <Text variant="smallMedium" color="primary">
                  {formatNaira(vendor.deliveryFeeKobo)}
                </Text>{' '}
                ·{' '}
              </>
            ) : null}
            {vendor.address}
          </Text>
        </View>

        <View style={{ backgroundColor: colors.bg }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabs, { borderBottomColor: colors.line }]}>
            {tabs.map((t) => {
              const on = t === tab;
              return (
                <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setTab(t)} style={[styles.tab, on && { borderBottomColor: colors.primary }]}>
                  <Text variant="bodyMedium" color={on ? 'primary' : 'muted'}>
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.menu}>
          {shown.map((item) => (
            <MenuRow key={item.id} item={item} disabled={!vendor.isOpen} onPress={() => setSelected(item)} onAdd={() => (needsChoice(item) ? setSelected(item) : addToCart(item, vendor.name))} />
          ))}
        </View>
      </ScrollView>

      {count > 0 ? (
        <View style={[styles.footer, { backgroundColor: colors.bg, borderTopColor: colors.line, paddingBottom: insets.bottom + spacing.md }]}>
          <Button title={`View cart · ${count} item${count === 1 ? '' : 's'} · ${formatNaira(cartSubtotal(lines))}`} onPress={() => router.push('/cart')} />
        </View>
      ) : null}

      <ItemSheet
        item={selected}
        onClose={() => setSelected(null)}
        onAdd={(item, choice) => {
          addToCart(item, vendor.name, choice);
          setSelected(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  back: { position: 'absolute', left: spacing.lg },
  avatar: { position: 'absolute', left: spacing.lg, bottom: -32, width: 72, height: 72, borderRadius: 36, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  info: { paddingHorizontal: spacing.lg, paddingTop: 44, paddingBottom: spacing.md, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  tabs: { paddingHorizontal: spacing.lg, gap: spacing.xl, borderBottomWidth: StyleSheet.hairlineWidth, minWidth: '100%' },
  tab: { paddingVertical: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  menu: { padding: spacing.lg, gap: spacing.md },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
});
