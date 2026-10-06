import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { api } from '@/api/client';
import { Button, Input, Screen, Text } from '@/components/ui';
import { normalisePhone } from '@/lib/phone';
import { isName } from '@/lib/validate';
import { useSession } from '@/store/session';
import { spacing } from '@/theme';

/** New riders only: name and phone number, then on to the rider application. */
export default function DetailsScreen() {
  const { token, signIn } = useSession();
  const [name, setName] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [touched, setTouched] = useState(false);
  const phone = normalisePhone(phoneInput);
  const signUp = useMutation({ mutationFn: () => api.completeSignUp({ name, phone: phone! }), onSuccess: (user) => signIn(token!, user) });

  const submit = () => {
    setTouched(true);
    if (isName(name) && phone) signUp.mutate();
  };

  return (
    <Screen footer={<Button title="Continue" loading={signUp.isPending} onPress={submit} />}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="display">About you</Text>
        <Text color="muted">Use the name on your ID. Customers see your first name, and call this number about their delivery.</Text>
      </View>
      <Input label="Full name" placeholder="e.g. Musa Ibrahim" value={name} onChangeText={setName} autoComplete="name" autoCapitalize="words" autoFocus error={touched && !isName(name) ? 'Enter your name' : null} />
      <Input
        label="Phone number"
        placeholder="803 000 0000"
        value={phoneInput}
        onChangeText={setPhoneInput}
        keyboardType="phone-pad"
        autoComplete="tel"
        returnKeyType="done"
        onSubmitEditing={submit}
        left={<Text variant="bodyMedium">🇳🇬 +234</Text>}
        error={touched && !phone ? 'Enter a valid Nigerian mobile number' : null}
      />
      {signUp.isError ? <Text color="danger">{signUp.error.message}</Text> : null}
    </Screen>
  );
}
