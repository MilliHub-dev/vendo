import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { api } from '@/api/client';
import { Button, Input, Screen, Text } from '@/components/ui';
import { normalisePhone } from '@/lib/phone';
import { spacing } from '@/theme';

/** One screen for both sign-up and login: we text a code to the number. */
export default function PhoneScreen() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const phone = normalisePhone(value);
  const request = useMutation({ mutationFn: (p: string) => api.requestCode(p) });

  const submit = () => {
    setTouched(true);
    if (!phone) return;
    request.mutate(phone, { onSuccess: () => router.push({ pathname: '/otp', params: { phone } }) });
  };

  return (
    <Screen footer={<Button title="Continue" loading={request.isPending} onPress={submit} />}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="display">What’s your phone number?</Text>
        <Text color="muted">We’ll text you a code to sign you in or start your rider application.</Text>
      </View>
      <Input
        label="Phone number"
        placeholder="803 000 0000"
        value={value}
        onChangeText={setValue}
        keyboardType="phone-pad"
        autoComplete="tel"
        autoFocus
        returnKeyType="done"
        onSubmitEditing={submit}
        left={<Text variant="bodyMedium">🇳🇬 +234</Text>}
        error={touched && !phone ? 'Enter a valid Nigerian mobile number' : request.isError ? request.error.message : null}
      />
      <Text variant="small" color="subtle">
        By continuing you agree to Vendo’s Terms of Service and Privacy Policy.
      </Text>
    </Screen>
  );
}
