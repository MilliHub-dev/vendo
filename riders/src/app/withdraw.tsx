import { useRouter } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useBanks, useEarnings, usePayoutAccount, useRequestWithdrawal } from '@/api/queries';
import type { Bank } from '@/api/types';
import { Button, Chip, Input, Screen, Sheet, Text } from '@/components/ui';
import { formatNaira, nairaToKobo } from '@/lib/money';
import { radius, spacing, useTheme } from '@/theme';

export default function WithdrawScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const earnings = useEarnings();
  const banks = useBanks();
  const request = useRequestWithdrawal();
  const [amount, setAmount] = useState('');
  const [bank, setBank] = useState<Bank | null>(null);
  const [account, setAccount] = useState('');
  const saved = usePayoutAccount();
  const [changing, setChanging] = useState(false);
  // a saved account is used as it is; the bank fields only show for a first account or a change
  const useSaved = !!saved.data && !changing;
  const [picker, setPicker] = useState(false);
  const [touched, setTouched] = useState(false);

  const balance = earnings.data?.balanceKobo ?? 0;
  // set per city on the server, which has the final say when the app doesn't know it
  const min = earnings.data?.minWithdrawalKobo ?? 100;
  const kobo = nairaToKobo(Number(amount) || 0);
  const errors = {
    amount: kobo < min ? (earnings.data?.minWithdrawalKobo ? `The minimum withdrawal is ${formatNaira(min)}` : 'Enter an amount') : kobo > balance ? `That’s more than your balance of ${formatNaira(balance)}` : null,
    bank: !useSaved && !bank ? 'Choose your bank' : null,
    account: !useSaved && !/^\d{10}$/.test(account) ? 'Account numbers have 10 digits' : null,
  };
  const valid = !Object.values(errors).some(Boolean);

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    request.mutate(useSaved ? { amountKobo: kobo } : { amountKobo: kobo, bankCode: bank!.code, accountNumber: account }, { onSuccess: () => router.back() });
  };

  return (
    <Screen footer={<Button title={kobo >= min && kobo <= balance ? `Withdraw ${formatNaira(kobo)}` : 'Withdraw'} loading={request.isPending} onPress={submit} />}>
      <Text color="muted">
        Balance: <Text variant="bodyMedium">{formatNaira(balance)}</Text>
      </Text>
      <Input label="Amount" placeholder="0" value={amount} onChangeText={(t) => setAmount(t.replace(/\D/g, ''))} keyboardType="number-pad" left={<Text variant="heading">₦</Text>} style={{ fontSize: 22 }} error={touched || amount ? errors.amount : null} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {[2000, 5000, 10000].filter((n) => nairaToKobo(n) <= balance).map((n) => (
          <Chip key={n} label={formatNaira(nairaToKobo(n))} selected={Number(amount) === n} onPress={() => setAmount(String(n))} />
        ))}
        <Chip label="All" selected={kobo === balance && balance > 0} onPress={() => setAmount(String(Math.floor(balance / 100)))} />
      </View>

      {useSaved && saved.data ? (
        <View style={[styles.select, { backgroundColor: colors.surface, borderColor: colors.line, minHeight: 68 }]}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium" color="heading">
              {saved.data.bankName} ••••{saved.data.lastFour}
            </Text>
            <Text variant="small" color="muted">
              {saved.data.accountName}
            </Text>
          </View>
          <Chip label="Change" onPress={() => setChanging(true)} />
        </View>
      ) : (
        <>
      <View style={{ gap: 6 }}>
          <Text variant="smallMedium" color="heading">
            Bank
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={bank ? `Bank: ${bank.name}` : 'Choose bank'} onPress={() => setPicker(true)} style={[styles.select, { backgroundColor: colors.surface, borderColor: touched && errors.bank ? colors.danger : colors.line }]}>
            <Text color={bank ? 'text' : 'subtle'} style={{ flex: 1 }}>
              {bank?.name ?? 'Choose your bank'}
            </Text>
            <ChevronDown size={18} color={colors.subtle} />
          </Pressable>
          {touched && errors.bank ? (
            <Text variant="small" color="danger">
              {errors.bank}
            </Text>
          ) : null}
        </View>
        <Input label="Account number" placeholder="10 digits" value={account} onChangeText={(t) => setAccount(t.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" error={touched ? errors.account : null} />
          <Text variant="small" color="subtle">
            We check the account with your bank and pay only to the name it returns.
          </Text>
          {saved.data ? <Chip label="Keep my saved account" onPress={() => setChanging(false)} /> : null}
        </>
      )}
      {request.isError ? <Text color="danger">{request.error.message}</Text> : null}
      <Text variant="small" color="subtle">
        The amount is held as soon as you request it. The Vendo team approves withdrawals and Paystack sends the money to your bank. If a transfer fails, the money returns to your balance.
      </Text>

      <Sheet visible={picker} onClose={() => setPicker(false)} title="Choose your bank">
        {banks.data?.map((b) => (
          <Pressable
            key={b.code}
            accessibilityRole="button"
            onPress={() => {
              setBank(b);
              setPicker(false);
            }}
            style={[styles.bank, { borderBottomColor: colors.line }]}>
            <Text variant="bodyMedium" color={bank?.code === b.code ? 'primary' : 'heading'}>
              {b.name}
            </Text>
          </Pressable>
        ))}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  select: { flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  bank: { paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth },
});
