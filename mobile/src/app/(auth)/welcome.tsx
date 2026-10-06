import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { palette, radius, spacing, useTheme } from '@/theme';

const slides = [
  { art: require('@/assets/images/art-food.png'), title: 'Food from vendors\nyou love', text: 'Restaurants, suya spots, drinks and groceries near you, delivered to your door.' },
  { art: require('@/assets/images/art-parcel.png'), title: 'Send anything\nacross town', text: 'Book a rider for documents and parcels. See the price before you pay.' },
  { art: require('@/assets/images/art-rider.png'), title: 'Track every\ndelivery live', text: 'Follow your rider on the map and confirm delivery with a one-time code.' },
];

/** First screen: a blue stage with the artwork, and a sheet with the pitch and the way in. */
export default function WelcomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: windowWidth, height } = useWindowDimensions();
  const width = Math.min(windowWidth, 520);
  const scroller = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const last = index === slides.length - 1;
  const start = () => router.push('/email');
  const artSize = Math.min(width * 0.72, height * 0.3);

  return (
    <View style={[styles.root, { backgroundColor: palette.blue }]}>
      {/* soft rings behind the artwork */}
      <View pointerEvents="none" style={[styles.ring, { width: width * 1.3, height: width * 1.3, borderRadius: width, top: -width * 0.45, right: -width * 0.45 }]} />
      <View pointerEvents="none" style={[styles.ring, { width: width * 0.8, height: width * 0.8, borderRadius: width, top: height * 0.16, left: -width * 0.4 }]} />

      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Image source={require('@/assets/images/logo-white.png')} style={styles.logo} contentFit="contain" accessibilityLabel="Vendo" />
        {!last ? (
          <Pressable accessibilityRole="button" onPress={start} hitSlop={10} style={styles.skip}>
            <Text variant="smallMedium" style={{ color: '#fff' }}>
              Skip
            </Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ width, alignSelf: 'center' }}
        contentContainerStyle={{ alignItems: 'center' }}
        onScroll={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        scrollEventThrottle={32}>
        {slides.map((s) => (
          <View key={s.title} style={[styles.stage, { width }]}>
            <View style={[styles.plate, { width: artSize * 1.18, height: artSize * 1.18, borderRadius: artSize }]}>
              <Image source={s.art} style={{ width: artSize, height: artSize }} contentFit="contain" />
            </View>
          </View>
        ))}
      </ScrollView>

      <Animated.View entering={FadeInDown.duration(450)} style={[styles.sheet, { backgroundColor: colors.bg, paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.dots}>
          {slides.map((s, i) => (
            <View key={s.title} style={[styles.dot, { backgroundColor: i === index ? colors.primary : colors.line }, i === index && { width: 24 }]} />
          ))}
        </View>
        {/* keyed so the words fade in again on each slide */}
        <Animated.View key={index} entering={FadeIn.duration(250)} style={styles.copy}>
          <Text variant="display" center>
            {slides[index].title}
          </Text>
          <Text color="muted" center>
            {slides[index].text}
          </Text>
        </Animated.View>
        <View style={{ gap: spacing.sm }}>
          <Button
            title={last ? 'Continue with email' : 'Next'}
            icon={last ? undefined : <ArrowRight size={18} color={colors.onPrimary} />}
            onPress={() => (last ? start() : scroller.current?.scrollTo({ x: (index + 1) * width, animated: true }))}
          />
          <Text variant="small" color="subtle" center>
            New or returning, it’s the same step: we email you a code.
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  ring: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.07)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl },
  logo: { width: 112, height: 28 },
  skip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.18)' },
  stage: { alignItems: 'center', justifyContent: 'center' },
  plate: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  copy: { gap: spacing.sm, minHeight: 148, justifyContent: 'center' },
});
