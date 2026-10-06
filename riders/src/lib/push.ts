import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { request } from '@/api/http/request';

/**
 * Push notifications, so a rider hears about a delivery offer when the app isn't on screen.
 * The server sends through Firebase (FCM), which on Android needs the app built with the
 * project's google-services.json (see README). iPhones aren't covered yet: the server can't
 * send to Apple's tokens directly.
 */
const DEVICE_KEY = 'vendo.rider.push-device';
const OFFERS_CHANNEL = 'offers';

// an offer arriving while the app is open should still make a sound and show a banner
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });

/** Asks permission (once), gets this phone's push token and gives it to the server. Safe to call on every launch. */
export async function registerForPush(): Promise<void> {
  if (Platform.OS !== 'android' || !Device.isDevice) return;
  try {
    await Notifications.setNotificationChannelAsync(OFFERS_CHANNEL, { name: 'Delivery offers', importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 400, 200, 400], lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC });
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (current.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
    if (!granted) return;
    const token = (await Notifications.getDevicePushTokenAsync()).data as string;
    const device = await request<{ id: string }>('POST', '/v1/me/devices', { body: { token, platform: 'android' } });
    await AsyncStorage.setItem(DEVICE_KEY, device.id);
  } catch {
    // no Firebase config in this build, or no network: offers still arrive while the app is open
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
