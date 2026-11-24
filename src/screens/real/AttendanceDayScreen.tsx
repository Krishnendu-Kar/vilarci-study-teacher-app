import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/tokens';
import { studentName, useBatchRoster, usePrivateBatch } from '../../lib/api/privateBatches';
import {
  addExtraClass,
  CANCEL_REASONS,
  clearDay,
  describeAttendanceError,
  markAllPresent,
  markCancelled,
  markHeld,
  rosterForDay,
  SESSION_NOTE_MAX,
  SESSION_TIME_MAX,
  setMark,
  useBatchMonths,
  useStudentMonths,
} from '../../lib/api/attendance';
import type { Enrolment } from '../../lib/local/types';
import {
  classDateLabel,
  classDayOf,
  dateOf,
  isoDate,
  localToday,
  Mark,
  markOf,
  monthOf,
  percentLabel,
  percentOf,
  prettyTime,
  scheduledTime,
  stepClassDay,
} from '../../lib/utils/attendance';
import { AppText, Avatar, Card, Chip, EmptyState, Pill, Row, SectionHeader } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { Field, FormField } from '../../components/ui/Field';
import { Screen } from '../../components/ui/Screen';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { RealTopBar } from '../../components/real/RealTopBar';
import { SyncBanner } from '../../components/real/SyncBanner';
import { MarkToggle } from '../../components/real/MarkToggle';

type Filter = 'all' | 'A' | 'L';

/** The system date picker exists on Android and iOS; web steps with the arrows. */
const CAN_PICK = Platform.OS === 'android' || Platform.OS === 'ios';
type SheetName = 'cancel' | 'extra' | 'clear' | 'options' | null;

/**
 * One class day of a batch: mark it held or cancelled, then mark who was
 * absent or late (everyone else is present). Saved on the phone at once and
 * uploaded by sync, so it works in a classroom without signal.
 */
