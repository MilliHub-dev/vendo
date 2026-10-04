import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

const slides = [
  { art: require('@/assets/images/art-food.png'), title: 'Food from vendors\nyou love', text: 'Restaurants, suya spots, drinks and groceries near you — delivered to your door.' },
  { art: require('@/assets/images/art-parcel.png'), title: 'Send anything\nacross town', text: 'Book a rider for documents and parcels. See the price before you pay.' },
  { art: require('@/assets/images/art-rider.png'), title: 'Track every\ndelivery live', text: 'Follow your rider on the map and confirm delivery with a one-time code.' },
];

export default function WelcomeScreen() {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, 520);
  const scroller = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const last = index === slides.length - 1;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
      <Image source={scheme === 'dark' ? require('@/assets/images/logo-white.png') : require('@/assets/images/logo-blue.png')} style={styles.logo} contentFit="contain" accessibilityLabel="Vendo" />
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ width, flexGrow: 0, alignSelf: 'center' }}
        onScroll={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        scrollEventThrottle={32}>
        {slides.map((s) => (
          <View key={s.title} style={[styles.slide, { width }]}>
            <View style={[styles.artWrap, { backgroundColor: colors.surfaceAlt }]}>
              <Image source={s.art} style={styles.art} contentFit="contain" />
            </View>
            <Text variant="display" center>
              {s.title}
            </Text>
            <Text color="muted" center>
              {s.text}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {slides.map((s, i) => (
          <View key={s.title} style={[styles.dot, { backgroundColor: i === index ? colors.primary : colors.line }, i === index && { width: 22 }]} />
        ))}
      </View>
      <View style={styles.actions}>
        <Button title={last ? 'Get started' : 'Next'} onPress={() => (last ? router.push('/phone') : scroller.current?.scrollTo({ x: (index + 1) * width, animated: true }))} />
        {!last ? <Button title="Skip" variant="ghost" onPress={() => router.push('/phone')} /> : <View style={{ height: 54 }} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between', gap: spacing.lg },
  logo: { width: 120, height: 30, alignSelf: 'center' },
  slide: { paddingHorizontal: spacing.xl, alignItems: 'center', gap: spacing.md },
  artWrap: { width: '100%', aspectRatio: 1.25, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  art: { width: '70%', height: '80%' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  actions: { paddingHorizontal: spacing.xl, gap: spacing.xs },
});
