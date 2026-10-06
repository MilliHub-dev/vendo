import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

/** Sign-up and login: welcome → email → code → (new users only) name and phone. Each screen draws its own header. */
export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
      {/* listed so the stack starts on the welcome screen */}
      <Stack.Screen name="welcome" />
      <Stack.Screen name="email" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="details" />
    </Stack>
  );
}