export function AttendanceDayScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const params = useRoute<any>().params as { batchId: string; date?: string };
  const toast = useToast();
  const today = localToday();

  const [date, setDate] = useState<string>(params.date ?? today);
  const { data: batch, isLoading } = usePrivateBatch(params.batchId);
  const { data: roster } = useBatchRoster(params.batchId);
  const batchMonths = useBatchMonths(params.batchId);
  const months = useStudentMonths();

  // Taps show at once; the store catches up a moment later.
  const [overrides, setOverrides] = useState<Record<string, Mark>>({});
  const [sheet, setSheet] = useState<SheetName>(null);
  const [picking, setPicking] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const month = monthOf(date);
  const stored = (id: string) => markOf(months[id]?.[month], date);

  useEffect(() => {
    setOverrides({});
    setFilter('all');
  }, [date]);

  // Drop the instant marks the saved copy now agrees with.
  useEffect(() => {
    setOverrides((o) => {
      const keep = Object.fromEntries(Object.entries(o).filter(([id, m]) => markOf(months[id]?.[month], date) !== m));
      return Object.keys(keep).length === Object.keys(o).length ? o : keep;
    });
  }, [months, month, date]);

  const students = useMemo(() => rosterForDay(roster, months, date), [roster, months, date]);

  if (isLoading || !batch) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
        <RealTopBar title="Attendance" />
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

  const course = { start: batch.course_start, end: batch.course_end };
  const day = classDayOf(date, batch.weekly_schedule, batchMonths[month]?.sessions, today, course);
  const future = date > today;
  const canMark = day?.state === 'held' && !future;

  const markFor = (r: Enrolment): Mark => overrides[r.id] ?? stored(r.id);
  const marks = students.map((r) => markFor(r));
  const absent = marks.filter((m) => m === 'A').length;
  const late = marks.filter((m) => m === 'L').length;
  const present = students.length - absent - late;
  // Students with an absent/late mark saved (what clearing the day must undo).
  const markedIds = students.filter((r) => markFor(r) !== 'P').map((r) => r.id);

  const run = async (work: Promise<void>, done?: string) => {
    try {
      await work;
      if (done) toast.toast(done, 'success');
    } catch (err) {
      toast.toast(describeAttendanceError(err), 'error');
    }
  };

  const onMark = (r: Enrolment, m: Mark) => {
    setOverrides((o) => ({ ...o, [r.id]: m }));
    run(setMark(batch.id, r.id, date, m));
  };

  const step = (dir: 1 | -1) => setDate(stepClassDay(date, dir, batch.weekly_schedule, batchMonths, today, course));

  const q = query.trim().toLowerCase();
  const shown = students.filter((r) => {
    if (filter !== 'all' && markFor(r) !== filter) return false;
    return !q || studentName(r).toLowerCase().includes(q);
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <RealTopBar
        title="Attendance"
        right={
          <Pressable
            onPress={() => navigation.navigate('AttendanceRegister', { batchId: batch.id, month })}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open the month register"
            style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.textMain} />
          </Pressable>
        }
      />
      <Screen>
        <SyncBanner />
        <AppText variant="overline" tone="muted" numberOfLines={1}>
          {batch.name.toUpperCase()}
        </AppText>

        {/* ── Date ─────────────────────────────────────────────────────── */}
        <View style={[styles.dateBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <StepButton icon="chevron-back" label="Previous class day" onPress={() => step(-1)} />
          <Pressable
            onPress={() => CAN_PICK && setPicking(true)}
            disabled={!CAN_PICK}
            accessibilityRole="button"
            accessibilityLabel={`${classDateLabel(date, true)}. Choose another date`}
            style={({ pressed }) => ({ flex: 1, alignItems: 'center', opacity: pressed ? 0.6 : 1 })}
          >
            <AppText variant="subheading" numberOfLines={1}>
              {classDateLabel(date, true)}
            </AppText>
            <AppText variant="caption" tone={date === today ? 'primary' : 'muted'}>
              {date === today ? 'Today' : future ? 'Upcoming' : CAN_PICK ? 'Tap to pick a date' : 'Past class'}
            </AppText>
          </Pressable>
          <StepButton icon="chevron-forward" label="Next class day" onPress={() => step(1)} />
        </View>
        {date !== today ? (
          <Pressable onPress={() => setDate(today)} hitSlop={8} style={{ alignSelf: 'center', marginTop: spacing.sm }}>
            <AppText variant="captionStrong" tone="primary">
              Go to today
            </AppText>
          </Pressable>
        ) : null}

        {/* ── The class ────────────────────────────────────────────────── */}
        <Card style={{ marginTop: spacing.lg }}>
          {!day ? (
            <>
              <AppText variant="subheading">No class on this day</AppText>
              <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
                It isn’t on the weekly timetable{course.start && course.end && (month < course.start || month > course.end) ? ' or inside the course months' : ''}.
              </AppText>
              <Button
                label="Add an extra class"
                iconName="add-circle-outline"
                variant="secondary"
                size="sm"
                onPress={() => setSheet('extra')}
                style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
              />
            </>
          ) : day.state === 'unmarked' ? (
            <>
              <Row gap={spacing.sm}>
                <Pill label="Not marked" tone="warning" icon="time-outline" />
                {day.time ? (
                  <AppText variant="caption" tone="muted">
                    {prettyTime(day.time)}
                  </AppText>
                ) : null}
              </Row>
              <AppText variant="caption" tone="secondary" style={{ marginTop: spacing.sm }}>
                Did this class take place? Everyone starts as present — then mark who was absent or late.
              </AppText>
              <Button
                label="Class held — take attendance"
                iconName="checkmark-circle-outline"
                fullWidth
                onPress={() => run(markHeld(batch, date))}
                style={{ marginTop: spacing.md }}
              />
              <Button
                label="Class cancelled"
                iconName="close-circle-outline"
                variant="secondary"
                fullWidth
                onPress={() => setSheet('cancel')}
                style={{ marginTop: spacing.sm }}
              />
            </>
          ) : day.state === 'upcoming' ? (
            <>
              <Row gap={spacing.sm}>
                <Pill label="Upcoming" tone="info" icon="calendar-outline" />
                {day.time ? (
                  <AppText variant="caption" tone="muted">
                    {prettyTime(day.time)}
                  </AppText>
                ) : null}
              </Row>
              <AppText variant="caption" tone="secondary" style={{ marginTop: spacing.sm }}>
                Attendance can be taken on the day. You can cancel it now (a holiday, say) so parents know.
              </AppText>
              <Button
                label="Cancel this class"
                iconName="close-circle-outline"
                variant="secondary"
                size="sm"
                onPress={() => setSheet('cancel')}
                style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
              />
            </>
          ) : day.state === 'cancelled' ? (
            <>
              <Row gap={spacing.sm}>
                <Pill label="Cancelled" tone="error" icon="close-circle-outline" />
                {day.time ? (
                  <AppText variant="caption" tone="muted">
                    {prettyTime(day.time)}
                  </AppText>
                ) : null}
              </Row>
              {day.note ? (
                <AppText variant="bodyStrong" style={{ marginTop: spacing.sm }}>
                  {day.note}
                </AppText>
              ) : null}
              <Row gap={spacing.sm} style={{ marginTop: spacing.md }}>
                {!future ? (
                  <Button label="Class was held" iconName="checkmark" size="sm" onPress={() => run(markHeld(batch, date))} />
                ) : null}
                <Button label="Undo cancel" variant="secondary" size="sm" onPress={() => run(clearDay(batch, date, []))} />
              </Row>
            </>
          ) : (
            /* held */
            <>
              <Row justify="space-between">
                <Row gap={spacing.sm} style={{ flex: 1 }}>
                  <Pill label={day.extra ? 'Extra class' : 'Class held'} tone="success" icon="checkmark-circle-outline" />
                  {day.time ? (
                    <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {prettyTime(day.time)}
                    </AppText>
                  ) : null}
                </Row>
                <Pressable
                  onPress={() => setSheet('options')}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="More options for this day"
                  style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.5 : 1 })}
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
                </Pressable>
              </Row>
              {future ? (
                <AppText variant="caption" tone="secondary" style={{ marginTop: spacing.sm }}>
                  Attendance can be taken on the day.
                </AppText>
              ) : (
                <>
                  <Row style={{ marginTop: spacing.md }} gap={spacing.sm}>
                    <Count value={present} label="Present" color={colors.success} />
                    <Count value={late} label="Late" color={colors.warning} />
                    <Count value={absent} label="Absent" color={colors.error} />
                    <Count value={percentLabel(percentOf(present + late, students.length))} label="Attended" color={colors.textMain} />
                  </Row>
                  <Button
                    label="Mark everyone present"
                    iconName="checkmark-done-outline"
                    variant="secondary"
                    size="sm"
                    disabled={!markedIds.length}
                    onPress={() => {
                      setOverrides({});
                      run(markAllPresent(batch.id, date, markedIds), 'Everyone marked present');
                    }}
                    style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
                  />
                </>
              )}
            </>
          )}
        </Card>

        {/* ── Students ─────────────────────────────────────────────────── */}
        {canMark ? (
          <View style={{ marginTop: spacing.xxl }}>
            <SectionHeader title={`Students · ${students.length}`} subtitle="Tap a name to mark absent · P / L / A to choose" />
            {students.length ? (
              <>
                {students.length > 10 ? (
                  <Field
                    placeholder="Search students"
                    value={query}
                    onChangeText={setQuery}
                    autoCorrect={false}
                    style={{ marginBottom: spacing.md }}
                  />
                ) : null}
                <Row gap={spacing.sm} wrap style={{ marginBottom: spacing.md }}>
                  <Chip label={`All · ${students.length}`} selected={filter === 'all'} onPress={() => setFilter('all')} />
                  <Chip label={`Absent · ${absent}`} selected={filter === 'A'} onPress={() => setFilter('A')} />
                  <Chip label={`Late · ${late}`} selected={filter === 'L'} onPress={() => setFilter('L')} />
                </Row>
                <Card padded={false}>
                  {shown.length ? (
                    shown.map((r, i) => {
                      const m = markFor(r);
                      const c = r.student_card;
                      const initials = `${c.first_name[0] ?? ''}${c.last_name[0] ?? ''}`.toUpperCase() || '?';
                      return (
                        <Row
                          key={r.id}
                          gap={spacing.md}
                          style={{
                            paddingVertical: 10,
                            paddingHorizontal: spacing.md,
                            borderTopWidth: i ? StyleSheet.hairlineWidth : 0,
                            borderTopColor: colors.border,
                            backgroundColor: m === 'A' ? colors.errorBg : 'transparent',
                          }}
                        >
                          <Pressable
                            onPress={() => onMark(r, m === 'A' ? 'P' : 'A')}
                            accessibilityRole="button"
                            accessibilityLabel={`${studentName(r)}, ${m === 'A' ? 'absent' : m === 'L' ? 'late' : 'present'}. Tap to mark ${m === 'A' ? 'present' : 'absent'}`}
                            style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, opacity: pressed ? 0.7 : 1 })}
                          >
                            <Avatar initials={initials} gradient={['#1E5AA8', '#4F8FE0']} size={34} />
                            <View style={{ flex: 1 }}>
                              <AppText variant="bodyStrong" numberOfLines={1}>
                                {studentName(r)}
                              </AppText>
                              <AppText variant="caption" tone="muted" numberOfLines={1}>
                                {r.status !== 'approved' ? 'No longer in the batch' : c.class_name || 'Student'}
                              </AppText>
                            </View>
                          </Pressable>
                          <MarkToggle value={m} name={studentName(r)} onChange={(next) => onMark(r, next)} />
                        </Row>
                      );
                    })
                  ) : (
                    <AppText variant="caption" tone="muted" style={{ padding: spacing.lg }}>
                      {q ? 'No student matches the search.' : filter === 'A' ? 'Nobody is absent.' : 'Nobody is late.'}
                    </AppText>
                  )}
                </Card>
                <AppText variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
                  Saved on this phone as you tap, and sent to parents when online. Late counts as present.
                </AppText>
              </>
            ) : (
              <EmptyState icon="people-outline" title="No students on this day" message="Students count from the day you accept them." />
            )}
          </View>
        ) : null}
      </Screen>

      {/* ── Date picker ─────────────────────────────────────────────────── */}
      {picking && Platform.OS === 'android' ? (
        <DateTimePicker
          value={dateOf(date)}
          mode="date"
          onValueChange={(_, d) => {
            setPicking(false);
            setDate(isoDate(d));
          }}
          onDismiss={() => setPicking(false)}
        />
      ) : null}
      {Platform.OS === 'ios' ? (
        <Sheet visible={picking} onClose={() => setPicking(false)} title="Choose a date" scroll={false}>
          <DateTimePicker
            value={dateOf(date)}
            mode="date"
            display="inline"
            themeVariant={isDark ? 'dark' : 'light'}
            onValueChange={(_, d) => {
              setDate(isoDate(d));
              setPicking(false);
            }}
          />
        </Sheet>
      ) : null}

      {/* ── Sheets ──────────────────────────────────────────────────────── */}
      {sheet === 'cancel' ? (
        <CancelSheet
          date={date}
          marked={markedIds.length}
          onClose={() => setSheet(null)}
          onConfirm={(note) => {
            setSheet(null);
            setOverrides({});
            run(markCancelled(batch, date, note, markedIds), 'Class marked as cancelled');
          }}
        />
      ) : null}
      {sheet === 'extra' ? (
        <ExtraSheet
          date={date}
          usualTime={usualTime(batch.weekly_schedule)}
          onClose={() => setSheet(null)}
          onConfirm={(time) => {
            setSheet(null);
            run(addExtraClass(batch, date, time), 'Extra class added');
          }}
        />
      ) : null}
      <Sheet visible={sheet === 'options'} onClose={() => setSheet(null)} title={classDateLabel(date, true)} scroll={false}>
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          {day && !day.extra ? (
            <Button
              label="Mark as cancelled"
              iconName="close-circle-outline"
              variant="secondary"
              fullWidth
              onPress={() => setSheet('cancel')}
            />
          ) : null}
          <Button
            label={day?.extra ? 'Remove this extra class' : 'Clear this day (not marked)'}
            iconName="refresh-outline"
            variant="secondary"
            fullWidth
            onPress={() => setSheet('clear')}
          />
        </View>
      </Sheet>
      <ConfirmSheet
        visible={sheet === 'clear'}
        title={day?.extra ? 'Remove this extra class?' : 'Clear this day?'}
        message={
          (day?.extra ? 'The extra class is removed' : 'The class goes back to “not marked”') +
          (markedIds.length ? ` and ${markedIds.length} absent/late mark${markedIds.length === 1 ? ' is' : 's are'} removed.` : '.')
        }
        confirmLabel={day?.extra ? 'Remove' : 'Clear'}
        onClose={() => setSheet(null)}
        onConfirm={() => {
          setSheet(null);
          setOverrides({});
          run(clearDay(batch, date, markedIds), day?.extra ? 'Extra class removed' : 'Day cleared');
        }}
      />
    </View>
  );
}

