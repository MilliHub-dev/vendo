import { useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { Bell, Bike, ChevronRight, FileText, LogOut, MessageCircle, Moon, ShieldCheck, Star, type LucideIcon } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { useMe, useRider } from '@/api/queries';
import { Badge, Button, Card, Screen, Text } from '@/components/ui';
import { confirm } from '@/store/confirm';
import { useSession } from '@/store/session';
import { radius, spacing, useTheme } from '@/theme';

import { SUPPORT_WHATSAPP } from '../application';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const me = useMe();
  const rider = useRider();
  const signOut = useSession((s) => s.signOut);
  const r = rider.data;
  const onTrip = r?.presence === 'on_trip';

  return (
    <Screen safeTop>
      <Text variant="title">Profile</Text>

      <View style={[styles.user, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
          <Text variant="title" color="primary">
            {me.data?.name.slice(0, 1) ?? '·'}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading" numberOfLines={1}>
            {me.data?.name ?? '—'}
          </Text>
          <Text variant="small" color="muted">
            {me.data?.phone}
          </Text>
          <Badge label="Approved rider" tone="success" />
        </View>
      </View>

      <View style={styles.stats}>
        <Stat value={String(r?.totalTrips ?? '—')} label="Trips" />
        <Stat value={r?.rating ? r.rating.toFixed(1) : 'New'} label="Rating" icon={<Star size={14} color={colors.warning} fill={colors.warning} />} />
        <Stat value={r ? `${Math.round(r.acceptanceRate * 100)}%` : '—'} label="Accepted" />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Item icon={Bike} label="Vehicle & documents" value={r?.plateNumber} href="/vehicle" />
        <Item icon={Bell} label="Notifications" href="/notifications" />
        <Item icon={Moon} label="Appearance" href="/settings/appearance" />
        <Item icon={MessageCircle} label="Message Vendo operations" onPress={() => Linking.openURL(SUPPORT_WHATSAPP)} />
        <Item icon={FileText} label="Terms of Service" onPress={() => Linking.openURL('https://vendoltd.com/terms/')} />
        <Item icon={ShieldCheck} label="Privacy Policy" onPress={() => Linking.openURL('https://vendoltd.com/privacy/')} />
      </View>

      <Button
        title="Log out"
        variant="ghost"
        icon={<LogOut size={18} color={colors.primary} />}
        disabled={onTrip}
        onPress={() =>
          confirm({
            title: 'Log out?',
            message: 'You’ll go offline and stop receiving orders. Sign in again with your phone number.',
            confirmLabel: 'Log out',
            cancelLabel: 'Stay signed in',
            destructive: true,
            onConfirm: () => {
              queryClient.clear();
              signOut();
            },
          })
        }
      />
      {onTrip ? (
        <Text variant="small" color="subtle" center>
          Finish your current delivery before logging out.
        </Text>
      ) : null}
    </Screen>
  );
}

function Stat({ value, label, icon }: { value: string; label: string; icon?: React.ReactNode }) {
  return (
    <Card style={styles.stat}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {icon}
        <Text variant="heading">{value}</Text>
      </View>
      <Text variant="caption" color="muted">
        {label}
      </Text>
    </Card>
  );
}

function Item({ icon: Icon, label, value, href, onPress }: { icon: LucideIcon; label: string; value?: string; href?: Href; onPress?: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" onPress={onPress ?? (() => href && router.push(href))} style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: colors.line }, pressed && { opacity: 0.8 }]}>
      <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
        <Icon size={18} color={colors.primary} />
      </View>
      <Text variant="bodyMedium" style={{ flex: 1 }}>
        {label}
      </Text>
      {value ? (
        <Text variant="smallMedium" color="muted">
          {value}
        </Text>
      ) : null}
      <ChevronRight size={18} color={colors.subtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  user: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, gap: 2, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  rowIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
