import { useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { Bell, ChevronRight, FileText, Gift, LogOut, MapPin, MessageCircle, Moon, Pencil, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { useMe, useWallet } from '@/api/queries';
import { Button, IconButton, Screen, Text } from '@/components/ui';
import { formatNaira } from '@/lib/money';
import { useCart } from '@/store/cart';
import { confirm } from '@/store/confirm';
import { useSession } from '@/store/session';
import { palette, radius, shadows, spacing, useTheme } from '@/theme';

const SUPPORT_WHATSAPP = 'https://wa.me/2348144461726';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useMe();
  const wallet = useWallet();
  const signOut = useSession((s) => s.signOut);
  const clearCart = useCart((s) => s.clear);
  const user = me.data;

  return (
    <Screen safeTop>
      <Text variant="title">Profile</Text>

      <View style={[styles.user, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
          <Text variant="title" color="primary">
            {user?.name.slice(0, 1) ?? '·'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="heading" numberOfLines={1}>
            {user?.name ?? '—'}
          </Text>
          <Text variant="small" color="muted">
            {user?.phone}
          </Text>
          <Text variant="small" color="muted" numberOfLines={1}>
            {user?.email}
          </Text>
        </View>
        <IconButton icon={Pencil} label="Edit profile" tone="soft" onPress={() => router.push('/profile-edit')} />
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Wallet" onPress={() => router.push('/wallet')} style={[styles.wallet, shadows.primary, { backgroundColor: palette.blue }]}>
        <View style={{ flex: 1 }}>
          <Text variant="small" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Vendo Wallet
          </Text>
          <Text variant="display" style={{ color: '#fff' }}>
            {wallet.data ? formatNaira(wallet.data.balanceKobo) : '—'}
          </Text>
        </View>
        <Button title="Top up" variant="secondary" onPress={() => router.push('/wallet/top-up')} style={{ minHeight: 44, borderWidth: 0 }} />
      </Pressable>

      <View style={{ gap: spacing.sm }}>
        <Item icon={MapPin} label="Saved addresses" href="/addresses" />
        <Item icon={Bell} label="Notifications" href="/notifications" />
        <Item icon={Gift} label="Refer a friend" value={user?.referralCode} href="/referrals" />
        <Item icon={Moon} label="Appearance" href="/settings/appearance" />
        <Item icon={MessageCircle} label="Help on WhatsApp" onPress={() => Linking.openURL(SUPPORT_WHATSAPP)} />
        <Item icon={FileText} label="Terms of Service" onPress={() => Linking.openURL('https://vendoltd.com/terms/')} />
        <Item icon={ShieldCheck} label="Privacy Policy" onPress={() => Linking.openURL('https://vendoltd.com/privacy/')} />
      </View>

      <Button
        title="Log out"
        variant="ghost"
        icon={<LogOut size={18} color={colors.primary} />}
        onPress={() =>
          confirm({
            title: 'Log out?',
            message: 'You’ll need your email and a new code to sign back in.',
            confirmLabel: 'Log out',
            cancelLabel: 'Stay signed in',
            destructive: true,
            onConfirm: () => {
              clearCart();
              queryClient.clear();
              signOut();
            },
          })
        }
      />
    </Screen>
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
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  rowIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