/** The most common class time on the timetable, to prefill an extra class. */
function usualTime(schedule: Parameters<typeof scheduledTime>[0]): string {
  const counts = new Map<string, number>();
  for (const v of Object.values(schedule ?? {})) {
    const t = v?.trim();
    if (!t || t.toLowerCase() === 'closed' || t.length > SESSION_TIME_MAX) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

function StepButton({ icon, label, onPress }: { icon: 'chevron-back' | 'chevron-forward'; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.step, { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={18} color={colors.textMain} />
    </Pressable>
  );
}

function Count({ value, label, color }: { value: number | string; label: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.count, { backgroundColor: colors.surfaceMuted }]}>
      <AppText variant="metricSm" style={{ color }}>
        {value}
      </AppText>
      <AppText variant="overline" tone="muted">
        {label.toUpperCase()}
      </AppText>
    </View>
  );
}

function CancelSheet({
  date,
  marked,
  onClose,
  onConfirm,
}: {
  date: string;
  marked: number;
  onClose: () => void;
  onConfirm: (note: string) => void;
}) {
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0]);
  const [note, setNote] = useState<string>(CANCEL_REASONS[0]);
  return (
    <Sheet visible onClose={onClose} title="Cancel class" subtitle={classDateLabel(date, true)}>
      <AppText variant="overline" tone="muted" style={{ marginBottom: spacing.sm }}>
        REASON
      </AppText>
      <Row gap={spacing.sm} wrap style={{ marginBottom: spacing.lg }}>
        {CANCEL_REASONS.map((r) => (
          <Chip
            key={r}
            label={r}
            selected={reason === r}
            onPress={() => {
              setReason(r);
              setNote(r === 'Other' ? '' : r);
            }}
          />
        ))}
      </Row>
      <FormField
        label={`Note for parents (${note.trim().length}/${SESSION_NOTE_MAX})`}
        placeholder="e.g. Diwali holiday"
        maxLength={SESSION_NOTE_MAX}
        value={note}
        onChangeText={setNote}
      />
      {marked ? (
        <AppText variant="caption" tone="error" style={{ marginTop: spacing.md }}>
          The {marked} absent/late mark{marked === 1 ? '' : 's'} for this day will be cleared.
        </AppText>
      ) : null}
      <Button
        label="Mark as cancelled"
        iconName="close-circle-outline"
        variant="danger"
        fullWidth
        onPress={() => onConfirm(note)}
        style={{ marginTop: spacing.lg }}
      />
    </Sheet>
  );
}

function ExtraSheet({
  date,
  usualTime: initial,
  onClose,
  onConfirm,
}: {
  date: string;
  usualTime: string;
  onClose: () => void;
  onConfirm: (time: string) => void;
}) {
  const [time, setTime] = useState(initial);
  return (
    <Sheet visible onClose={onClose} title="Extra class" subtitle={classDateLabel(date, true)}>
      <AppText variant="caption" tone="secondary" style={{ marginBottom: spacing.md }}>
        A class on a day that isn’t on the weekly timetable. It counts in attendance like any other class.
      </AppText>
      <FormField
        label="Time"
        placeholder="05:00 PM - 06:30 PM"
        maxLength={SESSION_TIME_MAX}
        value={time}
        onChangeText={setTime}
        hint="Optional"
      />
      <Button
        label="Add extra class"
        iconName="add-circle-outline"
        fullWidth
        onPress={() => onConfirm(time)}
        style={{ marginTop: spacing.lg }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.sm,
  },
  step: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  count: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md },
});
