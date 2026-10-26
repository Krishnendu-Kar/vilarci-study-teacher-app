import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, radius, spacing } from '../../theme/tokens';
import { useAppStore } from '../../lib/store/useAppStore';
import { countStatuses } from '../../lib/api/selectors';
import type { AttendanceStatus } from '../../lib/data/types';
import { formatDateLong, formatDateShort, shiftDate } from '../../lib/utils/format';
import { openWhatsApp } from '../../lib/utils/contact';
import { AppText, Card, Chip, EmptyState, Pill, Row } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { Field, FormField } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Segmented';
import { useToast } from '../../components/ui/Toast';
import { CheckInCode } from '../../components/CheckInCode';
import { shortClock } from '../../components/ClassDate';
import type { DeckViewProps } from '../DeckScreen';

const STATUSES: { key: AttendanceStatus; short: string; points: number }[] = [
  { key: 'present', short: 'P', points: 10 },
  { key: 'late', short: 'L', points: 5 },
  { key: 'absent', short: 'A', points: 0 },
];

/** Daily marking with the rotating check-in code, plus the full register. */
export function AttendanceView({ data, focus }: DeckViewProps) {
  const [mode, setMode] = useState<'mark' | 'register'>('mark');
  return (
    <View>
      <Segmented
        options={[
          { value: 'mark', label: 'Daily marking', icon: 'checkbox-outline' },
          { value: 'register', label: 'Register', icon: 'grid-outline' },
        ]}
        value={mode}
        onChange={(v) => setMode(v as 'mark' | 'register')}
      />
      <View style={{ marginTop: spacing.lg }}>{mode === 'mark' ? <Marking data={data} focusDate={focus.date} /> : <Register data={data} />}</View>
    </View>
  );
}

// ─── Daily marking ────────────────────────────────────────────────────────────

