import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useEarnings, useWithdrawals } from '@/api/queries';
import type { WithdrawalStatus } from '@/api/types';
import { Badge, Button, Card, Screen, SectionHeader, Text } from '@/components/ui';
import { formatDateTime } from '@/lib/dates';
import { formatNaira } from '@/lib/money';
import { palette, radius, shadows, spacing, useTheme } from '@/theme';

const plural = (n: number) => `${n} trip${n === 1 ? '' : 's'}`;
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const statusTone: Record<WithdrawalStatus, 'warning' | 'success' | 'danger'> = { pending: 'warning', completed: 'success', failed: 'danger' };
const statusLabel: Record<WithdrawalStatus, string> = { pending: 'Pending', completed: 'Paid', failed: 'Failed — refunded' };

export default function EarningsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const earnings = useEarnings();
  const withdrawals = useWithdrawals();
  const e = earnings.data;
  const max = Math.max(1, ...(e?.days.map((d) => d.earnedKobo) ?? [1]));
  const canWithdraw = !!e && e.balanceKobo >= e.minWithdrawalKobo;

  return (
    <Screen safeTop>
      <Text variant="title">Earnings</Text>

      <View style={[styles.balance, shadows.primary, { backgroundColor: palette.blue }]}>
        <Text variant="small" style={{ color: 'rgba(255,255,255,0.8)' }}>
          Available to withdraw
        </Text>
        <Text variant="display" style={{ color: '#fff', fontSize: 40, lineHeight: 46 }}>
          {e ? formatNaira(e.balanceKobo) : '—'}
        </Text>
        <Button title="Withdraw" variant="secondary" disabled={!canWithdraw} onPress={() => router.push('/withdraw')} style={{ alignSelf: 'flex-start', borderWidth: 0, marginTop: spacing.sm }} />
        {e && !canWithdraw ? (
          <Text variant="small" style={{ color: 'rgba(255,255,255,0.85)' }}>
            You can withdraw once you have {formatNaira(e.minWithdrawalKobo)} or more.
          </Text>
        ) : null}
      </View>

      <View style={styles.pair}>
        <Card style={styles.half}>
          <Text variant="caption" color="muted">
            TODAY
          </Text>
          <Text variant="heading" color="primary">
            {e ? formatNaira(e.today.earnedKobo) : '—'}
          </Text>
          <Text variant="small" color="muted">
            {plural(e?.today.trips ?? 0)}
          </Text>
        </Card>
        <Card style={styles.half}>
          <Text variant="caption" color="muted">
            LAST 7 DAYS
          </Text>
          <Text variant="heading" color="primary">
            {e ? formatNaira(e.week.earnedKobo) : '—'}
          </Text>
          <Text variant="small" color="muted">
            {plural(e?.week.trips ?? 0)}
          </Text>
        </Card>
      </View>

      <Card>
        <Text variant="bodyMedium" color="heading">
          This week
        </Text>
        {earnings.isPending ? <ActivityIndicator color={colors.primary} /> : null}
        <View style={styles.chart} accessibilityRole="image" accessibilityLabel={e ? `Earnings for the last 7 days: ${e.days.map((d) => formatNaira(d.earnedKobo)).join(', ')}` : undefined}>
          {e?.days.map((d, i) => {
            const today = i === e.days.length - 1;
            return (
              <View key={d.date} style={styles.barCol}>
                <Text variant="caption" color="subtle" numberOfLines={1} maxFontSizeMultiplier={1}>
                  {d.earnedKobo ? `${Math.round(d.earnedKobo / 100_000)}k` : ''}
                </Text>
                <View style={[styles.bar, { height: Math.max(4, (d.earnedKobo / max) * 96), backgroundColor: today ? colors.primary : colors.primarySoft }]} />
                <Text variant="caption" color={today ? 'primary' : 'muted'} maxFontSizeMultiplier={1.2}>
                  {DAYS[new Date(d.date).getDay()]}
                </Text>
              </View>
            );
          })}
        </View>
      </Card>

      <SectionHeader title="Withdrawals" />
      {withdrawals.data?.length === 0 ? <Text color="muted">No withdrawals yet.</Text> : null}
      {withdrawals.data?.map((w) => (
        <View key={w.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium" color="heading">
              {formatNaira(w.amountKobo)}
            </Text>
            <Text variant="small" color="muted">
              {w.bankName} {w.accountNumber} · {formatDateTime(w.createdAt)}
            </Text>
          </View>
          <Badge label={statusLabel[w.status]} tone={statusTone[w.status]} />
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  balance: { padding: spacing.xl, borderRadius: radius.xl, gap: 4 },
  pair: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1, gap: 2 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: 140, marginTop: spacing.sm },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: '70%', borderRadius: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
});
