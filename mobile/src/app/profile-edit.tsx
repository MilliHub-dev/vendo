import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { useMe, useUpdateProfile } from '@/api/queries';
import type { User } from '@/api/types';
import { localDigits, PhoneField } from '@/components/PhoneField';
import { Button, Input, Screen, Text } from '@/components/ui';
import { normalisePhone } from '@/lib/phone';
import { isName } from '@/lib/validate';
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
  const [digits, setDigits] = useState(localDigits(current.phone));
  const [touched, setTouched] = useState(false);
  const phone = normalisePhone(digits);

  const save = () => {
    setTouched(true);
    if (!isName(name) || !phone) return;
    update.mutate(
      { name, phone },
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
      <PhoneField label="Phone number" value={digits} onChange={setDigits} error={touched && !phone ? 'Enter a valid Nigerian mobile number' : null} />
      <Input label="Email address" value={current.email} editable={false} />
      <Text variant="small" color="subtle">
        Your email is how you sign in. To change it, message support on WhatsApp.
      </Text>
      {update.isError ? <Text color="danger">{update.error.message}</Text> : null}
    </Screen>
  );
}