function Marking({ data, focusDate }: { data: DeckViewProps['data']; focusDate?: string }) {
  const { colors } = useTheme();
  const saveAttendance = useAppStore((s) => s.saveAttendance);
  const addExtraClass = useAppStore((s) => s.addExtraClass);
  const { toast } = useToast();
  const { deck, roster, sessions, today } = data;

  // Registers belong to real class dates: today's class (if any) and the
  // classes held in the last five weeks — not every calendar day.
  const classDates = useMemo(() => {
    const held = data.calendar(shiftDate(today, -35), today).filter((c) => !c.cancelled);
    return [...new Set(held.map((c) => c.date))].sort((a, b) => b.localeCompare(a)).slice(0, 10);
  }, [data, today]);

  const defaultDate = focusDate ?? (data.todayClass ? today : data.unmarked[data.unmarked.length - 1]?.date ?? classDates[0] ?? today);
  const [date, setDate] = useState(defaultDate);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherDate, setOtherDate] = useState('');
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (focusDate) setDate(focusDate);
  }, [focusDate]);

  const occurrence = data.calendar(date, date).find((c) => !c.cancelled) ?? null;
  const cancelledHere = data.calendar(date, date).find((c) => c.cancelled) ?? null;
  const isClassDay = Boolean(occurrence);
  const chips = classDates.includes(date) ? classDates : [date, ...classDates];

  const existing = sessions.find((s) => s.date === date);
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [topic, setTopic] = useState('');

  // Load the saved register for the chosen date, defaulting everyone to present.
  useEffect(() => {
    const base: Record<string, AttendanceStatus> = {};
    for (const s of roster) base[s.id] = existing?.records[s.id] ?? 'present';
    setRecords(base);
    setTopic(existing?.topic_covered ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, existing?.id, roster.length]);

  const counts = countStatuses(records, roster.map((s) => s.id));
  const dirty = !existing || roster.some((s) => (existing.records[s.id] ?? 'present') !== records[s.id]) || topic !== existing.topic_covered;

  if (!roster.length) {
    return <EmptyState icon="clipboard-outline" title="No students enrolled" message="Add students to start taking attendance." />;
  }

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {chips.map((d) => {
          const saved = sessions.some((s) => s.date === d);
          const owed = !saved && d < today && classDates.includes(d);
          return (
            <Chip
              key={d}
              label={d === today ? 'Today' : formatDateShort(d)}
              icon={saved ? 'checkmark-circle' : owed ? 'alert-circle' : undefined}
              iconColor={saved ? colors.success : owed ? colors.warning : undefined}
              selected={d === date}
              onPress={() => {
                setOtherOpen(false);
                setDate(d);
              }}
            />
          );
        })}
        <Chip label="Other date" icon="calendar-outline" selected={otherOpen} onPress={() => setOtherOpen((v) => !v)} />
      </ScrollView>

      {otherOpen ? (
        <Row gap={spacing.sm} align="flex-end" style={{ marginTop: spacing.md }}>
          <FormField
            label="Class date"
            placeholder="YYYY-MM-DD"
            value={otherDate}
            onChangeText={setOtherDate}
            containerStyle={{ flex: 1 }}
          />
          <Button
            label="Open"
            disabled={!/^\d{4}-\d{2}-\d{2}$/.test(otherDate) || otherDate > today}
            onPress={() => {
              setDate(otherDate);
              setOtherOpen(false);
            }}
          />
        </Row>
      ) : null}

      {!isClassDay ? (
        <Card muted style={{ marginTop: spacing.md }}>
          <Row gap={spacing.sm} align="flex-start">
            <Ionicons name="information-circle-outline" size={17} color={colors.info} />
            <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
              {cancelledHere
                ? `This class was cancelled (${cancelledHere.cancelled?.note}). Saving a register will reinstate it as an extra class.`
                : 'No class is scheduled on this day. Saving the register records it as an extra class.'}
            </AppText>
          </Row>
        </Card>
      ) : null}

      <Card style={{ marginTop: spacing.lg }}>
        <Row justify="space-between" align="flex-start">
          <View style={{ flex: 1 }}>
            <AppText variant="overline" tone="muted">
              {existing ? 'SAVED REGISTER' : date < today ? 'NOT MARKED YET' : 'NEW REGISTER'}
              {occurrence ? ` · ${shortClock(occurrence.start)}${occurrence.kind === 'extra' ? ' · EXTRA CLASS' : ''}` : ''}
            </AppText>
            <AppText variant="heading">{formatDateLong(date)}</AppText>
          </View>
          <Pressable onPress={() => setShowCode((v) => !v)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Toggle check-in code">
            <Ionicons name={showCode ? 'qr-code' : 'qr-code-outline'} size={24} color={colors.primary} />
          </Pressable>
        </Row>

        {showCode ? (
          <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
            <View style={[styles.codeFrame, { borderColor: colors.border }]}>
              <CheckInCode seed={`${deck.ref.id}:${date}`} size={176} />
            </View>
            <AppText variant="captionStrong" style={{ marginTop: spacing.sm }}>
              Live classroom check-in
            </AppText>
            <AppText variant="caption" tone="muted" center style={{ maxWidth: 270 }}>
              Project this for students to scan from the Vilarci Study app (+10 pts on time). It rotates daily.
            </AppText>
          </View>
        ) : null}

        <Field
          placeholder="Topic covered in class"
          value={topic}
          onChangeText={setTopic}
          style={{ marginTop: spacing.lg }}
        />

        <Row gap={spacing.sm} style={{ marginTop: spacing.md }} wrap>
          <Pill label={`${counts.present} present`} tone="success" />
          <Pill label={`${counts.late} late`} tone="warning" />
          <Pill label={`${counts.absent} absent`} tone="error" />
        </Row>
      </Card>

      <Row justify="space-between" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
        <AppText variant="subheading">{roster.length} students</AppText>
        <Button
          label="All present"
          iconName="checkmark-done-outline"
          size="sm"
          variant="ghost"
          onPress={() => setRecords(Object.fromEntries(roster.map((s) => [s.id, 'present'])))}
        />
      </Row>

      <Card padded={false}>
        {roster.map((s, idx) => {
          const status = records[s.id] ?? 'present';
          return (
            <View
              key={s.id}
              style={[
                styles.markRow,
                idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
              ]}
            >
              <View style={{ flex: 1 }}>
                <AppText variant="subheading" numberOfLines={1}>
                  {s.name}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {s.roll} · +{STATUSES.find((x) => x.key === status)?.points} pts
                </AppText>
              </View>
              <Row gap={6}>
                {STATUSES.map((opt) => (
                  <StatusButton
                    key={opt.key}
                    label={opt.short}
                    status={opt.key}
                    active={status === opt.key}
                    onPress={() => setRecords((r) => ({ ...r, [s.id]: opt.key }))}
                  />
                ))}
                <Pressable
                  onPress={() =>
                    openWhatsApp(
                      s.father_phone,
                      `Dear Parent, ${s.name} was marked ${status.toUpperCase()} on ${formatDateLong(date)} in ${deck.title}.`,
                    )
                  }
                  hitSlop={6}
                  accessibilityLabel={`Message ${s.name}'s parent`}
                  style={{ paddingLeft: 4, justifyContent: 'center' }}
                >
                  <Ionicons name="logo-whatsapp" size={20} color={colors.success} />
                </Pressable>
              </Row>
            </View>
          );
        })}
      </Card>

      <Button
        label={existing ? (dirty ? 'Update attendance' : 'Saved') : 'Save attendance'}
        iconName={dirty ? 'save-outline' : 'checkmark-circle'}
        variant={dirty ? 'primary' : 'secondary'}
        fullWidth
        disabled={!dirty}
        style={{ marginTop: spacing.lg }}
        onPress={() => {
          if (!isClassDay) {
            const usual = Object.values(deck.slots).find(Boolean);
            addExtraClass(deck.ref.id, {
              date,
              start_time: usual?.start ?? null,
              end_time: usual?.end ?? null,
              note: 'Extra class (register taken)',
            });
          }
          saveAttendance(deck.ref.id, date, topic.trim() || 'Classroom lecture', records);
          toast(`Attendance saved for ${formatDateShort(date)} · ${counts.present + counts.late}/${roster.length} attended`, 'success');
        }}
      />
    </View>
  );
}

