import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import { dayStatus, DayStatus, useBatchMonths, useStudentMonths } from '../../lib/api/attendance';
import { useBatchRoster, usePrivateBatches } from '../../lib/api/privateBatches';
import { useLocalStore } from '../../lib/local/store';
import type { Batch } from '../../lib/local/types';
import {
  classDateLabel,
  classDayOf,
  clockStart,
  localToday,
  LOW_ATTENDANCE,
  monthOf,
  percentOf,
  prettyTime,
  stepClassDay,
} from '../../lib/utils/attendance';
import { AppText, Card, Pill, PillTone, Row, SectionHeader } from '../ui/base';
import { Button } from '../ui/Button';

/** The status of a class day as a pill: not marked, 27/30 present, cancelled… */
export function ClassStatusPill({ status, today }: { status: DayStatus; today: string }) {
  const { day, came, total } = status;
  if (!day) return null;
  let pill: { label: string; tone: PillTone };
  if (day.state === 'held') {
    const p = percentOf(came, total);
    pill =
      day.date > today
        ? { label: 'Planned', tone: 'info' }
        : { label: `${came}/${total} present`, tone: p != null && p < LOW_ATTENDANCE ? 'warning' : 'success' };
  } else if (day.state === 'cancelled') pill = { label: 'Cancelled', tone: 'error' };
  else if (day.state === 'unmarked') pill = { label: 'Not marked', tone: 'warning' };
  else pill = { label: 'Upcoming', tone: 'neutral' };
  return <Pill label={pill.label} tone={pill.tone} />;
}

/** Batch page: today's class (or the next one) and the way into attendance. */
export function BatchAttendanceCard({ batch }: { batch: Batch }) {
  const navigation = useNavigation<any>();
  const batchMonths = useBatchMonths(batch.id);
  const { data: roster } = useBatchRoster(batch.id);
  const months = useStudentMonths();
  const today = localToday();
  const course = { start: batch.course_start, end: batch.course_end };

  const status = dayStatus(batch, batchMonths, roster, months, today, today);
  const next = status.day ? null : stepClassDay(today, 1, batch.weekly_schedule, batchMonths, today, course);
  const nextDay = next ? classDayOf(next, batch.weekly_schedule, batchMonths[monthOf(next)]?.sessions, today, course) : null;

  const openDay = (date: string) => navigation.navigate('AttendanceDay', { batchId: batch.id, date });

  return (
    <View style={{ marginTop: spacing.xxl }}>
      <SectionHeader
        title="Attendance"
        action="Register"
        onAction={() => navigation.navigate('AttendanceRegister', { batchId: batch.id, month: monthOf(today) })}
      />
      <Card>
        {status.day ? (
          <>
            <Row justify="space-between" gap={spacing.sm}>
              <View style={{ flex: 1 }}>
                <AppText variant="overline" tone="muted">
                  TODAY
                </AppText>
                <AppText variant="subheading" numberOfLines={1}>
                  {status.day.extra ? 'Extra class' : prettyTime(status.day.time) || 'Class'}
                </AppText>
                {status.day.note ? (
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {status.day.note}
                  </AppText>
                ) : null}
              </View>
              <ClassStatusPill status={status} today={today} />
            </Row>
            <Button
              label={status.day.state === 'unmarked' ? 'Take attendance' : 'Open today'}
              iconName={status.day.state === 'unmarked' ? 'checkmark-done-outline' : 'arrow-forward'}
              variant={status.day.state === 'unmarked' ? 'primary' : 'secondary'}
              size="sm"
              fullWidth
              onPress={() => openDay(today)}
              style={{ marginTop: spacing.md }}
            />
          </>
        ) : (
          <>
            <AppText variant="subheading">No class today</AppText>
            <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
              {nextDay
                ? `Next: ${classDateLabel(nextDay.date)}${nextDay.time ? ` · ${prettyTime(nextDay.time)}` : ''}`
                : 'No upcoming class on the timetable.'}
            </AppText>
            <Button
              label="Open attendance"
              iconName="calendar-outline"
              variant="secondary"
              size="sm"
              fullWidth
              onPress={() => openDay(today)}
              style={{ marginTop: spacing.md }}
            />
          </>
        )}
      </Card>
    </View>
  );
}

/** Home: every batch with a class today, in time order, each one tap from its register. */
export function TodayClasses() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { data: batches } = usePrivateBatches();
  const batchMonths = useLocalStore((s) => s.batchMonths);
  const enrolments = useLocalStore((s) => s.enrolments);
  const months = useStudentMonths();
  const today = localToday();

  const classes = batches
    .map((b) => ({ b, status: dayStatus(b, batchMonths[b.id] ?? {}, enrolments[b.id] ?? [], months, today, today) }))
    .filter((x) => x.status.day)
    .sort((a, b) => clockStart(a.status.day!.time) - clockStart(b.status.day!.time));
  const toMark = classes.filter((x) => x.status.day!.state === 'unmarked').length;

  if (!batches.length) return null;

  return (
    <View style={{ marginBottom: spacing.xxl }}>
      <SectionHeader
        title="Today’s classes"
        subtitle={
          classes.length
            ? toMark
              ? `${toMark} to mark · ${classDateLabel(today)}`
              : `All marked · ${classDateLabel(today)}`
            : classDateLabel(today, true)
        }
      />
      {classes.length ? (
        <Card padded={false}>
          {classes.map(({ b, status }, i) => (
            <Pressable
              key={b.id}
              onPress={() => navigation.navigate('AttendanceDay', { batchId: b.id, date: today })}
              accessibilityRole="button"
              accessibilityLabel={`${b.name}, attendance`}
              style={({ pressed }) => [
                styles.row,
                { borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={{ width: 64 }}>
                <AppText variant="captionStrong" tone="primary" numberOfLines={1}>
                  {startLabel(status.day!.time)}
                </AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {b.name}
                </AppText>
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {status.day!.extra ? 'Extra class' : status.day!.note ?? [b.subject, b.room].filter(Boolean).join(' · ')}
                </AppText>
              </View>
              <ClassStatusPill status={status} today={today} />
              <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
            </Pressable>
          ))}
        </Card>
      ) : (
        <Card muted>
          <AppText variant="caption" tone="muted">
            No classes today. Enjoy the day — or add an extra class from a batch’s Attendance.
          </AppText>
        </Card>
      )}
    </View>
  );
}

/** "05:00 PM - 06:30 PM" → "05:00 PM" */
function startLabel(time: string | null): string {
  return time ? time.split(/\s*[-–]\s*/)[0] : '—';
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
});
