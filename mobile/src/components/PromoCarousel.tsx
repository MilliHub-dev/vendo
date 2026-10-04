import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { palette, radius, spacing } from '@/theme';

import { Text } from './ui';

const banners: { title: string; text: string; cta: string; href: Href; art: number; bg: string }[] = [
  { title: 'Send anything\nacross town', text: 'Same-day bike dispatch with a delivery code.', cta: 'Send now', href: '/send', art: require('@/assets/images/art-parcel.png'), bg: palette.blue },
  { title: 'Good food,\ndelivered fast', text: 'From the vendors you love, tracked live.', cta: 'Order now', href: '/search', art: require('@/assets/images/art-food.png'), bg: palette.navy },
  { title: 'Plan ahead,\nwe’ll be there', text: 'Schedule a pickup for later today or this week.', cta: 'Schedule', href: '/send', art: require('@/assets/images/art-scheduled.png'), bg: palette.blue600 },
];

/** Swipeable promo banners at the top of Home, as in the reference design. */
export function PromoCarousel() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width, 520) - spacing.lg * 2;
  const [index, setIndex] = useState(0);

  return (
    <View style={{ gap: spacing.sm }}>
      <ScrollView
        horizontal
        pagingEnabled={false}
        snapToInterval={cardWidth + spacing.md}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
        onScroll={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / (cardWidth + spacing.md)))}
        scrollEventThrottle={32}>
        {banners.map((b) => (
          <Pressable key={b.title} accessibilityRole="button" accessibilityLabel={`${b.title.replace('\n', ' ')}. ${b.cta}`} onPress={() => router.push(b.href)} style={[styles.card, { width: cardWidth, backgroundColor: b.bg }]}>
            <View style={styles.glow} />
            <View style={styles.copy}>
              <Text variant="title" style={styles.title} maxFontSizeMultiplier={1.2}>
                {b.title}
              </Text>
              <Text variant="small" style={styles.text} maxFontSizeMultiplier={1.2}>
                {b.text}
              </Text>
              <View style={styles.cta}>
                <Text variant="smallMedium" style={{ color: b.bg }} maxFontSizeMultiplier={1.2}>
                  {b.cta}
                </Text>
              </View>
            </View>
            <Image source={b.art} style={styles.art} contentFit="contain" />
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {banners.map((b, i) => (
          <View key={b.title} style={[styles.dot, i === index ? styles.dotOn : null]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 168, borderRadius: radius.xl, overflow: 'hidden', flexDirection: 'row', alignItems: 'center' },
  glow: { position: 'absolute', right: -60, top: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,255,255,0.12)' },
  copy: { flex: 1, padding: spacing.lg, gap: 6, zIndex: 1 },
  title: { color: '#fff', fontSize: 22, lineHeight: 26 },
  text: { color: 'rgba(255,255,255,0.85)' },
  cta: { alignSelf: 'flex-start', backgroundColor: '#fff', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, marginTop: 6 },
  art: { width: 132, height: 132, marginRight: spacing.sm },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(120,132,160,0.35)' },
  dotOn: { width: 18, backgroundColor: palette.blue },
});
