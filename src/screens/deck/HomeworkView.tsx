import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, radius, spacing } from '../../theme/tokens';
import { useAppStore } from '../../lib/store/useAppStore';
import { homeworkCounts } from '../../lib/api/selectors';
import type { Homework, HomeworkStatus } from '../../lib/data/types';
import { shiftDate } from '../../lib/utils/format';
import { openWhatsApp } from '../../lib/utils/contact';
import { AppText, Avatar, Card, Chip, Divider, EmptyState, IconName, Pill, Row, SectionHeader } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { FormField } from '../../components/ui/Field';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { classDayLabel, DateBadge, weekdayDate } from '../../components/ClassDate';
import type { DeckViewProps } from '../DeckScreen';

export const HW_STATUS: Record<HomeworkStatus, { label: string; short: string; icon: IconName }> = {
  full: { label: 'Done', short: 'Full', icon: 'checkmark-done' },
  partial: { label: 'Partly done', short: 'Partial', icon: 'contrast-outline' },
  none: { label: 'Not done', short: 'None', icon: 'close' },
};

export function useHomeworkTone() {
  const { colors } = useTheme();
  return {
    full: { bg: colors.success, soft: colors.successBg, fg: colors.successText },
    partial: { bg: colors.warning, soft: colors.warningBg, fg: colors.warningText },
    none: { bg: colors.error, soft: colors.errorBg, fg: colors.errorText },
  } as Record<HomeworkStatus, { bg: string; soft: string; fg: string }>;
}

/**
 * Homework is set in one class and checked at the next. Each student's work
 * is recorded as done fully, partly, or not at all — the same way attendance
 * is recorded — and builds into a homework record per student.
 */
