import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import { useAppStore } from '../../lib/store/useAppStore';
import type { ClassOccurrence } from '../../lib/api/selectors';
import { countStatuses } from '../../lib/api/selectors';
import { shiftDate } from '../../lib/utils/format';
import { activeDayCount, DAY_KEYS, DAY_LABELS, isClockLabel } from '../../lib/utils/schedule';
import { shareOnWhatsApp } from '../../lib/utils/contact';
import { AppText, Card, Chip, Divider, EmptyState, Pill, Row, SectionHeader } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { ChoiceChips } from '../../components/ui/ChoiceChips';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { FormField } from '../../components/ui/Field';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { classDayLabel, DateBadge, shortClock, weekdayDate } from '../../components/ClassDate';
import type { DeckViewProps } from '../DeckScreen';

const CANCEL_REASONS = ['Festival / holiday', 'Teacher unavailable', 'School exams', 'Weather / local issue'];
const EXTRA_NOTES = ['Extra doubt-clearing class', 'Make-up class', 'Test revision class'];

/**
 * The batch's real calendar. Private batches meet once or twice a week, so
 * this is where the teacher adds an extra class before a test, calls off a
 * class for a festival, and sees which held classes still need a register.
 */
export function ClassesView({ data, goTo }: DeckViewProps) {
  const { colors } = useTheme();
  const removeClassException = useAppStore((s) => s.removeClassException);
  const { toast } = useToast();
  const { deck, today, sessions, homework, roster } = data;
  const [addingExtra, setAddingExtra] = useState(false);
  const [cancelling, setCancelling] = useState<ClassOccurrence | null>(null);
  const [removing, setRemoving] = useState<ClassOccurrence | null>(null);

  const upcoming = data.calendar(today, shiftDate(today, 27));
  const past = data
    .calendar(shiftDate(today, -21), shiftDate(today, -1))
    .filter((c) => !c.cancelled)
    .reverse();
  const weeklyDays = DAY_KEYS.filter((d) => deck.slots[d]);
  const perWeek = deck.weeklySchedule ? activeDayCount(deck.weeklySchedule) : weeklyDays.length;

  const groups = useMemo(() => groupByWeek(upcoming, today), [upcoming, today]);

  const tellParents = (c: ClassOccurrence, kind: 'cancelled' | 'extra' | 'reminder', reason?: string) => {
    const when = `${weekdayDate(c.date)}${c.start ? `, ${shortClock(c.start)}${c.end ? `–${shortClock(c.end)}` : ''}` : ''}`;
    const text =
      kind === 'cancelled'
        ? `Dear parents, the ${deck.name} class on ${weekdayDate(c.date)} is cancelled${reason ? ` (${reason})` : ''}. ${
            data.nextClassAfter(c.date) ? `Next class: ${weekdayDate(data.nextClassAfter(c.date)!.date)}.` : ''
          }`
        : kind === 'extra'
          ? `Dear parents, an extra ${deck.name} class is scheduled on ${when}${c.note ? ` — ${c.note}` : ''}. Please ensure your ward attends.`
          : `Reminder: ${deck.name} class on ${when} at ${deck.room}.`;
    shareOnWhatsApp(text.trim());
  };

  return (
    <View>
      {/* ── Weekly pattern ──────────────────────────────────────────────── */}
      <Card>
        <Row justify="space-between" align="flex-start">
          <View style={{ flex: 1 }}>
            <AppText variant="overline" tone="muted">
              REGULAR TIMETABLE
            </AppText>
            <AppText variant="heading" style={{ marginTop: 2 }}>
              {perWeek ? `${perWeek} class${perWeek === 1 ? '' : 'es'} a week` : 'No regular days set'}
            </AppText>
          </View>
          {deck.canEditSettings ? (
            <Button label="Change" iconName="create-outline" size="sm" variant="secondary" onPress={() => goTo('settings')} />
          ) : null}
        </Row>
        <Row gap={6} wrap style={{ marginTop: spacing.md }}>
          {DAY_KEYS.map((d) => {
            const slot = deck.slots[d];
            return (
              <View
                key={d}
                style={[
                  styles.day,
                  {
                    backgroundColor: slot ? colors.primarySubtle : colors.surfaceMuted,
                    borderColor: slot ? colors.primary : colors.border,
                  },
                ]}
              >
                <AppText variant="captionStrong" style={{ color: slot ? colors.primary : colors.textMuted }}>
                  {DAY_LABELS[d]}
                </AppText>
              </View>
            );
          })}
        </Row>
        {weeklyDays.map((d) => (
          <Row key={d} gap={spacing.sm} style={{ marginTop: spacing.sm }}>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} />
            <AppText variant="caption" tone="secondary">
              {DAY_LABELS[d]} · {shortClock(deck.slots[d]!.start)}
              {deck.slots[d]!.end ? ` – ${shortClock(deck.slots[d]!.end)}` : ''}
            </AppText>
          </Row>
        ))}
      </Card>

      {/* ── Registers still owed ────────────────────────────────────────── */}
      {data.unmarked.length ? (
        <Card style={{ marginTop: spacing.md }} rail={colors.warning}>
          <Row gap={spacing.sm}>
            <Ionicons name="alert-circle" size={18} color={colors.warning} />
            <AppText variant="subheading" style={{ flex: 1 }}>
              Attendance not marked
            </AppText>
          </Row>
          {data.unmarked.map((c) => (
            <Row key={c.date + c.start} justify="space-between" style={{ marginTop: spacing.sm }}>
              <AppText variant="caption" tone="secondary">
                {weekdayDate(c.date)} · {shortClock(c.start)}
                {c.kind === 'extra' ? ' · extra' : ''}
              </AppText>
              <Button label="Mark now" size="sm" variant="secondary" onPress={() => goTo('attendance', { date: c.date })} />
            </Row>
          ))}
        </Card>
      ) : null}

      <Button
        label="Add extra class"
        iconName="add-circle-outline"
        fullWidth
        style={{ marginTop: spacing.lg }}
        onPress={() => setAddingExtra(true)}
      />

      {/* ── Next four weeks ─────────────────────────────────────────────── */}
      <View style={{ marginTop: spacing.xxl }}>
        <SectionHeader title="Coming up" subtitle="Next four weeks, including extra and cancelled classes" />
        {groups.length ? (
          groups.map((g) => (
            <View key={g.label} style={{ marginBottom: spacing.lg }}>
              <AppText variant="overline" tone="muted" style={{ marginBottom: spacing.sm }}>
                {g.label.toUpperCase()}
              </AppText>
              <Card padded={false}>
                {g.items.map((c, idx) => (
                  <View key={c.date + c.start + c.kind}>
                    {idx > 0 ? <Divider inset={spacing.lg} /> : null}
                    <ClassRow
                      c={c}
                      today={today}
                      onCancel={() => setCancelling(c)}
                      onRestore={() => {
                        if (c.cancelled) removeClassException(c.cancelled.id);
                        toast(`Class on ${weekdayDate(c.date)} restored`, 'success');
                      }}
                      onRemoveExtra={() => setRemoving(c)}
                      onTell={() => tellParents(c, c.cancelled ? 'cancelled' : c.kind === 'extra' ? 'extra' : 'reminder', c.cancelled?.note)}
                    />
                  </View>
                ))}
              </Card>
            </View>
          ))
        ) : (
          <EmptyState
            icon="calendar-outline"
            title="Nothing scheduled"
            message="Set the regular class days in Settings, or add an extra class."
          />
        )}
      </View>

      {/* ── Recent classes ──────────────────────────────────────────────── */}
      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Last three weeks" subtitle="Classes held, with their register and homework" />
        {past.length ? (
          <Card padded={false}>
            {past.map((c, idx) => {
              const session = sessions.find((s) => s.date === c.date);
              const counts = session ? countStatuses(session.records, roster.map((s) => s.id)) : null;
              const given = homework.filter((h) => h.assigned_date === c.date);
              return (
                <View key={c.date + c.start}>
                  {idx > 0 ? <Divider inset={spacing.lg} /> : null}
                  <Pressable
                    onPress={() => goTo('attendance', { date: c.date })}
                    style={({ pressed }) => [{ padding: spacing.lg, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Row gap={spacing.md} align="flex-start">
                      <DateBadge iso={c.date} tone={c.kind === 'extra' ? 'extra' : 'default'} />
                      <View style={{ flex: 1 }}>
                        <AppText variant="subheading" numberOfLines={1}>
                          {session?.topic_covered ?? (c.kind === 'extra' ? c.note || 'Extra class' : 'Class')}
                        </AppText>
                        <AppText variant="caption" tone="muted">
                          {shortClock(c.start)}
                          {c.end ? ` – ${shortClock(c.end)}` : ''}
                          {c.kind === 'extra' ? ' · extra class' : ''}
                        </AppText>
                        <Row gap={5} wrap style={{ marginTop: 6 }}>
                          {counts ? (
                            <Pill
                              label={`${counts.present + counts.late}/${roster.length} attended`}
                              tone={counts.absent ? 'warning' : 'success'}
                              icon="people-outline"
                            />
                          ) : (
                            <Pill label="Attendance not marked" tone="error" icon="alert-circle-outline" />
                          )}
                          {given.map((h) => (
                            <Pill key={h.id} label={`HW: ${truncate(h.title, 22)}`} tone="info" icon="book-outline" />
                          ))}
                        </Row>
                      </View>
                    </Row>
                  </Pressable>
                </View>
              );
            })}
          </Card>
        ) : (
          <EmptyState icon="time-outline" title="No classes held recently" />
        )}
      </View>

      <ExtraClassSheet data={data} visible={addingExtra} onClose={() => setAddingExtra(false)} onAdded={(c) => tellParents(c, 'extra')} />
      <CancelSheet
        data={data}
        occurrence={cancelling}
        onClose={() => setCancelling(null)}
        onCancelled={(c, reason) => tellParents(c, 'cancelled', reason)}
      />
      <ConfirmSheet
        visible={Boolean(removing)}
        title="Remove this extra class?"
        message={removing ? `${weekdayDate(removing.date)} · ${removing.note || 'Extra class'}` : ''}
        onConfirm={() => {
          if (removing?.extra) removeClassException(removing.extra.id);
          toast('Extra class removed', 'info');
        }}
        onClose={() => setRemoving(null)}
      />
    </View>
  );
}

function ClassRow({
  c,
  today,
  onCancel,
  onRestore,
  onRemoveExtra,
  onTell,
}: {
  c: ClassOccurrence;
  today: string;
  onCancel: () => void;
  onRestore: () => void;
  onRemoveExtra: () => void;
  onTell: () => void;
}) {
  const { colors } = useTheme();
  const cancelled = Boolean(c.cancelled);
  return (
    <View style={{ padding: spacing.lg }}>
      <Row gap={spacing.md} align="flex-start">
        <DateBadge iso={c.date} tone={c.date === today ? 'today' : c.kind === 'extra' ? 'extra' : 'default'} muted={cancelled} />
        <View style={{ flex: 1 }}>
          <AppText
            variant="subheading"
            style={cancelled ? { textDecorationLine: 'line-through', color: colors.textMuted } : undefined}
          >
            {classDayLabel(c.date, today).replace(/^\w/, (ch) => ch.toUpperCase())}
            {c.start ? ` · ${shortClock(c.start)}` : ''}
            {c.end ? ` – ${shortClock(c.end)}` : ''}
          </AppText>
          <Row gap={5} wrap style={{ marginTop: 4 }}>
            {cancelled ? <Pill label={`Cancelled · ${c.cancelled!.note}`} tone="error" icon="close-circle-outline" /> : null}
            {c.kind === 'extra' ? <Pill label="Extra class" tone="info" icon="add-circle-outline" /> : null}
            {c.kind === 'extra' && c.note ? <Pill label={c.note} /> : null}
          </Row>
        </View>
        <Pressable onPress={onTell} hitSlop={8} accessibilityLabel="Tell parents on WhatsApp" style={{ padding: 4 }}>
          <Ionicons name="logo-whatsapp" size={20} color={colors.success} />
        </Pressable>
      </Row>
      <Row gap={spacing.sm} style={{ marginTop: spacing.sm, paddingLeft: 56 }}>
        {cancelled ? (
          <Button label="Restore class" iconName="refresh-outline" size="sm" variant="secondary" onPress={onRestore} />
        ) : c.kind === 'extra' ? (
          <Button label="Remove" iconName="trash-outline" size="sm" variant="ghost" onPress={onRemoveExtra} />
        ) : (
          <Button label="Cancel class" iconName="close-circle-outline" size="sm" variant="ghost" onPress={onCancel} />
        )}
      </Row>
    </View>
  );
}

function ExtraClassSheet({
  data,
  visible,
  onClose,
  onAdded,
}: {
  data: DeckViewProps['data'];
  visible: boolean;
  onClose: () => void;
  onAdded: (c: ClassOccurrence) => void;
}) {
  const addExtraClass = useAppStore((s) => s.addExtraClass);
  const { toast } = useToast();
  const { deck, today } = data;
  const usual = DAY_KEYS.map((d) => deck.slots[d]).find(Boolean);
  const [date, setDate] = useState(today);
  const [other, setOther] = useState('');
  const [start, setStart] = useState(usual?.start ?? '05:00 PM');
  const [end, setEnd] = useState(usual?.end ?? '06:30 PM');
  const [note, setNote] = useState(EXTRA_NOTES[0]);

  const options = Array.from({ length: 14 }, (_, i) => shiftDate(today, i));
  const chosen = other || date;
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(chosen);
  const clash = validDate ? data.calendar(chosen, chosen).filter((c) => !c.cancelled) : [];
  const valid = validDate && isClockLabel(start) && isClockLabel(end) && note.trim().length > 1;

  return (
    <Sheet visible={visible} onClose={onClose} title="Add extra class" subtitle={deck.name}>
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: 6 }}>
          <AppText variant="overline" tone="muted">
            DATE
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {options.map((d) => (
              <Chip
                key={d}
                label={d === today ? 'Today' : weekdayDate(d)}
                selected={!other && d === date}
                onPress={() => {
                  setOther('');
                  setDate(d);
                }}
              />
            ))}
          </ScrollView>
          <FormField label="Or another date" placeholder="YYYY-MM-DD" value={other} onChangeText={setOther} />
          {clash.length ? (
            <AppText variant="caption" tone="error">
              There is already a class on this day at {shortClock(clash[0].start)}. Add it only if this is a second session.
            </AppText>
          ) : null}
        </View>
        <Row gap={spacing.md} align="flex-start">
          <FormField label="Starts" value={start} onChangeText={setStart} autoCapitalize="characters" containerStyle={{ flex: 1 }} />
          <FormField label="Ends" value={end} onChangeText={setEnd} autoCapitalize="characters" containerStyle={{ flex: 1 }} />
        </Row>
        <ChoiceChips label="Purpose" options={EXTRA_NOTES.map((n) => ({ value: n, label: n }))} value={note} onChange={setNote} />
        <FormField label="Note for students" value={note} onChangeText={setNote} />
        <Button
          label="Add & tell parents"
          iconName="logo-whatsapp"
          fullWidth
          disabled={!valid}
          onPress={() => {
            const input = { date: chosen, start_time: start.trim().toUpperCase(), end_time: end.trim().toUpperCase(), note: note.trim() };
            addExtraClass(deck.ref.id, input);
            toast(`Extra class added for ${weekdayDate(chosen)}`, 'success', 'calendar');
            onClose();
            onAdded({ date: chosen, start: input.start_time, end: input.end_time, kind: 'extra', cancelled: null, extra: null, note: input.note });
          }}
        />
      </View>
    </Sheet>
  );
}

