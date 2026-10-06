import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { api } from '@/api/client';
import { Button, Input, Screen, Text } from '@/components/ui';
import { isEmail } from '@/lib/validate';
import { spacing } from '@/theme';

/** One screen for both sign-up and login: we email a code to the address. */
export default function EmailScreen() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const email = value.trim().toLowerCase();
  const request = useMutation({ mutationFn: (e: string) => api.requestCode(e) });

  const submit = () => {
    setTouched(true);
    if (!isEmail(email)) return;
    request.mutate(email, { onSuccess: () => router.push({ pathname: '/otp', params: { email } }) });
  };

  return (
    <Screen footer={<Button title="Send code" loading={request.isPending} onPress={submit} />}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="display">What’s your email?</Text>
        <Text color="muted">We’ll email you a code to sign you in or start your rider application.</Text>
      </View>
      <Input
        label="Email address"
        placeholder="you@example.com"
        value={value}
        onChangeText={setValue}
        keyboardType="email-address"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={submit}
        error={touched && !isEmail(email) ? 'Enter a valid email address' : request.isError ? request.error.message : null}
      />
      <Text variant="small" color="subtle">
        By continuing you agree to Vendo’s Terms of Service and Privacy Policy.
      </Text>
    </Screen>
  );
}
