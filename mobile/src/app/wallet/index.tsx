import { useRouter } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useWallet } from '@/api/queries';
import { Button, Screen, SectionHeader, Text } from '@/components/ui';
import { formatDateTime } from '@/lib/dates';
import { formatNaira } from '@/lib/money';
import { palette, radius, shadows, spacing, useTheme } from '@/theme';

export default function WalletScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const wallet = useWallet();

  return (
    <Screen>
      <View style={[styles.balance, shadows.primary, { backgroundColor: palette.blue }]}>
        <Text variant="small" style={{ color: 'rgba(255,255,255,0.8)' }}>
          Available balance
        </Text>
        <Text variant="display" style={{ color: '#fff', fontSize: 40, lineHeight: 46 }}>
          {wallet.data ? formatNaira(wallet.data.balanceKobo) : '—'}
        </Text>
        <Button title="Top up" variant="secondary" onPress={() => router.push('/wallet/top-up')} style={{ alignSelf: 'flex-start', borderWidth: 0, marginTop: spacing.sm }} />
      </View>
      <Text variant="small" color="subtle">
        Wallet money is for Vendo orders and can’t be withdrawn as cash.
      </Text>

      <SectionHeader title="Transactions" />
      {wallet.isPending ? <ActivityIndicator color={colors.primary} /> : null}
      {wallet.data?.transactions.length === 0 ? <Text color="muted">No transactions yet.</Text> : null}
      {wallet.data?.transactions.map((t) => {
        const credit = t.direction === 'credit';
        const Icon = credit ? ArrowDownLeft : ArrowUpRight;
        return (
          <View key={t.id} style={[styles.txn, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <View style={[styles.icon, { backgroundColor: colors.surfaceAlt }]}>
              <Icon size={18} color={credit ? colors.success : colors.heading} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium" color="heading">
                {t.label}
              </Text>
              <Text variant="caption" color="subtle">
                {formatDateTime(t.createdAt)} · {t.reference}
              </Text>
            </View>
            <Text variant="bodyMedium" color={credit ? 'success' : 'heading'}>
              {credit ? '+' : '−'}
              {formatNaira(t.amountKobo)}
            </Text>
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  balance: { padding: spacing.xl, borderRadius: radius.xl, gap: 4 },
  txn: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