function CancelSheet({
  data,
  occurrence,
  onClose,
  onCancelled,
}: {
  data: DeckViewProps['data'];
  occurrence: ClassOccurrence | null;
  onClose: () => void;
  onCancelled: (c: ClassOccurrence, reason: string) => void;
}) {
  const cancelClass = useAppStore((s) => s.cancelClass);
  const { toast } = useToast();
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [custom, setCustom] = useState('');
  if (!occurrence) return null;
  const finalReason = custom.trim() || reason;

  return (
    <Sheet
      visible
      onClose={onClose}
      title="Cancel class"
      subtitle={`${weekdayDate(occurrence.date)} · ${shortClock(occurrence.start)}`}
    >
      <View style={{ gap: spacing.lg }}>
        <ChoiceChips label="Reason" options={CANCEL_REASONS.map((r) => ({ value: r, label: r }))} value={reason} onChange={setReason} />
        <FormField label="Or write a reason" placeholder="e.g. Diwali break" value={custom} onChangeText={setCustom} />
        <Row gap={spacing.sm}>
          <Button
            label="Cancel only"
            variant="secondary"
            style={{ flex: 1 }}
            fullWidth
            onPress={() => {
              cancelClass(data.deck.ref.id, occurrence.date, finalReason);
              toast(`Class on ${weekdayDate(occurrence.date)} cancelled`, 'warning', 'close-circle');
              onClose();
            }}
          />
          <Button
            label="Cancel & tell"
            iconName="logo-whatsapp"
            variant="danger"
            style={{ flex: 1 }}
            fullWidth
            onPress={() => {
              cancelClass(data.deck.ref.id, occurrence.date, finalReason);
              toast(`Class on ${weekdayDate(occurrence.date)} cancelled`, 'warning', 'close-circle');
              onClose();
              onCancelled(occurrence, finalReason);
            }}
          />
        </Row>
      </View>
    </Sheet>
  );
}

function groupByWeek(items: ClassOccurrence[], today: string) {
  const [y, m, d] = today.split('-').map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7; // Monday = 0
  const weekStart = shiftDate(today, -dow);
  const groups: { label: string; items: ClassOccurrence[] }[] = [];
  for (const c of items) {
    const [cy, cm, cd] = c.date.split('-').map(Number);
    const offset = Math.floor(
      (new Date(cy, cm - 1, cd).getTime() - new Date(y, m - 1, d - dow).getTime()) / (7 * 86400000),
    );
    const label =
      offset === 0 ? 'This week' : offset === 1 ? 'Next week' : `Week of ${weekdayDate(shiftDate(weekStart, offset * 7)).slice(4)}`;
    const g = groups.find((x) => x.label === label);
    if (g) g.items.push(c);
    else groups.push({ label, items: [c] });
  }
  return groups;
}

function truncate(text: string, n: number) {
  return text.length > n ? `${text.slice(0, n - 1)}…` : text;
}

const styles = StyleSheet.create({
  day: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
