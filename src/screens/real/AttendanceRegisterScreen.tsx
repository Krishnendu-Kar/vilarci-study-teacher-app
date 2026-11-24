import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import { studentName, useBatchRoster, usePrivateBatch } from '../../lib/api/privateBatches';
import {
  describeAttendanceError,
  REMARK_MAX,
  rosterForDay,
  setRemark,
  startOf,
  useBatchMonths,
  useStudentMonths,
} from '../../lib/api/attendance';
import type { Batch, BatchMonth, Enrolment, EnrolmentMonth } from '../../lib/local/types';
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
import { currentMonth, monthLabel, monthsBetween } from '../../lib/utils/months';
import { useRefresh } from '../../lib/sync/useRefresh';
import { AppText, Card, EmptyState, HeroCard, Pill, PillTone, Row, SectionHeader } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/Field';
import { Pager } from '../../components/ui/Pager';
import { Screen } from '../../components/ui/Screen';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { RealTopBar } from '../../components/real/RealTopBar';
import { SyncBanner } from '../../components/real/SyncBanner';
import { MonthPicker } from '../../components/real/MonthPicker';

/**
 * A batch's attendance, one month per page: every class day and every
 * student's percentage. Swipe (or ‹ ›) between months — the two months on
 * each side are built ahead, so swiping is instant.
 */
export function AttendanceRegisterScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const params = useRoute<any>().params as { batchId: string; month?: string };
  const { data: batch, isLoading } = usePrivateBatch(params.batchId);
  const { data: roster } = useBatchRoster(params.batchId);
  const batchMonths = useBatchMonths(params.batchId);
  const months = useStudentMonths();
  const today = localToday();
  const now = currentMonth();
  const [month, setMonth] = useState(params.month ?? now);
  const [remarkFor, setRemarkFor] = useState<{ r: Enrolment; month: string } | null>(null);
  const toast = useToast();

  // Earliest month with anything to show: the course start, else the first record; up to the course end (or now).
  const recorded = Object.keys(batchMonths).sort()[0];
  const min = batch?.course_start ?? (recorded && recorded < now ? recorded : now);
  const max = batch?.course_end && batch.course_end > now ? batch.course_end : now;
  const first = min < month ? min : month;
  const last = max > month ? max : month;
  const pages = useMemo(() => monthsBetween(first, last), [first, last]);

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <RealTopBar title="Register" />
      <Pager
        pages={pages}
        current={month}
        onChange={setMonth}
        preload={2}
        renderPage={(mo) => (
          <RegisterPage
            batch={batch}
            roster={roster}
            batchMonths={batchMonths}
            months={months}
            today={today}
            month={mo}
            min={first}
            max={last}
            onMonth={setMonth}
            onOpenDay={(date) => navigation.navigate('AttendanceDay', { batchId: batch.id, date })}
            onRemark={(r) => setRemarkFor({ r, month: mo })}
          />
        )}
      />

      {remarkFor ? (
        <RemarkSheet
          key={`${remarkFor.r.id}:${remarkFor.month}`}
          name={studentName(remarkFor.r)}
          month={remarkFor.month}
          initial={months[remarkFor.r.id]?.[remarkFor.month]?.remark ?? ''}
          onClose={() => setRemarkFor(null)}
          onSave={(text) => {
            const { r, month: mo } = remarkFor;
            setRemarkFor(null);
            setRemark(batch.id, r.id, mo, text)
              .then(() => toast.toast(text.trim() ? 'Remark saved — parents see it' : 'Remark removed', 'success'))
              .catch((err) => toast.toast(describeAttendanceError(err), 'error'));
          }}
        />
      ) : null}
    </View>
  );
}

