import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import { studentName, useBatchRoster, usePrivateBatch } from '../../lib/api/privateBatches';
import { rosterForDay, startOf, useBatchMonths, useStudentMonths } from '../../lib/api/attendance';
import {
  classDaysOfMonth,
  localToday,
  LOW_ATTENDANCE,
  markOf,
  percentLabel,
  percentOf,
  prettyTime,
  tally,
  weekdayShort,
} from '../../lib/utils/attendance';
import { currentMonth } from '../../lib/utils/months';
import { useRefresh } from '../../lib/sync/useRefresh';
import { AppText, Card, EmptyState, HeroCard, Pill, PillTone, Row, SectionHeader } from '../../components/ui/base';
import { Screen } from '../../components/ui/Screen';
import { RealTopBar } from '../../components/real/RealTopBar';
import { SyncBanner } from '../../components/real/SyncBanner';
import { MonthPicker } from '../../components/real/MonthPicker';

/** A batch's month of attendance: every class day and every student's percentage. */
export function AttendanceRegisterScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const params = useRoute<any>().params as { batchId: string; month?: string };
  const { data: batch, isLoading } = usePrivateBatch(params.batchId);
  const { data: roster } = useBatchRoster(params.batchId);
  const batchMonths = useBatchMonths(params.batchId);
  const months = useStudentMonths();
  const { refreshing, refresh } = useRefresh();
  const today = localToday();
  const now = currentMonth();
  const [month, setMonth] = useState(params.month ?? now);

  const days = useMemo(
    () =>
      batch
        ? classDaysOfMonth(month, batch.weekly_schedule, batchMonths[month], today, { start: batch.course_start, end: batch.course_end })
        : [],
    [batch, batchMonths, month, today],
  );

  // Everyone who was in the batch at some point this month.
  const students = useMemo(() => {
    const monthEnd = `${month}-31`;
    return roster
      .filter((r) => {
        const start = startOf(r);
        if (!start || start > monthEnd) return false;
        if (r.status === 'approved') return true;
        return days.some((d) => d.state === 'held' && markOf(months[r.id]?.[month], d.date) !== 'P');
      })
      .map((r) => {
        const start = startOf(r);
        return {
          r,
          month: tally(batchMonths, months[r.id], start, today, month),
          overall: tally(batchMonths, months[r.id], start, today),
        };
      })
      .sort((a, b) => (a.month.percent ?? 101) - (b.month.percent ?? 101) || studentName(a.r).localeCompare(studentName(b.r)));
  }, [roster, months, batchMonths, month, today, days]);

  if (isLoading || !batch) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
        <RealTopBar title="Register" />
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : (
          <Screen>
            <EmptyState icon="alert-circle-outline" title="Batch not found" message="It may have been deleted." />
          </Screen>
        )}
      </View>
    );
  }

  const held = days.filter((d) => d.state === 'held' && d.date <= today);
  const cancelled = days.filter((d) => d.state === 'cancelled').length;
  const unmarked = days.filter((d) => d.state === 'unmarked').length;
  // Class-wide: attended seats over held seats this month.
  const seats = students.reduce((s, x) => s + x.month.held, 0);
  const attended = students.reduce((s, x) => s + x.month.attended, 0);
  const average = percentOf(attended, seats);

  // Earliest month with anything to show: the course start, else the first record.
  const recorded = Object.keys(batchMonths).sort()[0];
  const min = batch.course_start ?? (recorded && recorded < now ? recorded : now);
  const max = batch.course_end && batch.course_end > now ? batch.course_end : now;

  const open = (date: string) => navigation.navigate('AttendanceDay', { batchId: batch.id, date });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <RealTopBar title="Register" />
      <Screen refreshing={refreshing} onRefresh={refresh}>
        <SyncBanner />
        <MonthPicker label={batch.name} value={month} onChange={setMonth} min={min < month ? min : month} max={max > month ? max : month} />

        <HeroCard style={{ marginTop: spacing.lg }}>
          <AppText variant="overline" style={{ color: colors.goldBright }}>
            CLASS AVERAGE
          </AppText>
          <AppText variant="metric" style={{ color: '#FDFBF9', marginTop: 2 }}>
            {percentLabel(average)}
          </AppText>
          <Row style={{ marginTop: spacing.md }} gap={spacing.lg}>
            <HeroStat value={held.length} label="HELD" />
            <HeroStat value={cancelled} label="CANCELLED" />
            <HeroStat value={unmarked} label="NOT MARKED" warn={unmarked > 0} />
          </Row>
        </HeroCard>

        {/* ── Class days ───────────────────────────────────────────────── */}
        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Class days" subtitle="Tap a day to mark or change it" />
          {days.length ? (
            <Card padded={false}>
              {days.map((d, i) => {
                const onDay = d.state === 'held' ? rosterForDay(roster, months, d.date) : [];
                const came = onDay.filter((r) => markOf(months[r.id]?.[month], d.date) !== 'A').length;
                const p = percentOf(came, onDay.length);
                const pill: { label: string; tone: PillTone } =
                  d.state === 'held'
                    ? d.date > today
                      ? { label: 'Planned', tone: 'info' }
                      : { label: `${came}/${onDay.length} present`, tone: p != null && p < LOW_ATTENDANCE ? 'warning' : 'success' }
                    : d.state === 'cancelled'
                      ? { label: 'Cancelled', tone: 'error' }
                      : d.state === 'unmarked'
                        ? { label: 'Not marked', tone: 'warning' }
                        : { label: 'Upcoming', tone: 'neutral' };
                return (
                  <Pressable
                    key={d.date}
                    onPress={() => open(d.date)}
                    accessibilityRole="button"
                    accessibilityLabel={`${d.date}, ${pill.label}`}
                    style={({ pressed }) => [
                      styles.row,
                      { borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 },
                      d.date === today ? { backgroundColor: colors.primarySubtle } : null,
                    ]}
                  >
                    <View style={styles.dateCol}>
                      <AppText variant="subheading">{Number(d.date.slice(8))}</AppText>
                      <AppText variant="caption" tone="muted">
                        {weekdayShort(d.date)}
                      </AppText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {d.extra ? 'Extra class' : prettyTime(d.time) || 'Class'}
                      </AppText>
                      {d.note || (d.extra && d.time) ? (
                        <AppText variant="caption" tone="muted" numberOfLines={1}>
                          {d.note ?? prettyTime(d.time)}
                        </AppText>
                      ) : null}
                    </View>
                    <Pill label={pill.label} tone={pill.tone} />
                    <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
                  </Pressable>
                );
              })}
            </Card>
          ) : (
            <EmptyState
              icon="calendar-outline"
              title="No classes this month"
              message="Set class days in Edit batch, or add an extra class from a day's page."
            />
          )}
        </View>

        {/* ── Students ─────────────────────────────────────────────────── */}
        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Students" subtitle={`Lowest attendance first · below ${LOW_ATTENDANCE}% is flagged`} />
          {students.length ? (
            <Card padded={false}>
              {students.map(({ r, month: m, overall }, i) => {
                const low = m.percent != null && m.percent < LOW_ATTENDANCE;
                return (
                  <Row
                    key={r.id}
                    gap={spacing.md}
                    style={[styles.row, { borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: colors.border }]}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {studentName(r)}
                      </AppText>
                      <AppText variant="caption" tone="muted" numberOfLines={1}>
                        {m.held
                          ? `Absent ${m.absent} · Late ${m.late} · of ${m.held} class${m.held === 1 ? '' : 'es'}`
                          : 'No classes held yet'}
                        {overall.held && overall.held !== m.held ? ` · overall ${percentLabel(overall.percent)}` : ''}
                      </AppText>
                    </View>
                    <AppText variant="subheading" style={{ color: low ? colors.error : m.percent == null ? colors.textMuted : colors.success }}>
                      {percentLabel(m.percent)}
                    </AppText>
                  </Row>
                );
              })}
            </Card>
          ) : (
            <EmptyState icon="people-outline" title="No students this month" message="Students count from the day you accept them." />
          )}
        </View>
      </Screen>
    </View>
  );
}

function HeroStat({ value, label, warn }: { value: number; label: string; warn?: boolean }) {
  const { colors } = useTheme();
  return (
    <View>
      <AppText variant="metricSm" style={{ color: warn ? '#FFD7D2' : '#FDFBF9' }}>
        {value}
      </AppText>
      <AppText variant="overline" style={{ color: colors.goldBright }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  dateCol: { width: 38, alignItems: 'center' },
});
