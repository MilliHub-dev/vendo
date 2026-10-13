import * as Location from 'expo-location';

/** Where the phone is now, asked for only when the customer taps "Use my current location". */
export async function currentCoords(): Promise<{ lat: number; lng: number }> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) throw new Error('Vendo needs permission to see your location. Allow it in your phone’s settings, or search for the address instead.');
  if (!(await Location.hasServicesEnabledAsync().catch(() => true))) throw new Error('Turn on your phone’s location (GPS) and try again.');
  try {
    const here = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { lat: here.coords.latitude, lng: here.coords.longitude };
  } catch {
    throw new Error('We couldn’t find your location. Try again, or search for the address instead.');
  }
}
