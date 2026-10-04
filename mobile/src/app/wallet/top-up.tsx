import { useRouter } from 'expo-router';
import { Building2, CreditCard, Hash } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTopUp } from '@/api/queries';
import type { TopUpChannel } from '@/api/types';
import { Button, Chip, Input, OptionRow, Screen, Text } from '@/components/ui';
import { formatNaira, nairaToKobo } from '@/lib/money';
import { radius, spacing, useTheme } from '@/theme';

const presets = [1000, 2000, 5000, 10000];
const MIN_NAIRA = 100;

export default function TopUpScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const topUp = useTopUp();
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState<TopUpChannel>('card');
  const naira = Number(amount.replace(/[^\d]/g, ''));
  const valid = naira >= MIN_NAIRA;
  const icon = (Icon: typeof CreditCard) => (
    <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
      <Icon size={18} color={colors.primary} />
    </View>
  );

  return (
    <Screen
      footer={
        <Button
          title={valid ? `Pay ${formatNaira(nairaToKobo(naira))}` : 'Enter an amount'}
          disabled={!valid}
          loading={topUp.isPending}
          onPress={() => topUp.mutate({ amountKobo: nairaToKobo(naira), channel }, { onSuccess: () => router.back() })}
        />
      }>
      <Input
        label="Amount"
        placeholder="0"
        value={amount}
        onChangeText={(t) => setAmount(t.replace(/[^\d]/g, ''))}
        keyboardType="number-pad"
        left={<Text variant="heading">₦</Text>}
        style={{ fontSize: 22 }}
        error={amount && !valid ? `The minimum top-up is ₦${MIN_NAIRA}` : null}
      />
      <View style={styles.presets}>
        {presets.map((p) => (
          <Chip key={p} label={formatNaira(nairaToKobo(p))} selected={naira === p} onPress={() => setAmount(String(p))} />
        ))}
      </View>

      <Text variant="heading">Pay with</Text>
      <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
        <OptionRow title="Debit card" subtitle="Visa, Mastercard, Verve" selected={channel === 'card'} onPress={() => setChannel('card')} left={icon(CreditCard)} />
        <OptionRow title="Bank transfer" subtitle="Transfer to a one-time account number" selected={channel === 'transfer'} onPress={() => setChannel('transfer')} left={icon(Building2)} />
        <OptionRow title="USSD" subtitle="Dial a code from your bank" selected={channel === 'ussd'} onPress={() => setChannel('ussd')} left={icon(Hash)} />
      </View>
      {topUp.isError ? <Text color="danger">{topUp.error.message}</Text> : null}
      <Text variant="small" color="subtle" center>
        Payments are processed securely by Paystack.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
