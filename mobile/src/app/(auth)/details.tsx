import { useMutation } from '@tanstack/react-query';
import { ChevronDown, CircleCheck, Gift, User, UserRoundPlus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import { AuthScaffold } from '@/components/AuthScaffold';
import { PhoneField } from '@/components/PhoneField';
import { Button, Input, Text } from '@/components/ui';
import { normalisePhone } from '@/lib/phone';
import { isName } from '@/lib/validate';
import { useSession } from '@/store/session';
import { radius, spacing, useTheme } from '@/theme';

/** Last sign-up step, new users only: name and phone number, with an optional friend's code. */
export default function DetailsScreen() {
  const { colors } = useTheme();
  const { token, pendingEmail, signIn, signOut } = useSession();
  const [name, setName] = useState('');
  const [digits, setDigits] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [hasCode, setHasCode] = useState(false);
  const [touched, setTouched] = useState(false);
  const phone = normalisePhone(digits);
  const signUp = useMutation({
    mutationFn: () => api.completeSignUp({ name, phone: phone!, referralCode: referralCode.trim() || undefined }),
    onSuccess: (user) => signIn(token!, user),
  });

  const submit = () => {
    setTouched(true);
    if (isName(name) && phone) signUp.mutate();
  };

  return (
    <AuthScaffold
      step={3}
      icon={UserRoundPlus}
      title="Almost there"
      subtitle="Tell us your name and phone number so your rider knows who to ask for and can call you about a delivery."
      // going back from here would leave a half-made account signed in, so it starts over instead
      onBack={signOut}
      footer={<Button title="Create account" loading={signUp.isPending} onPress={submit} />}>
      {pendingEmail ? (
        <View style={[styles.verified, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <CircleCheck size={20} color={colors.success} />
          <Text variant="small" color="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
            <Text variant="smallMedium" color="heading">
              {pendingEmail}
            </Text>{' '}
            verified
          </Text>
        </View>
      ) : null}

      <Input
        label="Full name"
        placeholder="e.g. Amina Bello"
        value={name}
        onChangeText={setName}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
        autoFocus
        returnKeyType="next"
        left={<User size={20} color={colors.subtle} />}
        error={touched && !isName(name) ? 'Enter your name' : null}
      />
      <PhoneField label="Phone number" value={digits} onChange={setDigits} returnKeyType="done" onSubmitEditing={hasCode ? undefined : submit} error={touched && !phone ? 'Enter a valid Nigerian mobile number, like 803 123 4567' : null} />

      {hasCode ? (
        <Input
          label="Referral code (optional)"
          placeholder="A friend’s code"
          value={referralCode}
          onChangeText={setReferralCode}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          maxLength={20}
          returnKeyType="done"
          onSubmitEditing={submit}
          left={<Gift size={20} color={colors.subtle} />}
        />
      ) : (
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: false }} onPress={() => setHasCode(true)} style={[styles.referral, { backgroundColor: colors.primarySoft }]}>
          <Gift size={20} color={colors.primary} />
          <Text variant="bodyMedium" color="heading" style={{ flex: 1 }}>
            Have a friend’s referral code?
          </Text>
          <ChevronDown size={18} color={colors.primary} />
        </Pressable>
      )}
      {signUp.isError ? (
        <Text color="danger" accessibilityLiveRegion="polite">
          {signUp.error.message}
        </Text>
      ) : null}
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  verified: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, minHeight: 48, borderRadius: radius.pill, borderWidth: 1, alignSelf: 'flex-start', maxWidth: '100%' },
  referral: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.lg, borderRadius: radius.lg },
});
