import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { useMe, useUpdateProfile } from '@/api/queries';
import type { User } from '@/api/types';
import { Button, Input, Screen, Text } from '@/components/ui';
import { isEmail, isName } from '@/lib/validate';
import { useSession } from '@/store/session';

export default function EditProfileScreen() {
  const me = useMe();
  if (!me.data) return <Screen scroll={false}>{me.isPending ? <ActivityIndicator /> : <Text color="danger">Couldn’t load your profile.</Text>}</Screen>;
  return <EditProfileForm user={me.data} />;
}

function EditProfileForm({ user: current }: { user: User }) {
  const router = useRouter();
  const update = useUpdateProfile();
  const setUser = useSession((s) => s.setUser);
  const [name, setName] = useState(current.name);
  const [email, setEmail] = useState(current.email);
  const [touched, setTouched] = useState(false);

  const save = () => {
    setTouched(true);
    if (!isName(name) || !isEmail(email)) return;
    update.mutate(
      { name, email },
      {
        onSuccess: (user) => {
          setUser(user);
          router.back();
        },
      },
    );
  };

  return (
    <Screen footer={<Button title="Save changes" loading={update.isPending} onPress={save} />}>
      <Input label="Full name" value={name} onChangeText={setName} autoComplete="name" autoCapitalize="words" error={touched && !isName(name) ? 'Enter your name' : null} />
      <Input label="Email address" value={email} onChangeText={setEmail} autoComplete="email" keyboardType="email-address" autoCapitalize="none" error={touched && !isEmail(email) ? 'Enter a valid email address' : null} />
      <Input label="Phone number" value={current.phone} editable={false} />
      <Text variant="small" color="subtle">
        Your phone number is how you sign in. To change it, message support on WhatsApp.
      </Text>
      {update.isError ? <Text color="danger">{update.error.message}</Text> : null}
    </Screen>
  );
}
