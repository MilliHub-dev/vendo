import { Image } from 'expo-image';
import { Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, View } from 'react-native';

import { useApplyReferralCode, useReferrals } from '@/api/queries';
import { Badge, Button, Card, Input, Screen, SectionHeader, Text } from '@/components/ui';
import { dayLabel } from '@/lib/dates';
import { formatNaira } from '@/lib/money';
import { palette, radius, spacing, useTheme } from '@/theme';

/** Refer a friend: your code, how it works, what you've earned, and a place to enter a friend's code. */
export default function ReferralsScreen() {
  const { colors } = useTheme();
  const { data, isPending } = useReferrals();
  const apply = useApplyReferralCode();
  const [code, setCode] = useState('');

  if (isPending || !data) return <Screen scroll={false}>{isPending ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} /> : <Text color="danger">Couldn’t load referrals.</Text>}</Screen>;

  const give = formatNaira(data.refereeDiscountKobo);
  const get = formatNaira(data.referrerRewardKobo);
  const share = () => Share.share({ message: `Get ${give} off your first Vendo order — food delivery and bike dispatch. Sign up with my code ${data.code}: ${data.shareUrl}` });
  const steps = [
    `Share your code with a friend who’s new to Vendo.`,
    `They get ${give} off their first order.`,
    `When that order is delivered, ${get} lands in your Vendo Wallet.`,
  ];

  return (
    <Screen>
      <View style={[styles.hero, { backgroundColor: palette.blue }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="title" style={{ color: '#fff' }}>
            Give {give}, get {get}
          </Text>
          <Text variant="small" style={{ color: 'rgba(255,255,255,0.85)' }}>
            Invite friends to Vendo and you both save.
          </Text>
        </View>
        <Image source={require('@/assets/images/art-boxes.png')} style={{ width: 92, height: 92 }} contentFit="contain" />
      </View>

      <Card style={{ alignItems: 'center' }}>
        <Text variant="eyebrow">Your code</Text>
        <Text variant="display" color="primary" selectable style={{ letterSpacing: 3 }}>
          {data.code}
        </Text>
        <Button title="Share my code" icon={<Share2 size={18} color={colors.onPrimary} />} onPress={share} style={{ alignSelf: 'stretch' }} />
      </Card>

      <View style={styles.stats}>
        <Card style={styles.stat}>
          <Text variant="title">{data.friends.length}</Text>
          <Text variant="small" color="muted">
            Friends joined
          </Text>
        </Card>
        <Card style={styles.stat}>
          <Text variant="title" color="primary">
            {formatNaira(data.earnedKobo)}
          </Text>
          <Text variant="small" color="muted">
            Earned so far
          </Text>
        </Card>
      </View>

      <SectionHeader title="How it works" />
      <Card>
        {steps.map((text, i) => (
          <View key={text} style={styles.step}>
            <View style={[styles.num, { backgroundColor: colors.primary }]}>
              <Text variant="smallMedium" color="onPrimary">
                {i + 1}
              </Text>
            </View>
            <Text style={{ flex: 1 }}>{text}</Text>
          </View>
        ))}
      </Card>

      {data.friends.length ? (
        <>
          <SectionHeader title="Your friends" />
          {data.friends.map((f) => (
            <View key={f.name + f.joinedAt} style={[styles.friend, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
                <Text variant="bodyMedium" color="primary">
                  {f.name.slice(0, 1)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium" color="heading">
                  {f.name}
                </Text>
                <Text variant="small" color="muted">
                  Joined {dayLabel(new Date(f.joinedAt)).toLowerCase()}
                </Text>
              </View>
              {f.status === 'rewarded' ? <Badge label={`+${get} earned`} tone="success" /> : <Badge label="No order yet" tone="muted" />}
            </View>
          ))}
        </>
      ) : null}

      <SectionHeader title="Have a friend’s code?" />
      {data.appliedCode ? (
        <Card>
          <Text variant="bodyMedium">Code {data.appliedCode} added</Text>
          <Text variant="small" color="muted">
            {give} comes off your first order automatically.
          </Text>
        </Card>
      ) : data.canApply ? (
        <>
          <Input
            placeholder="Enter referral code"
            value={code}
            onChangeText={(t) => {
              setCode(t);
              if (apply.isError) apply.reset();
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
            error={apply.isError ? apply.error.message : null}
          />
          <Button title="Add code" variant="secondary" disabled={!code.trim()} loading={apply.isPending} onPress={() => apply.mutate(code, { onSuccess: () => setCode('') })} />
        </>
      ) : (
        <Text color="muted">A friend’s code can only be added before your first order.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl },
  stats: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, gap: 2 },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 },
  num: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  friend: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
