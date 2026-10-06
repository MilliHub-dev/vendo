import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { ApiError, request } from '@/api/http/request';

/**
 * Rider GPS. The server only offers deliveries to riders whose position is fresh and accurate,
 * and switches a rider offline when updates stop — so while a rider is online this keeps
 * sending their position, including when the phone is locked or the app is in the background.
 */
const TASK = 'vendo-rider-location';
const MIN_GAP_MS = 5000;
let lastSent = 0;
let foregroundWatch: Location.LocationSubscription | null = null;

type Sample = { lat: number; lng: number; accuracy_m: number; heading?: number; speed_mps?: number; captured_at: string };
const toSample = (l: Location.LocationObject): Sample => ({
  lat: l.coords.latitude,
  lng: l.coords.longitude,
  accuracy_m: Math.max(1, Math.round(l.coords.accuracy ?? 50)),
  // phones report -1 when they don't know the direction or speed
  ...(l.coords.heading !== null && l.coords.heading >= 0 ? { heading: l.coords.heading } : {}),
  ...(l.coords.speed !== null && l.coords.speed >= 0 ? { speed_mps: l.coords.speed } : {}),
  captured_at: new Date(l.timestamp).toISOString(),
});

async function send(location: Location.LocationObject) {
  if (Date.now() - lastSent < MIN_GAP_MS) return;
  lastSent = Date.now();
  // a rejected sample (too old, out of order) isn't worth interrupting the rider for; the next one follows in seconds
  await request('POST', '/v1/riders/me/location', { body: toSample(location) }).catch(() => {});
}

// Must be defined at the top level so Android/iOS can run it when the app isn't on screen.
if (Platform.OS !== 'web') {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
    const latest = data?.locations?.at(-1);
    if (!error && latest) await send(latest);
  });
}

/** One accurate reading, asked for when the rider taps "Go online". */
export async function currentPosition(): Promise<Sample> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) throw new ApiError('LOCATION_DENIED', 'Vendo needs your location to send you nearby deliveries. Allow location access in your phone’s settings.');
  if (!(await Location.hasServicesEnabledAsync().catch(() => true))) throw new ApiError('LOCATION_OFF', 'Turn on your phone’s location (GPS) and try again.');
  try {
    lastSent = Date.now();
    return toSample(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));
  } catch {
    throw new ApiError('LOCATION_UNAVAILABLE', 'We couldn’t find your location. Move somewhere with a clearer view of the sky and try again.');
  }
}

/** Starts reporting position. Safe to call repeatedly. */
export async function startTracking(): Promise<void> {
  try {
    if (Platform.OS !== 'web') {
      if (await Location.hasStartedLocationUpdatesAsync(TASK)) return;
      const background = await Location.requestBackgroundPermissionsAsync().catch(() => ({ granted: false }));
      if (background.granted) {
        foregroundWatch?.remove();
        foregroundWatch = null;
        return await Location.startLocationUpdatesAsync(TASK, {
          accuracy: Location.Accuracy.High,
          timeInterval: 8000,
          distanceInterval: 15,
          pausesUpdatesAutomatically: false,
          activityType: Location.ActivityType.AutomotiveNavigation,
          showsBackgroundLocationIndicator: true,
          foregroundService: { notificationTitle: 'You’re online with Vendo', notificationBody: 'Sharing your location so we can send you nearby deliveries.', notificationColor: '#0064FF' },
        });
      }
    }
    // no background permission (or the browser preview): report while the app is open
    foregroundWatch ??= await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 8000, distanceInterval: 15 }, (l) => void send(l));
  } catch {
    // going online already proved location works once; if continuous updates can't start the server will take the rider offline
  }
}

export async function stopTracking(): Promise<void> {
  foregroundWatch?.remove();
  foregroundWatch = null;
  if (Platform.OS !== 'web' && (await Location.hasStartedLocationUpdatesAsync(TASK).catch(() => false))) await Location.stopLocationUpdatesAsync(TASK).catch(() => {});
}

/** True when updates will keep flowing with the phone locked. Without it the rider must keep the app open. */
export const hasBackgroundPermission = async () => Platform.OS !== 'web' && (await Location.getBackgroundPermissionsAsync().catch(() => ({ granted: false }))).granted;
