import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/tokens';
import { Mark, MARK_LABEL } from '../../lib/utils/attendance';
import { AppText } from '../ui/base';

const ORDER: Mark[] = ['P', 'L', 'A'];

/** Present / Late / Absent for one student, as three compact radio buttons. */
export function MarkToggle({ value, onChange, name }: { value: Mark; onChange: (m: Mark) => void; name: string }) {
  const { colors } = useTheme();
  const tone: Record<Mark, { bg: string; fg: string }> = {
    P: { bg: colors.success, fg: '#FFFFFF' },
    L: { bg: colors.warning, fg: '#FFFFFF' },
    A: { bg: colors.error, fg: '#FFFFFF' },
  };
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={`${name}'s attendance`}>
      {ORDER.map((m) => {
        const on = value === m;
        return (
          <Pressable
            key={m}
            onPress={() => !on && onChange(m)}
            hitSlop={4}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${MARK_LABEL[m]}`}
            style={({ pressed }) => [
              styles.btn,
              {
                backgroundColor: on ? tone[m].bg : colors.surfaceMuted,
                borderColor: on ? tone[m].bg : colors.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <AppText variant="captionStrong" style={{ color: on ? tone[m].fg : colors.textMuted }}>
              {m}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', gap: 6 },
  btn: {
    width: 36,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