function StatusButton({
  label,
  status,
  active,
  onPress,
}: {
  label: string;
  status: AttendanceStatus;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const tone = {
    present: { bg: colors.success, soft: colors.successBg, fg: colors.successText },
    late: { bg: colors.warning, soft: colors.warningBg, fg: colors.warningText },
    absent: { bg: colors.error, soft: colors.errorBg, fg: colors.errorText },
  }[status];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={status}
      style={({ pressed }) => [
        styles.statusBtn,
        {
          backgroundColor: active ? tone.bg : colors.surfaceMuted,
          borderColor: active ? tone.bg : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <AppText style={{ fontFamily: fonts.sansBold, fontSize: 13, color: active ? '#fff' : colors.textSecondary }}>
        {label}
      </AppText>
    </Pressable>
  );
}

// ─── Date-by-date register matrix ─────────────────────────────────────────────

function Register({ data }: { data: DeckViewProps['data'] }) {
  const { colors } = useTheme();
  const { roster, sessions, rateOf } = data;
  if (!sessions.length) {
    return <EmptyState icon="calendar-outline" title="No sessions recorded" message="Saved daily sessions build up into this register." />;
  }
  const cell = (st: AttendanceStatus | undefined) =>
    st === 'late'
      ? { bg: colors.warningBg, fg: colors.warningText, t: 'L' }
      : st === 'absent'
        ? { bg: colors.errorBg, fg: colors.errorText, t: 'A' }
        : st === 'present'
          ? { bg: colors.successBg, fg: colors.successText, t: 'P' }
          : { bg: colors.surfaceMuted, fg: colors.textMuted, t: '·' };

  const NAME_W = 132;
  const RATE_W = 52;
  const CELL_W = 54;

  return (
    <Card padded={false}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <Row gap={0} style={[styles.matrixHead, { borderBottomColor: colors.border }]}>
            <AppText variant="overline" tone="muted" style={{ width: NAME_W, paddingLeft: spacing.md }}>
              STUDENT
            </AppText>
            <AppText variant="overline" tone="muted" style={{ width: RATE_W, textAlign: 'center' }}>
              RATE
            </AppText>
            {sessions.map((s) => (
              <AppText key={s.id} variant="overline" tone="muted" style={{ width: CELL_W, textAlign: 'center' }}>
                {formatDateShort(s.date).toUpperCase()}
              </AppText>
            ))}
          </Row>
          {roster.map((st, idx) => (
            <Row
              key={st.id}
              gap={0}
              style={[
                { paddingVertical: 8 },
                idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
              ]}
            >
              <AppText variant="captionStrong" numberOfLines={1} style={{ width: NAME_W, paddingLeft: spacing.md }}>
                {st.name}
              </AppText>
              <AppText variant="captionStrong" tone="primary" style={{ width: RATE_W, textAlign: 'center' }}>
                {rateOf(st.id).toFixed(0)}%
              </AppText>
              {sessions.map((s) => {
                const c = cell(s.records[st.id]);
                return (
                  <View key={s.id} style={{ width: CELL_W, alignItems: 'center' }}>
                    <View style={[styles.matrixCell, { backgroundColor: c.bg }]}>
                      <AppText style={{ fontFamily: fonts.sansBold, fontSize: 11, color: c.fg }}>{c.t}</AppText>
                    </View>
                  </View>
                );
              })}
            </Row>
          ))}
        </View>
      </ScrollView>
      <AppText variant="caption" tone="muted" style={{ padding: spacing.md }}>
        Late counts as half an attendance. Scroll sideways for older sessions.
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  codeFrame: { padding: 10, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, backgroundColor: '#fff' },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  statusBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  matrixHead: { paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  matrixCell: { width: 26, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
});
