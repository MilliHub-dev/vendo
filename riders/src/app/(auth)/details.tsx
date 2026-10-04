import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { api } from '@/api/client';
import { Button, Input, Screen, Text } from '@/components/ui';
import { isEmail, isName } from '@/lib/validate';
import { useSession } from '@/store/session';
import { spacing } from '@/theme';

/** New riders only: name and email, then on to the rider application. */
export default function DetailsScreen() {
  const { token, signIn } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const signUp = useMutation({ mutationFn: () => api.completeSignUp({ name, email }), onSuccess: (user) => signIn(token!, user) });

  const submit = () => {
    setTouched(true);
    if (isName(name) && isEmail(email)) signUp.mutate();
  };

  return (
    <Screen footer={<Button title="Continue" loading={signUp.isPending} onPress={submit} />}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="display">About you</Text>
        <Text color="muted">Use the name on your ID. Customers see your first name when you deliver to them.</Text>
      </View>
      <Input label="Full name" placeholder="e.g. Musa Ibrahim" value={name} onChangeText={setName} autoComplete="name" autoCapitalize="words" autoFocus error={touched && !isName(name) ? 'Enter your name' : null} />
      <Input
        label="Email address"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        autoComplete="email"
        keyboardType="email-address"
        autoCapitalize="none"
        returnKeyType="done"
        onSubmitEditing={submit}
        error={touched && !isEmail(email) ? 'Enter a valid email address' : null}
      />
      {signUp.isError ? <Text color="danger">{signUp.error.message}</Text> : null}
    </Screen>
  );
}
