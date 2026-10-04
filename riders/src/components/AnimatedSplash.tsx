import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { fonts, palette } from '@/theme';

// Logo pieces at display size (source images are 140px tall).
const HEIGHT = 60;
const MARK_WIDTH = (106 / 140) * HEIGHT;
const WORD_WIDTH = (432 / 140) * HEIGHT;
const GAP = 10;
/** The native launch screen shows the mark 84pt tall; start there so the handover is invisible. */
const START_SCALE = 84 / HEIGHT;

const ease = Easing.bezier(0.2, 0.7, 0.2, 1);

/** The splash plays once per app launch, even if the root layout is ever re-mounted. */
let hasPlayed = false;

/**
 * Animated launch screen. Sits on top of the app, takes over from the static native
 * splash (same navy, same mark, same position), plays once (~1.9s) and removes itself:
 *   mark pulses → shrinks and slides left as "Vendo" is revealed → tagline rises → fade out.
 * With "reduce motion" on, it shows the finished logo and simply fades.
 */
export function AnimatedSplash() {
  const reduceMotion = useReducedMotion();
  const [done, setDone] = useState(hasPlayed);

  const markScale = useSharedValue(reduceMotion ? 1 : START_SCALE);
  const reveal = useSharedValue(reduceMotion ? 1 : 0); // 0 → 1: wordmark width + opacity
  const tagline = useSharedValue(reduceMotion ? 1 : 0);
  const overlay = useSharedValue(1);

  useEffect(() => {
    SplashScreen.hideAsync(); // this view is now on screen, identical to the native splash
    if (hasPlayed) return;
    hasPlayed = true;

    if (reduceMotion) {
      overlay.value = withDelay(900, withTiming(0, { duration: 300 }));
    } else {
      markScale.value = withSequence(
        withTiming(START_SCALE * 1.12, { duration: 260, easing: ease }),
        withTiming(START_SCALE, { duration: 200, easing: ease }),
        withTiming(1, { duration: 520, easing: ease }),
      );
      reveal.value = withDelay(460, withTiming(1, { duration: 520, easing: ease }));
      tagline.value = withDelay(900, withTiming(1, { duration: 400, easing: ease }));
      overlay.value = withDelay(1550, withTiming(0, { duration: 350 }));
    }
    // not cleared on unmount: if this instance is replaced mid-animation, the replacement starts already done
    setTimeout(() => setDone(true), reduceMotion ? 1250 : 1950);
  }, [reduceMotion, markScale, reveal, tagline, overlay]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value, transform: [{ scale: 1 + (1 - overlay.value) * 0.06 }] }));
  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: markScale.value }] }));
  const wordStyle = useAnimatedStyle(() => ({ width: reveal.value * (WORD_WIDTH + GAP), opacity: reveal.value }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: tagline.value, transform: [{ translateY: (1 - tagline.value) * 10 }] }));

  if (done) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.logo}>
        <Animated.View style={markStyle}>
          <Image source={require('@/assets/images/splash-mark.png')} style={styles.mark} contentFit="contain" />
        </Animated.View>
        {/* the row is centred, so widening this clip slides the mark left while the word appears */}
        <Animated.View style={[styles.wordClip, wordStyle]}>
          <Image source={require('@/assets/images/splash-wordmark.png')} style={styles.word} contentFit="contain" />
        </Animated.View>
      </View>
      <Animated.Text style={[styles.tagline, taglineStyle]} maxFontSizeMultiplier={1.2}>
        Rider
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: palette.navy, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  logo: { flexDirection: 'row', alignItems: 'center', height: HEIGHT },
  mark: { width: MARK_WIDTH, height: HEIGHT },
  wordClip: { height: HEIGHT, overflow: 'hidden' },
  word: { width: WORD_WIDTH, height: HEIGHT, marginLeft: GAP },
  // absolutely positioned so the logo stays exactly centred, matching the native splash
  tagline: { position: 'absolute', top: '50%', marginTop: HEIGHT / 2 + 18, fontFamily: fonts.medium, fontSize: 15, letterSpacing: 0.4, color: 'rgba(255,255,255,0.85)' },
});
