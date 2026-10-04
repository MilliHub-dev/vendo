import type { ReactNode } from 'react';
import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { fonts, radius, spacing, useTheme } from '@/theme';

import { Text } from './Text';

type Props = TextInputProps & { label?: string; error?: string | null; left?: ReactNode; right?: ReactNode };

export function Input({ label, error, left, right, style, ...rest }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text variant="smallMedium" color="heading">
          {label}
        </Text>
      ) : null}
      <View style={[styles.field, { backgroundColor: colors.surface, borderColor: error ? colors.danger : focused ? colors.primary : colors.line }, rest.multiline && { alignItems: 'flex-start' }]}>
        {left}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.subtle}
          selectionColor={colors.primary}
          maxFontSizeMultiplier={1.4}
          style={[styles.input, { color: colors.text }, rest.multiline && { minHeight: 84, textAlignVertical: 'top' }, style]}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
        />
        {right}
      </View>
      {error ? (
        <Text variant="small" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 54, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  // 16px keeps iOS Safari from zooming in on focus
  // on web the field's border shows focus, so the browser's own outline is switched off
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, paddingVertical: spacing.md, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) },
});
