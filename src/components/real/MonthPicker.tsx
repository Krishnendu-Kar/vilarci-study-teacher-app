import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/tokens';
import { addMonths, monthLabel } from '../../lib/utils/months';
import { AppText } from '../ui/base';

/** ‹ Apr 2026 › month stepper. `min`/`max` are month keys ("YYYY-MM-01"). */
export function MonthPicker({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  min?: string;
  max?: string;
}) {
  const { colors } = useTheme();
  const prev = addMonths(value, -1);
  const next = addMonths(value, 1);
  const canPrev = !min || prev >= min;
  const canNext = !max || next <= max;

  const Arrow = ({ dir, enabled, to }: { dir: 'back' | 'forward'; enabled: boolean; to: string }) => (
    <Pressable
      onPress={() => enabled && onChange(to)}
      disabled={!enabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${dir === 'back' ? 'previous' : 'next'} month`}
      style={({ pressed }) => [styles.arrow, { backgroundColor: colors.surface, opacity: !enabled ? 0.3 : pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={dir === 'back' ? 'chevron-back' : 'chevron-forward'} size={17} color={colors.textMain} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, gap: 6 }}>
      <AppText variant="overline" tone="muted">
        {label.toUpperCase()}
      </AppText>
      <View style={[styles.box, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        <Arrow dir="back" enabled={canPrev} to={prev} />
        <AppText variant="subheading" center style={{ flex: 1 }}>
          {monthLabel(value)}
        </AppText>
        <Arrow dir="forward" enabled={canNext} to={next} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  arrow: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
