import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, useFonts } from '@expo-google-fonts/outfit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useRider } from '@/api/queries';
import { AnimatedSplash } from '@/components/AnimatedSplash';
import { ConfirmHost } from '@/components/ConfirmHost';
import { OfferHost } from '@/components/OfferHost';
import { useSession, useSessionReady, useStage } from '@/store/session';
import { fonts, ThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } });

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold });
  const sessionReady = useSessionReady();
  if ((!fontsLoaded && !fontError) || !sessionReady) return null; // native splash stays up

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RiderSync />
          <RootStack />
          <OfferHost />
          <ConfirmHost />
          <AnimatedSplash />
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

/** Keeps the saved session's rider profile up to date, so an approval switches the app over by itself. */
function RiderSync() {
  const signedIn = useStage() !== 'signed_out';
  const setRider = useSession((s) => s.setRider);
  const { data } = useRider(signedIn);
  useEffect(() => {
    if (signedIn && data !== undefined) setRider(data);
  }, [signedIn, data, setRider]);
  return null;
}

/**
 * Three stages, one at a time:
 * signed out → (auth) · signed in but not approved → application · approved → the working app.
 */
function RootStack() {
  const { colors, scheme } = useTheme();
  const stage = useStage();
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
        <Stack.Protected guard={stage === 'working'}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="job" options={{ title: 'Current delivery' }} />
          <Stack.Screen name="job-done" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="chat" options={{ title: 'Chat' }} />
          <Stack.Screen name="trip/[id]" options={{ title: 'Trip details' }} />
          <Stack.Screen name="withdraw" options={{ title: 'Withdraw', presentation: 'modal' }} />
          <Stack.Screen name="vehicle" options={{ title: 'Vehicle & documents' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
          <Stack.Screen name="settings/appearance" options={{ title: 'Appearance' }} />
        </Stack.Protected>

        <Stack.Protected guard={stage === 'applying'}>
          <Stack.Screen name="application" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={stage === 'signed_out'}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
      </Stack>
    </>
  );
}
