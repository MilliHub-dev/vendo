import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { api } from '@/api/client';
import { Button, Screen, Text } from '@/components/ui';
import { useSession } from '@/store/session';
import { fonts, radius, spacing, useTheme } from '@/theme';

const LENGTH = 6;
const RESEND_SECONDS = 30;

/** Enter the emailed code. Known accounts are signed in; new ones continue to name and contact number, then the rider application. */
export default function OtpScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const input = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const { signIn, setToken } = useSession();

  const verify = useMutation({
    mutationFn: (c: string) => api.verifyCode(email, c),
    onSuccess: ({ token, user }) => {
      if (user) return signIn(token, user); // returning rider: the root layout swaps to the app
      setToken(token);
      router.replace('/details');
    },
    onError: () => setCode(''),
  });
  const resend = useMutation({ mutationFn: () => api.requestCode(email), onSuccess: () => setSeconds(RESEND_SECONDS) });

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const onChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, LENGTH);
    setCode(digits);
    if (digits.length === LENGTH && !verify.isPending) verify.mutate(digits);
  };

  return (
    <Screen footer={<Button title="Verify" disabled={code.length < LENGTH} loading={verify.isPending} onPress={() => verify.mutate(code)} />}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="display">Enter the code</Text>
        <Text color="muted">We emailed a 6-digit code to {email}.</Text>
      </View>

      <Pressable accessibilityLabel="Verification code" onPress={() => input.current?.focus()} style={styles.boxes}>
        {Array.from({ length: LENGTH }, (_, i) => (
          <View key={i} style={[styles.box, { backgroundColor: colors.surface, borderColor: verify.isError ? colors.danger : i === code.length ? colors.primary : colors.line }]}>
            <Text variant="title">{code[i] ?? ''}</Text>
          </View>
        ))}
        {/* one real input holds the value; the boxes above just display it */}
        <TextInput
          ref={input}
          value={code}
          onChangeText={onChange}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          autoFocus
          maxLength={LENGTH}
          caretHidden
          style={[StyleSheet.absoluteFill, styles.hidden]}
        />
      </Pressable>

      {verify.isError ? <Text color="danger">{verify.error.message}. Check the code and try again.</Text> : null}
      {seconds > 0 ? (
        <Text color="muted">Didn’t get it? Check your spam folder. You can resend in {seconds}s.</Text>
      ) : (
        <Button title="Resend code" variant="ghost" loading={resend.isPending} onPress={() => resend.mutate()} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', gap: spacing.sm },
  box: { flex: 1, aspectRatio: 0.85, maxHeight: 64, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  hidden: { opacity: 0.01, fontFamily: fonts.regular, fontSize: 16 },
});
