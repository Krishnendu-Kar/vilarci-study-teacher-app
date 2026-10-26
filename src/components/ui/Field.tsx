import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, radius, spacing } from '../../theme/tokens';
import { AppText } from './base';

/** Shared text input on the muted porcelain well. */
export function Field({ style, ...props }: React.ComponentProps<typeof TextInput>) {
  const { colors } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      style={[
        {
          backgroundColor: colors.surfaceMuted,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: 13,
          color: colors.textMain,
          fontSize: 14.5,
          fontFamily: fonts.sans,
        },
        style,
      ]}
      {...props}
    />
  );
}

/** Labelled field used in every form sheet. */
export function FormField({
  label,
  hint,
  error,
  containerStyle,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  hint?: string;
  error?: string | null;
  containerStyle?: React.ComponentProps<typeof View>['style'];
}) {
  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      <AppText variant="overline" tone="muted">
        {label.toUpperCase()}
      </AppText>
      <Field {...props} />
      {error ? (
        <AppText variant="caption" tone="error">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
