import { CircleCheck } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { normalisePhone } from '@/lib/phone';
import { fonts, radius, spacing, useTheme } from '@/theme';

import { Text } from './ui';

/** 8031234567 → "803 123 4567", as it's typed. */
const pretty = (digits: string) => [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean).join(' ');
/** Keeps the 10 digits after the country code, whether someone types 0803…, 803… or pastes +234803… */
export const localDigits = (text: string) => {
  const d = text.replace(/\D/g, '');
  return (d.startsWith('234') && d.length > 10 ? d.slice(3) : d.startsWith('0') ? d.slice(1) : d).slice(0, 10);
};

/** Nigerian mobile number field: +234 chip, formats as you type, green tick when valid. `value` is the 10 local digits. */
export function PhoneField({ label, value, onChange, error, ...rest }: { label?: string; value: string; onChange: (digits: string) => void; error?: string | null } & Omit<TextInputProps, 'value' | 'onChange' | 'onChangeText'>) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const valid = !!normalisePhone(value);
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text variant="smallMedium" color="heading">
          {label}
        </Text>
      ) : null}
      <View style={[styles.field, { backgroundColor: colors.surface, borderColor: error ? colors.danger : focused ? colors.primary : colors.line }]}>
        <View style={[styles.country, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={{ fontSize: 18 }} maxFontSizeMultiplier={1.2}>
            🇳🇬
          </Text>
          <Text variant="bodyMedium" color="heading">
            +234
          </Text>
        </View>
        <TextInput
          accessibilityLabel={label ?? 'Phone number'}
          placeholder="803 123 4567"
          placeholderTextColor={colors.subtle}
          selectionColor={colors.primary}
          value={pretty(value)}
          onChangeText={(t) => onChange(localDigits(t))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={14}
          maxFontSizeMultiplier={1.3}
          style={[styles.input, { color: colors.heading }]}
          {...rest}
        />
        {valid ? <CircleCheck size={22} color={colors.success} accessibilityLabel="Valid number" /> : null}
      </View>
      {error ? (
        <Text variant="small" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, paddingLeft: 6, paddingRight: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  country: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 46, paddingHorizontal: spacing.md, borderRadius: radius.sm ?? 10 },
  input: { flex: 1, minWidth: 0, fontFamily: fonts.semibold, fontSize: 18, letterSpacing: 0.5, paddingVertical: spacing.md, ...({ outlineStyle: 'none' } as object) },
});
