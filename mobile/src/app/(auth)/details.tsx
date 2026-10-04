import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { api } from '@/api/client';
import { Button, Input, Screen, Text } from '@/components/ui';
import { isEmail, isName } from '@/lib/validate';
import { useSession } from '@/store/session';
import { spacing } from '@/theme';

/** Last sign-up step, new users only: name and email. */
export default function DetailsScreen() {
  const { token, signIn } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [touched, setTouched] = useState(false);
  const signUp = useMutation({
    mutationFn: () => api.completeSignUp({ name, email, referralCode: referralCode.trim() || undefined }),
    onSuccess: (user) => signIn(token!, user),
  });

  const submit = () => {
    setTouched(true);
    if (isName(name) && isEmail(email)) signUp.mutate();
  };

  return (
    <Screen footer={<Button title="Create account" loading={signUp.isPending} onPress={submit} />}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="display">Almost there</Text>
        <Text color="muted">Tell us your name and email so riders know who to ask for and we can send receipts.</Text>
      </View>
      <Input label="Full name" placeholder="e.g. Amina Bello" value={name} onChangeText={setName} autoComplete="name" autoCapitalize="words" autoFocus error={touched && !isName(name) ? 'Enter your name' : null} />
      <Input
        label="Email address"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        autoComplete="email"
        keyboardType="email-address"
        autoCapitalize="none"
        error={touched && !isEmail(email) ? 'Enter a valid email address' : null}
      />
      <Input
        label="Referral code (optional)"
        placeholder="A friend’s code, if you have one"
        value={referralCode}
        onChangeText={setReferralCode}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={20}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      {signUp.isError ? <Text color="danger">{signUp.error.message}</Text> : null}
    </Screen>
  );
}
