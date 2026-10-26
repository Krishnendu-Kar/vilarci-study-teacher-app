import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/tokens';
import { AppText } from './base';

export interface SegmentOption {
  value: string;
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}

/** Equal-width segmented switch for two to four mutually exclusive modes. */
export function Segmented({
  options,
  value,
  onChange,
}: {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        padding: 4,
        gap: 4,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceMuted,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              {
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 10,
                borderRadius: radius.sm,
                backgroundColor: active ? colors.surface : 'transparent',
                borderWidth: active ? StyleSheet.hairlineWidth : 0,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            {o.icon ? <Ionicons name={o.icon} size={15} color={active ? colors.primary : colors.textMuted} /> : null}
            <AppText variant="captionStrong" style={{ color: active ? colors.primary : colors.textSecondary }}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
