import { useMutation } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { CircleCheck, Mail, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { api } from '@/api/client';
import { AuthScaffold } from '@/components/AuthScaffold';
import { Button, Text } from '@/components/ui';
import { isEmail } from '@/lib/validate';
import { fonts, radius, spacing, useTheme } from '@/theme';

/** One screen for both sign-up and login: we email a code to the address. */
export default function EmailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const email = value.trim().toLowerCase();
  const valid = isEmail(email);
  const request = useMutation({ mutationFn: (e: string) => api.requestCode(e) });
  const error = touched && !valid ? 'Enter a valid email address, like you@example.com' : request.isError ? request.error.message : null;

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    request.mutate(email, { onSuccess: () => router.push({ pathname: '/otp', params: { email } }) });
  };

  return (
    <AuthScaffold
      step={1}
      icon={Mail}
      title="What’s your email?"
      subtitle="We’ll email you a 6-digit code to sign you in, or to create your account if you’re new."
      footer={
        <>
          <Button title="Send code" disabled={!value.trim()} loading={request.isPending} onPress={submit} />
          <Text variant="small" color="subtle" center>
            By continuing you agree to Vendo’s{' '}
            <Text variant="small" color="primary" accessibilityRole="link" onPress={() => Linking.openURL('https://vendoltd.com/terms/')}>
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text variant="small" color="primary" accessibilityRole="link" onPress={() => Linking.openURL('https://vendoltd.com/privacy/')}>
              Privacy Policy
            </Text>
            .
          </Text>
        </>
      }>
      <View style={{ gap: 6 }}>
        <View style={[styles.field, { backgroundColor: colors.surface, borderColor: error ? colors.danger : focused ? colors.primary : colors.line }]}>
          <Mail size={22} color={focused ? colors.primary : colors.subtle} />
          <TextInput
            accessibilityLabel="Email address"
            placeholder="you@example.com"
            placeholderTextColor={colors.subtle}
            selectionColor={colors.primary}
            value={value}
            onChangeText={(t) => {
              setValue(t);
              if (request.isError) request.reset();
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submit}
            maxLength={254}
            maxFontSizeMultiplier={1.3}
            style={[styles.input, { color: colors.heading }]}
          />
          {valid ? <CircleCheck size={22} color={colors.success} accessibilityLabel="Valid email address" /> : null}
        </View>
        {error ? (
          <Text variant="small" color="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </View>

      <View style={[styles.note, { backgroundColor: colors.primarySoft }]}>
        <ShieldCheck size={20} color={colors.primary} />
        <Text variant="small" color="muted" style={{ flex: 1 }}>
          No password to remember. We use your email to sign you in and to send your receipts.
        </Text>
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, paddingHorizontal: spacing.lg, borderRadius: radius.lg, borderWidth: 1.5 },
  input: { flex: 1, minWidth: 0, fontFamily: fonts.medium, fontSize: 18, paddingVertical: spacing.md, ...({ outlineStyle: 'none' } as object) },
  note: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg },
});
