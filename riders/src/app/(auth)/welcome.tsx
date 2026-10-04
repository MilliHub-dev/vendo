import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Banknote, Clock, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

const points: { icon: LucideIcon; text: string }[] = [
  { icon: Clock, text: 'Go online when it suits you' },
  { icon: Banknote, text: 'See what you’ll earn before you accept' },
  { icon: ShieldCheck, text: 'Withdraw to any Nigerian bank' },
];

export default function WelcomeScreen() {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.brand}>
        <Image source={scheme === 'dark' ? require('@/assets/images/logo-white.png') : require('@/assets/images/logo-blue.png')} style={styles.logo} contentFit="contain" accessibilityLabel="Vendo" />
        <View style={[styles.tag, { backgroundColor: colors.heading }]}>
          <Text variant="caption" style={{ color: colors.bg }}>
            RIDER
          </Text>
        </View>
      </View>
      <View style={[styles.artWrap, { backgroundColor: colors.surfaceAlt }]}>
        <Image source={require('@/assets/images/art-rider.png')} style={styles.art} contentFit="contain" />
      </View>
      <View style={{ gap: spacing.md }}>
        <Text variant="display" center>
          Earn with every{'\n'}delivery
        </Text>
        <View style={{ gap: spacing.sm }}>
          {points.map(({ icon: Icon, text }) => (
            <View key={text} style={styles.point}>
              <View style={[styles.pointIcon, { backgroundColor: colors.primarySoft }]}>
                <Icon size={18} color={colors.primary} />
              </View>
              <Text style={{ flex: 1 }}>{text}</Text>
            </View>
          ))}
        </View>
      </View>
      <Button title="Get started" onPress={() => router.push('/phone')} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'space-between', gap: spacing.lg },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  logo: { width: 112, height: 28 },
  tag: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  artWrap: { flex: 1, maxHeight: 300, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  art: { width: '78%', height: '86%' },
  point: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pointIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