/** One month: class average, the class days and the students (lowest first). */
function RegisterPage({
  batch,
  roster,
  batchMonths,
  months,
  today,
  month,
  min,
  max,
  onMonth,
  onOpenDay,
  onRemark,
}: {
  batch: Batch;
  roster: Enrolment[];
  batchMonths: Record<string, BatchMonth>;
  months: Record<string, Record<string, EnrolmentMonth>>;
  today: string;
  month: string;
  min: string;
  max: string;
  onMonth: (m: string) => void;
  onOpenDay: (date: string) => void;
  onRemark: (r: Enrolment) => void;
}) {
  const { colors } = useTheme();
  const { refreshing, refresh } = useRefresh();

  const days = useMemo(
    () => classDaysOfMonth(month, batch.weekly_schedule, batchMonths[month], today, { start: batch.course_start, end: batch.course_end }),
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

  const held = days.filter((d) => d.state === 'held' && d.date <= today);
  const cancelled = days.filter((d) => d.state === 'cancelled').length;
  const unmarked = days.filter((d) => d.state === 'unmarked').length;
  // Class-wide: attended seats over held seats this month.
  const seats = students.reduce((s, x) => s + x.month.held, 0);
  const attended = students.reduce((s, x) => s + x.month.attended, 0);
  const average = percentOf(attended, seats);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <SyncBanner />
      <MonthPicker label={`${batch.name} · swipe for other months`} value={month} onChange={onMonth} min={min} max={max} />

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
                  onPress={() => onOpenDay(d.date)}
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
          <EmptyState icon="calendar-outline" title="No classes this month" message="Set class days in Edit batch, or add an extra class from a day's page." />
        )}
      </View>

      {/* ── Students ─────────────────────────────────────────────────── */}
      <View style={{ marginTop: spacing.xxl }}>
        <SectionHeader title="Students" subtitle={`Lowest attendance first · below ${LOW_ATTENDANCE}% is flagged · tap to add a remark`} />
        {students.length ? (
          <Card padded={false}>
            {students.map(({ r, month: m, overall }, i) => {
              const low = m.percent != null && m.percent < LOW_ATTENDANCE;
              const remark = months[r.id]?.[month]?.remark;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => onRemark(r)}
                  accessibilityRole="button"
                  accessibilityLabel={`${studentName(r)}, ${percentLabel(m.percent)}. ${remark ? 'Edit' : 'Add'} the remark for ${monthLabel(month)}`}
                  style={({ pressed }) => [
                    styles.row,
                    { borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {studentName(r)}
                    </AppText>
                    <AppText variant="caption" tone="muted" numberOfLines={1}>
                      {m.held ? `Absent ${m.absent} · Late ${m.late} · of ${m.held} class${m.held === 1 ? '' : 'es'}` : 'No classes held yet'}
                      {overall.held && overall.held !== m.held ? ` · overall ${percentLabel(overall.percent)}` : ''}
                    </AppText>
                    {remark ? (
                      <Row gap={4} align="flex-start" style={{ marginTop: 3 }}>
                        <Ionicons name="chatbox-ellipses-outline" size={13} color={colors.primary} style={{ marginTop: 2 }} />
                        <AppText variant="caption" tone="secondary" numberOfLines={2} style={{ flex: 1 }}>
                          {remark}
                        </AppText>
                      </Row>
                    ) : null}
                  </View>
                  <AppText variant="subheading" style={{ color: low ? colors.error : m.percent == null ? colors.textMuted : colors.success }}>
                    {percentLabel(m.percent)}
                  </AppText>
                </Pressable>
              );
            })}
          </Card>
        ) : (
          <EmptyState icon="people-outline" title="No students this month" message="Students count from the day you accept them." />
        )}
      </View>
    </Screen>
  );
}

/** The teacher's note on one student's month — parents see it with their attendance. */
function RemarkSheet({
  name,
  month,
  initial,
  onClose,
  onSave,
}: {
  name: string;
  month: string;
  initial: string;
  onClose: () => void;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState(initial);
  return (
    <Sheet visible onClose={onClose} title={`Remark · ${monthLabel(month)}`} subtitle={`${name} — their parents see this`}>
      <FormField
        label={`Remark (${text.trim().length}/${REMARK_MAX})`}
        placeholder="e.g. Improving in mechanics — needs to practise numericals."
        multiline
        maxLength={REMARK_MAX}
        value={text}
        autoFocus
        onChangeText={setText}
        style={{ minHeight: 110, textAlignVertical: 'top' }}
      />
      <Button label="Save remark" iconName="checkmark" fullWidth onPress={() => onSave(text)} style={{ marginTop: spacing.lg }} />
      {initial ? (
        <Button label="Remove remark" variant="ghost" iconName="trash-outline" fullWidth onPress={() => onSave('')} style={{ marginTop: spacing.sm }} />
      ) : null}
      <AppText variant="caption" tone="muted" center style={{ marginTop: spacing.sm }}>
        Saved on this phone; parents get it after their next refresh.
      </AppText>
    </Sheet>
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
