import React from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import type { DayKey, WeeklySchedule } from '../../lib/data/types';
import { DAY_KEYS, DAY_LABELS, isClockLabel, isClosed, parseRange } from '../../lib/utils/schedule';
import { AppText, Card, Divider, Row } from '../ui/base';
import { Field } from '../ui/Field';

export type DayDraft = { open: boolean; start: string; end: string };
export type ScheduleDraft = Record<DayKey, DayDraft>;

/** Editable form of a stored schedule ("05:30 PM - 07:00 PM" / "Closed"). */
export function toDraft(schedule: WeeklySchedule | null | undefined): ScheduleDraft {
  return Object.fromEntries(
    DAY_KEYS.map((d) => {
      const r = parseRange(schedule?.[d]);
      return [d, { open: !isClosed(schedule?.[d]), start: r?.start ?? '05:00 PM', end: r?.end ?? '06:30 PM' }];
    }),
  ) as ScheduleDraft;
}

export function fromDraft(draft: ScheduleDraft): WeeklySchedule {
  return Object.fromEntries(
    DAY_KEYS.map((d) => [
      d,
      draft[d].open ? `${draft[d].start.trim().toUpperCase()} - ${draft[d].end.trim().toUpperCase()}` : 'Closed',
    ]),
  ) as WeeklySchedule;
}

/** Open days whose times aren't like "09:00 AM". */
export function badScheduleDays(draft: ScheduleDraft): DayKey[] {
  return DAY_KEYS.filter((d) => draft[d].open && !(isClockLabel(draft[d].start) && isClockLabel(draft[d].end)));
}

/** Seven-day timetable editor, ported from the demo's batch settings. */
export function WeeklyScheduleEditor({ value, onChange }: { value: ScheduleDraft; onChange: (next: ScheduleDraft) => void }) {
  const { colors } = useTheme();
  const bad = badScheduleDays(value);
  const setDay = (d: DayKey, patch: Partial<DayDraft>) => onChange({ ...value, [d]: { ...value[d], ...patch } });

  return (
    <View>
      <Card padded={false}>
        {DAY_KEYS.map((d, idx) => {
          const day = value[d];
          const isBad = bad.includes(d);
          return (
            <View key={d}>
              {idx > 0 ? <Divider inset={spacing.lg} /> : null}
              <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
                <Row justify="space-between">
                  <AppText variant="subheading" style={{ width: 48 }}>
                    {DAY_LABELS[d]}
                  </AppText>
                  {day.open ? null : (
                    <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
                      No class
                    </AppText>
                  )}
                  <Switch
                    value={day.open}
                    onValueChange={(open) => setDay(d, { open })}
                    trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
                    thumbColor={Platform.OS === 'android' ? colors.surface : undefined}
                    accessibilityLabel={`${DAY_LABELS[d]} class`}
                  />
                </Row>
                {day.open ? (
                  <Row gap={spacing.sm} style={{ marginTop: spacing.sm }}>
                    <Ionicons name="sunny-outline" size={15} color={colors.gold} />
                    <Field
                      value={day.start}
                      onChangeText={(t) => setDay(d, { start: t })}
                      placeholder="05:00 PM"
                      autoCapitalize="characters"
                      maxLength={8}
                      style={[styles.time, isBad && { borderColor: colors.error }]}
                    />
                    <AppText variant="overline" tone="muted">
                      TO
                    </AppText>
                    <Ionicons name="moon-outline" size={14} color={colors.info} />
                    <Field
                      value={day.end}
                      onChangeText={(t) => setDay(d, { end: t })}
                      placeholder="06:30 PM"
                      autoCapitalize="characters"
                      maxLength={8}
                      style={[styles.time, isBad && { borderColor: colors.error }]}
                    />
                  </Row>
                ) : null}
              </View>
            </View>
          );
        })}
      </Card>
      {bad.length ? (
        <AppText variant="caption" tone="error" style={{ marginTop: spacing.sm }}>
          Use times like 05:30 PM for {bad.map((d) => DAY_LABELS[d]).join(', ')}.
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  time: { flex: 1, paddingVertical: 8, paddingHorizontal: spacing.md, fontSize: 13.5, textAlign: 'center' },
});
