import { Stack } from 'expo-router';

import { fonts, useTheme } from '@/theme';

/** Sign-up and login: welcome → email → code → (new riders only) name and phone. */
export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.heading,
        headerTitleStyle: { fontFamily: fonts.semibold },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        title: '',
        contentStyle: { backgroundColor: colors.bg },
      }}>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
    </Stack>
  );
}
