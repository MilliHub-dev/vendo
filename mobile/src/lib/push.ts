import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { request } from '@/api/http/request';

/**
 * Push notifications: order updates (accepted, rider assigned, on the way, delivered) and
 * announcements, when the app isn't open. The server sends through Firebase (FCM), which on
 * Android needs the app built with the project's google-services.json (see README).
 * iPhones aren't covered yet: the server can't send to Apple's tokens directly.
 */
const DEVICE_KEY = 'vendo.push-device';

// a notification arriving while the app is open still shows as a banner
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });

/** Asks permission (once), gets this phone's push token and gives it to the server. Safe to call on every launch. */
export async function registerForPush(): Promise<void> {
  if (Platform.OS !== 'android' || !Device.isDevice) return;
  try {
    await Notifications.setNotificationChannelAsync('default', { name: 'Order updates', importance: Notifications.AndroidImportance.HIGH });
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (current.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
    if (!granted) return;
    const token = (await Notifications.getDevicePushTokenAsync()).data as string;
    const device = await request<{ id: string }>('POST', '/v1/me/devices', { body: { token, platform: 'android' } });
    await AsyncStorage.setItem(DEVICE_KEY, device.id);
  } catch {
    // no Firebase config in this build, or no network: the in-app notifications list still works
  }
}

/** Stops pushes to this phone. Called before the session ends, while the server will still accept the request. */
export async function unregisterPush(): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(DEVICE_KEY);
    if (!id) return;
    await AsyncStorage.removeItem(DEVICE_KEY);
    await request('DELETE', `/v1/me/devices/${id}`);
  } catch {
    // the server also drops tokens that stop working
  }
}

/** The order a tapped notification is about, if any. */
export const orderIdOf = (response: Notifications.NotificationResponse): string | null => {
  // FCM data arrives under different keys depending on whether the app was open
  const content = response.notification.request.content;
  const data = (content.data ?? {}) as Record<string, unknown>;
  const id = data.order_id;
  return typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
};
