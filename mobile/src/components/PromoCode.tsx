import { TicketPercent, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useCheckPromo } from '@/api/queries';
import { useCart } from '@/store/cart';
import { fonts, radius, spacing, useTheme } from '@/theme';

import { Text } from './ui';

/** Promo code field for the cart — after the reference: input with an "Apply now" pill. */
export function PromoCode() {
  const { colors } = useTheme();
  const promo = useCart((s) => s.promo);
  const setPromo = useCart((s) => s.setPromo);
  const check = useCheckPromo();
  const [code, setCode] = useState('');

  if (promo) {
    return (
      <View style={[styles.applied, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
        <TicketPercent size={22} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium" color="heading">
            {promo.code} applied
          </Text>
          <Text variant="small" color="muted">
            {promo.description}. The discount shows at checkout.
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove promo code ${promo.code}`} onPress={() => setPromo(null)} hitSlop={10} style={[styles.remove, { backgroundColor: colors.surface }]}>
          <X size={16} color={colors.heading} />
        </Pressable>
      </View>
    );
  }

  const apply = () => {
    if (!code.trim() || check.isPending) return;
    check.mutate(code, {
      onSuccess: (p) => {
        setPromo(p);
        setCode('');
      },
    });
  };

  return (
    <View style={{ gap: 6 }}>
      <View style={[styles.field, { backgroundColor: colors.surface, borderColor: check.isError ? colors.danger : colors.line }]}>
        <TicketPercent size={20} color={colors.subtle} />
        <TextInput
          accessibilityLabel="Promo code"
          placeholder="Promo code"
          placeholderTextColor={colors.subtle}
          value={code}
          onChangeText={(t) => {
            setCode(t);
            if (check.isError) check.reset();
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={apply}
          maxLength={20}
          maxFontSizeMultiplier={1.4}
          style={[styles.input, { color: colors.text }]}
        />
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !code.trim(), busy: check.isPending }} disabled={!code.trim() || check.isPending} onPress={apply} style={[styles.apply, { backgroundColor: colors.primary }, !code.trim() && { opacity: 0.45 }]}>
          <Text variant="smallMedium" color="onPrimary">
            {check.isPending ? 'Checking…' : 'Apply now'}
          </Text>
        </Pressable>
      </View>
      {check.isError ? (
        <Text variant="small" color="danger">
          {check.error.message}. Check the spelling and try again.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56, paddingLeft: spacing.lg, paddingRight: 6, borderRadius: radius.pill, borderWidth: 1 },
  input: { flex: 1, minWidth: 0, fontFamily: fonts.medium, fontSize: 16, paddingVertical: spacing.md, ...({ outlineStyle: 'none' } as object) },
  apply: { minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  applied: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
  remove: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