export function HomeworkView({ data, focus }: DeckViewProps) {
  const { colors } = useTheme();
  const { deck, homework, today, roster } = data;
  const [giving, setGiving] = useState(false);
  const [checking, setChecking] = useState<Homework | null>(null);
  const [deleting, setDeleting] = useState<Homework | null>(null);
  const deleteHomework = useAppStore((s) => s.deleteHomework);
  const { toast } = useToast();
  const tone = useHomeworkTone();

  // Arriving from a "check homework" reminder opens the checker directly.
  useEffect(() => {
    if (focus.homeworkId) setChecking(homework.find((h) => h.id === focus.homeworkId) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus.homeworkId]);

  const toCheck = data.homeworkToCheck;
  const upcoming = homework.filter((h) => !h.checked_date && h.due_date > today).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const checked = homework.filter((h) => h.checked_date).sort((a, b) => b.due_date.localeCompare(a.due_date));
  const ids = roster.map((s) => s.id);

  return (
    <View>
      {toCheck.map((h) => (
        <Card key={h.id} rail={colors.warning} style={{ marginBottom: spacing.md }}>
          <Row gap={spacing.sm}>
            <Ionicons name="alert-circle" size={17} color={colors.warning} />
            <AppText variant="overline" style={{ color: colors.warningText, flex: 1 }}>
              DUE {classDayLabel(h.due_date, today).toUpperCase()} · NOT CHECKED
            </AppText>
          </Row>
          <AppText variant="subheading" style={{ marginTop: 4 }}>
            {h.title}
          </AppText>
          {h.details ? (
            <AppText variant="caption" tone="muted">
              {h.details}
            </AppText>
          ) : null}
          <Button
            label="Check homework"
            iconName="checkmark-done-outline"
            fullWidth
            style={{ marginTop: spacing.md }}
            onPress={() => setChecking(h)}
          />
        </Card>
      ))}

      <Button label="Give homework" iconName="add-circle-outline" fullWidth variant={toCheck.length ? 'secondary' : 'primary'} onPress={() => setGiving(true)} />

      {/* ── Set, waiting for the next class ─────────────────────────────── */}
      {upcoming.length ? (
        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Set, to check next class" />
          <Card padded={false}>
            {upcoming.map((h, idx) => (
              <View key={h.id}>
                {idx > 0 ? <Divider inset={spacing.lg} /> : null}
                <Row gap={spacing.md} align="flex-start" style={{ padding: spacing.lg }}>
                  <DateBadge iso={h.due_date} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="subheading">{h.title}</AppText>
                    <AppText variant="caption" tone="muted">
                      Given {weekdayDate(h.assigned_date)} · check {classDayLabel(h.due_date, today)}
                    </AppText>
                    {h.details ? (
                      <AppText variant="caption" tone="secondary" style={{ marginTop: 2 }}>
                        {h.details}
                      </AppText>
                    ) : null}
                  </View>
                  <Pressable onPress={() => setDeleting(h)} hitSlop={8} accessibilityLabel="Delete homework">
                    <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                  </Pressable>
                </Row>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {/* ── Checked ─────────────────────────────────────────────────────── */}
      <View style={{ marginTop: spacing.xxl }}>
        <SectionHeader title="Checked" subtitle="Tap to correct a record" />
        {checked.length ? (
          <View style={{ gap: spacing.sm }}>
            {checked.map((h) => {
              const c = homeworkCounts(h, ids);
              const total = c.full + c.partial + c.none || 1;
              return (
                <Pressable key={h.id} onPress={() => setChecking(h)}>
                  <Card>
                    <Row gap={spacing.md} align="flex-start">
                      <DateBadge iso={h.due_date} />
                      <View style={{ flex: 1 }}>
                        <AppText variant="subheading">{h.title}</AppText>
                        <AppText variant="caption" tone="muted">
                          Given {weekdayDate(h.assigned_date)} · checked {weekdayDate(h.checked_date!)}
                        </AppText>
                        <View style={[styles.bar, { backgroundColor: colors.surfaceAlt }]}>
                          {(['full', 'partial', 'none'] as HomeworkStatus[]).map((st) =>
                            c[st] ? <View key={st} style={{ flex: c[st] / total, backgroundColor: tone[st].bg }} /> : null,
                          )}
                        </View>
                        <Row gap={5} wrap style={{ marginTop: 6 }}>
                          <Pill label={`${c.full} done`} tone="success" icon="checkmark-done" />
                          {c.partial ? <Pill label={`${c.partial} partly`} tone="warning" icon="contrast-outline" /> : null}
                          {c.none ? <Pill label={`${c.none} not done`} tone="error" icon="close" /> : null}
                        </Row>
                      </View>
                    </Row>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState icon="book-outline" title="No homework checked yet" message="Give homework in class and check it at the next one." />
        )}
      </View>

      {/* ── Per-student record ──────────────────────────────────────────── */}
      {checked.length && roster.length ? (
        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Homework record" subtitle="Done counts fully, partly done counts half" />
          <Card padded={false}>
            {[...roster]
              .map((s) => ({ s, r: data.homeworkOf(s.id) }))
              .sort((a, b) => (a.r.rate ?? 101) - (b.r.rate ?? 101))
              .map(({ s, r }, idx) => (
                <View key={s.id}>
                  {idx > 0 ? <Divider inset={spacing.lg} /> : null}
                  <Row gap={spacing.md} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
                    <Avatar initials={s.photo_initials} gradient={s.avatar_gradient} size={32} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="subheading" numberOfLines={1}>
                        {s.name}
                      </AppText>
                      <Row gap={3} style={{ marginTop: 3 }}>
                        {r.recent.map(({ homework: h, status }) => (
                          <View
                            key={h.id}
                            accessibilityLabel={`${h.title}: ${HW_STATUS[status].label}`}
                            style={[styles.dot, { backgroundColor: tone[status].bg }]}
                          />
                        ))}
                      </Row>
                    </View>
                    <AppText
                      variant="subheading"
                      style={{
                        color: r.rate == null ? colors.textMuted : r.rate >= 85 ? colors.successText : r.rate >= 60 ? colors.warningText : colors.errorText,
                      }}
                    >
                      {r.rate == null ? '—' : `${r.rate.toFixed(0)}%`}
                    </AppText>
                  </Row>
                </View>
              ))}
          </Card>
        </View>
      ) : null}

      <GiveHomeworkSheet data={data} visible={giving} onClose={() => setGiving(false)} />
      <CheckHomeworkSheet data={data} homework={checking} onClose={() => setChecking(null)} />
      <ConfirmSheet
        visible={Boolean(deleting)}
        title="Delete this homework?"
        message={deleting?.title ?? ''}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleting) deleteHomework(deleting.id);
          toast('Homework deleted', 'info');
        }}
        onClose={() => setDeleting(null)}
      />
    </View>
  );
}

// ─── Give homework ────────────────────────────────────────────────────────────

function GiveHomeworkSheet({ data, visible, onClose }: { data: DeckViewProps['data']; visible: boolean; onClose: () => void }) {
  const assignHomework = useAppStore((s) => s.assignHomework);
  const { toast } = useToast();
  const { deck, today } = data;

  // Homework is usually given in today's class, or the most recent one.
  const givenOptions = useMemo(() => {
    const recent = data
      .calendar(shiftDate(today, -14), today)
      .filter((c) => !c.cancelled)
      .map((c) => c.date);
    return [...new Set([today, ...recent.reverse()])].slice(0, 4);
  }, [data, today]);

  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [given, setGiven] = useState(givenOptions[0]);
  const [due, setDue] = useState<string | null>(null);
  const [otherDue, setOtherDue] = useState('');

  const dueOptions = useMemo(() => {
    const out: string[] = [];
    let cursor = given;
    for (let i = 0; i < 3; i++) {
      const next = data.nextClassAfter(cursor);
      if (!next) break;
      out.push(next.date);
      cursor = next.date;
    }
    return out;
  }, [data, given]);

  const dueDate = otherDue || due || dueOptions[0] || shiftDate(given, 7);
  const valid = title.trim().length > 2 && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && dueDate > given;

  return (
    <Sheet visible={visible} onClose={onClose} title="Give homework" subtitle={deck.name}>
      <View style={{ gap: spacing.lg }}>
        <FormField label="Homework" placeholder="e.g. Ex 6.2 Q1–10" value={title} onChangeText={setTitle} />
        <FormField label="Instructions (optional)" placeholder="e.g. Show all steps" value={details} onChangeText={setDetails} multiline />
        <View style={{ gap: 6 }}>
          <AppText variant="overline" tone="muted">
            GIVEN IN CLASS ON
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {givenOptions.map((d) => (
              <Chip
                key={d}
                label={d === today ? 'Today' : weekdayDate(d)}
                selected={d === given}
                onPress={() => {
                  setGiven(d);
                  setDue(null);
                }}
              />
            ))}
          </ScrollView>
        </View>
        <View style={{ gap: 6 }}>
          <AppText variant="overline" tone="muted">
            CHECK ON
          </AppText>
          {dueOptions.length ? (
            <Row gap={spacing.sm} wrap>
              {dueOptions.map((d, i) => (
                <Chip
                  key={d}
                  icon={i === 0 ? 'calendar' : undefined}
                  label={`${i === 0 ? 'Next class · ' : ''}${weekdayDate(d)}`}
                  selected={!otherDue && dueDate === d}
                  onPress={() => {
                    setOtherDue('');
                    setDue(d);
                  }}
                />
              ))}
            </Row>
          ) : (
            <AppText variant="caption" tone="muted">
              No upcoming class found — enter a date below.
            </AppText>
          )}
          <FormField label="Or another date" placeholder="YYYY-MM-DD" value={otherDue} onChangeText={setOtherDue} />
        </View>
        <Button
          label="Give homework"
          iconName="checkmark"
          fullWidth
          disabled={!valid}
          onPress={() => {
            assignHomework(deck.ref.id, {
              title: title.trim(),
              details: details.trim(),
              assigned_date: given,
              due_date: dueDate,
            });
            toast(`Homework set · check on ${weekdayDate(dueDate)}`, 'success', 'book');
            setTitle('');
            setDetails('');
            setOtherDue('');
            setDue(null);
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

// ─── Check homework ───────────────────────────────────────────────────────────

function CheckHomeworkSheet({
  data,
  homework,
  onClose,
}: {
  data: DeckViewProps['data'];
  homework: Homework | null;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const checkHomework = useAppStore((s) => s.checkHomework);
  const { toast } = useToast();
  const tone = useHomeworkTone();
  const { roster, sessions, deck, today } = data;
  const [records, setRecords] = useState<Record<string, HomeworkStatus>>({});

  useEffect(() => {
    if (homework) setRecords({ ...homework.records });
  }, [homework]);

  if (!homework) return null;
  // Students absent in the checking class could not show their work.
  const register = sessions.find((s) => s.date === homework.due_date);
  const counts = { full: 0, partial: 0, none: 0 } as Record<HomeworkStatus, number>;
  for (const s of roster) if (records[s.id]) counts[records[s.id]] += 1;
  const unset = roster.filter((s) => !records[s.id]).length;

  return (
    <Sheet visible onClose={onClose} title={homework.title} subtitle={`Given ${weekdayDate(homework.assigned_date)} · check ${weekdayDate(homework.due_date)}`}>
      <Row gap={5} wrap>
        <Pill label={`${counts.full} done`} tone="success" icon="checkmark-done" />
        <Pill label={`${counts.partial} partly`} tone="warning" icon="contrast-outline" />
        <Pill label={`${counts.none} not done`} tone="error" icon="close" />
        {unset ? <Pill label={`${unset} not checked`} icon="ellipse-outline" /> : null}
      </Row>
      <Button
        label="Everyone did it fully"
        iconName="checkmark-done-outline"
        size="sm"
        variant="ghost"
        style={{ marginTop: spacing.sm }}
        onPress={() =>
          setRecords(
            Object.fromEntries(
              roster.filter((s) => register?.records[s.id] !== 'absent').map((s) => [s.id, 'full' as HomeworkStatus]),
            ),
          )
        }
      />

      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        {roster.map((s) => {
          const st = records[s.id];
          const absent = register?.records[s.id] === 'absent';
          return (
            <View key={s.id} style={[styles.checkRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Row gap={spacing.sm}>
                <View style={{ flex: 1 }}>
                  <AppText variant="subheading" numberOfLines={1}>
                    {s.name}
                  </AppText>
                  <AppText variant="caption" tone={absent ? 'error' : 'muted'}>
                    {absent ? 'Absent in this class' : st ? HW_STATUS[st].label : 'Not checked yet'}
                  </AppText>
                </View>
                {st && st !== 'full' ? (
                  <Pressable
                    hitSlop={6}
                    accessibilityLabel={`Message ${s.name}'s parent`}
                    onPress={() =>
                      openWhatsApp(
                        s.father_phone,
                        `Dear Parent, ${s.name} ${st === 'none' ? 'did not do' : 'only partly completed'} the homework "${homework.title}" (given ${weekdayDate(
                          homework.assigned_date,
                        )}) for ${deck.title}. Please help them complete it before the next class.`,
                      )
                    }
                  >
                    <Ionicons name="logo-whatsapp" size={20} color={colors.success} />
                  </Pressable>
                ) : null}
              </Row>
              <Row gap={6} style={{ marginTop: spacing.sm }}>
                {(['full', 'partial', 'none'] as HomeworkStatus[]).map((opt) => {
                  const active = st === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => setRecords((r) => ({ ...r, [s.id]: opt }))}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={HW_STATUS[opt].label}
                      style={({ pressed }) => [
                        styles.option,
                        {
                          backgroundColor: active ? tone[opt].bg : tone[opt].soft,
                          borderColor: active ? tone[opt].bg : 'transparent',
                          opacity: pressed ? 0.75 : 1,
                        },
                      ]}
                    >
                      <Ionicons name={HW_STATUS[opt].icon} size={15} color={active ? '#fff' : tone[opt].fg} />
                      <AppText style={{ fontFamily: fonts.sansSemibold, fontSize: 12.5, color: active ? '#fff' : tone[opt].fg }}>
                        {HW_STATUS[opt].short}
                      </AppText>
                    </Pressable>
                  );
                })}
              </Row>
            </View>
          );
        })}
      </View>

      <Button
        label={homework.checked_date ? 'Update homework record' : 'Save homework check'}
        iconName="save-outline"
        fullWidth
        disabled={!Object.keys(records).length}
        style={{ marginTop: spacing.lg }}
        onPress={() => {
          checkHomework(homework.id, records, homework.checked_date ?? (homework.due_date <= today ? today : homework.due_date));
          toast(`Homework recorded · ${counts.full} done, ${counts.partial} partly, ${counts.none} not done`, 'success', 'book');
          onClose();
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', height: 6, borderRadius: radius.pill, overflow: 'hidden', marginTop: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 3 },
  checkRow: { padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
