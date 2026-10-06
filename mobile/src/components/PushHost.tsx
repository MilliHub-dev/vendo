import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { orderIdOf, registerForPush } from '@/lib/push';
import { useIsSignedIn } from '@/store/session';

/** While signed in: keeps this phone registered for pushes, and opens the order when one is tapped. */
export function PushHost() {
  const signedIn = useIsSignedIn();
  const router = useRouter();

  useEffect(() => {
    if (!signedIn || Platform.OS === 'web') return;
    void registerForPush();
    const open = (response: Notifications.NotificationResponse | null) => {
      const id = response && orderIdOf(response);
      if (id) router.push({ pathname: '/order/[id]', params: { id } });
    };
    // a tap that launched the app, and taps while it is running
    void Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [signedIn, router]);

  return null;
}
