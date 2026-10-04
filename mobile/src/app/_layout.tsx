import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, useFonts } from '@expo-google-fonts/outfit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplash } from '@/components/AnimatedSplash';
import { ConfirmHost } from '@/components/ConfirmHost';
import { useIsSignedIn, useSessionReady } from '@/store/session';
import { fonts, ThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold });
  const sessionReady = useSessionReady();

  // the native splash stays up until the font and saved session are ready; <AnimatedSplash> then takes over
  if ((!fontsLoaded && !fontError) || !sessionReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RootStack />
          <ConfirmHost />
          <AnimatedSplash />
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

/** Every screen outside the tab bar is declared here. Signed-out users only reach the (auth) screens. */
function RootStack() {
  const { colors, scheme } = useTheme();
  const signedIn = useIsSignedIn();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.heading,
          headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 18 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          headerTitleAlign: 'center',
          contentStyle: { backgroundColor: colors.bg },
        }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

          {/* food ordering */}
          <Stack.Screen name="search" options={{ title: 'Search' }} />
          <Stack.Screen name="vendor/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="cart" options={{ title: 'My Cart' }} />
          <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />

          {/* dispatch */}
          <Stack.Screen name="dispatch/review" options={{ title: 'Review & pay' }} />

          {/* orders */}
          <Stack.Screen name="order/[id]/index" options={{ title: 'Order details' }} />
          <Stack.Screen name="order/[id]/track" options={{ title: 'Track order' }} />
          <Stack.Screen name="order/[id]/chat" options={{ title: 'Chat' }} />
          <Stack.Screen name="order/[id]/placed" options={{ headerShown: false, gestureEnabled: false }} />

          {/* account */}
          <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
          <Stack.Screen name="wallet/index" options={{ title: 'Wallet' }} />
          <Stack.Screen name="wallet/top-up" options={{ title: 'Top up wallet', presentation: 'modal' }} />
          <Stack.Screen name="addresses/index" options={{ title: 'Saved addresses' }} />
          <Stack.Screen name="addresses/pick" options={{ title: 'Add address' }} />
          <Stack.Screen name="referrals" options={{ title: 'Refer a friend' }} />
          <Stack.Screen name="settings/appearance" options={{ title: 'Appearance' }} />
          <Stack.Screen name="profile-edit" options={{ title: 'Edit profile', presentation: 'modal' }} />
        </Stack.Protected>

        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
      </Stack>
    </>
  );
}
