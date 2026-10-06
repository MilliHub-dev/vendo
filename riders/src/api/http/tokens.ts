import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Where the sign-in tokens live: the device keychain on phones. Browsers have no keychain,
 * so the web build (used for development only) falls back to ordinary storage.
 */
export type Tokens = { access: string; refresh: string };
const KEY = 'vendo.rider.tokens';
let cached: Tokens | null | undefined;

export async function loadTokens(): Promise<Tokens | null> {
  if (cached !== undefined) return cached;
  try {
    const raw = Platform.OS === 'web' ? await AsyncStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    cached = raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    cached = null;
  }
  return cached;
}

export async function saveTokens(tokens: Tokens | null) {
  cached = tokens;
  try {
    if (Platform.OS === 'web') await (tokens ? AsyncStorage.setItem(KEY, JSON.stringify(tokens)) : AsyncStorage.removeItem(KEY));
    else await (tokens ? SecureStore.setItemAsync(KEY, JSON.stringify(tokens)) : SecureStore.deleteItemAsync(KEY));
  } catch {
    // the tokens still work for this session from memory
  }
}
