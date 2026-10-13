import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Platform } from 'react-native';

/**
 * True on iPhones whose system has Liquid Glass (iOS 26 and later). Everywhere else — older iPhones,
 * Android, the web — the app keeps its solid surfaces.
 */
export const hasGlass = (() => {
  try {
    return Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
})();
