import { useMutation } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { MailCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { api } from '@/api/client';
import { AuthScaffold } from '@/components/AuthScaffold';
import { Button, Text } from '@/components/ui';
import { useSession } from '@/store/session';
import { fonts, radius, spacing, useTheme } from '@/theme';

const LENGTH = 6;
const RESEND_SECONDS = 30;

/** Enter the emailed code. Known accounts are signed in; new ones continue to name and phone. */
export default function OtpScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const input = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(true);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const { signIn, setToken, setPendingEmail } = useSession();
  const shake = useSharedValue(0);
  const shaking = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));

  const verify = useMutation({
    mutationFn: (c: string) => api.verifyCode(email, c),
    onSuccess: ({ token, user }) => {
      if (user) return signIn(token, user); // returning user: the root layout swaps to the app
      setPendingEmail(email);
      setToken(token);
      router.replace('/details');
    },
    onError: () => {
      setCode('');
      // a short side-to-side shake says "wrong" without relying on colour alone
      shake.set(withSequence(withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }), withTiming(-6, { duration: 50 }), withTiming(6, { duration: 50 }), withTiming(0, { duration: 50 })));
      input.current?.focus();
    },
  });
  const resend = useMutation({
    mutationFn: () => api.requestCode(email),
    onSuccess: () => {
      setSeconds(RESEND_SECONDS);
      verify.reset();
    },
  });

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const onChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, LENGTH);
    setCode(digits);
    if (verify.isError) verify.reset();
    if (digits.length === LENGTH && !verify.isPending) verify.mutate(digits);
  };

  if (!email) return <Redirect href="/email" />; // opened without an address (e.g. a reloaded page)

  return (
    <AuthScaffold
      step={2}
      icon={MailCheck}
      title="Enter the code"
      subtitle={
        <>
          We emailed a 6-digit code to{' '}
          <Text variant="bodyMedium" color="heading">
            {email}
          </Text>
          .
        </>
      }
      footer={<Button title="Verify" disabled={code.length < LENGTH} loading={verify.isPending} onPress={() => verify.mutate(code)} />}>
      <View style={{ gap: spacing.sm }}>
        <Animated.View style={shaking}>
          <Pressable accessibilityLabel="Verification code" onPress={() => input.current?.focus()} style={styles.boxes}>
            {Array.from({ length: LENGTH }, (_, i) => {
              const active = focused && i === Math.min(code.length, LENGTH - 1) && code.length < LENGTH;
              const filled = i < code.length;
              return (
                <View key={i} style={[styles.box, { backgroundColor: filled ? colors.primarySoft : colors.surface, borderColor: verify.isError ? colors.danger : active || filled ? colors.primary : colors.line }]}>
                  {filled ? <Text variant="title">{code[i]}</Text> : active ? <View style={[styles.caret, { backgroundColor: colors.primary }]} /> : null}
                </View>
              );
            })}
            {/* one real input holds the value (so pasting the code works); the boxes just display it */}
            <TextInput
              ref={input}
              value={code}
              onChangeText={onChange}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              autoFocus
              maxLength={LENGTH}
              caretHidden
              style={[StyleSheet.absoluteFill, styles.hidden]}
            />
          </Pressable>
        </Animated.View>
        {verify.isError ? (
          <Text variant="small" color="danger" accessibilityLiveRegion="polite">
            {verify.error.message}. Check the code and try again.
          </Text>
        ) : null}
      </View>

      <View style={[styles.resend, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium" color="heading">
            Didn’t get the code?
          </Text>
          <Text variant="small" color="muted">
            {seconds > 0 ? `You can ask for a new one in ${seconds}s.` : 'Check your spam folder too. You can ask for a new one.'}
          </Text>
        </View>
        <Button title="Resend" variant="secondary" disabled={seconds > 0} loading={resend.isPending} onPress={() => resend.mutate()} style={styles.resendButton} />
      </View>
      {resend.isError ? <Text color="danger">{resend.error.message}</Text> : null}

      <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8} style={{ alignSelf: 'center' }}>
        <Text variant="bodyMedium" color="primary">
          Use a different email
        </Text>
      </Pressable>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', gap: spacing.sm },
  box: { flex: 1, height: 62, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  caret: { width: 2, height: 26, borderRadius: 1 },
  hidden: { opacity: 0.01, fontFamily: fonts.regular, fontSize: 16 },
  resend: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
  resendButton: { minHeight: 44, paddingHorizontal: spacing.lg },
});
