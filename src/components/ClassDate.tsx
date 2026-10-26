import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radius } from '../theme/tokens';
import { daysBetween, WEEKDAYS } from '../lib/utils/format';
import { AppText } from './ui/base';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d, weekday: WEEKDAYS[new Date(y, m - 1, d).getDay()] };
}

/** 'today', 'tomorrow', 'yesterday', else 'Tue 27 Oct'. */
export function classDayLabel(iso: string, today: string): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  const p = parts(iso);
  return `${p.weekday} ${p.d} ${MONTHS[p.m - 1]}`;
}

/** 'Tue 27 Oct' without relative wording. */
export function weekdayDate(iso: string): string {
  const p = parts(iso);
  return `${p.weekday} ${p.d} ${MONTHS[p.m - 1]}`;
}

/** '07:30 PM' -> '7:30 PM' */
export function shortClock(label: string): string {
  return label.replace(/^0/, '');
}

/** Calendar-leaf date block used in class and homework lists. */
export function DateBadge({ iso, tone = 'default', muted }: { iso: string; tone?: 'default' | 'extra' | 'today'; muted?: boolean }) {
  const { colors } = useTheme();
  const p = parts(iso);
  const accent = tone === 'today' ? colors.success : tone === 'extra' ? colors.info : colors.primary;
  return (
    <View
      style={[
        styles.badge,
        { borderColor: colors.border, backgroundColor: colors.surface, opacity: muted ? 0.5 : 1 },
      ]}
    >
      <View style={[styles.top, { backgroundColor: accent }]}>
        <AppText style={{ fontFamily: fonts.sansBold, fontSize: 9, letterSpacing: 0.6, color: '#fff' }}>
          {p.weekday.toUpperCase()}
        </AppText>
      </View>
      <AppText style={{ fontFamily: fonts.sansBold, fontSize: 16, lineHeight: 20, color: colors.textMain }}>{p.d}</AppText>
      <AppText style={{ fontFamily: fonts.sansSemibold, fontSize: 9, color: colors.textMuted, marginBottom: 3 }}>
        {MONTHS[p.m - 1].toUpperCase()}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 44,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    overflow: 'hidden',
  },
  top: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 2 },
});
