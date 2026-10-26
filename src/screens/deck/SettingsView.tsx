import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/tokens';
import { useAppStore } from '../../lib/store/useAppStore';
import type { DayKey, WeeklySchedule } from '../../lib/data/types';
import { DAY_KEYS, DAY_LABELS, isClockLabel, isClosed, parseRange, summarizeSchedule } from '../../lib/utils/schedule';
import { AppText, Card, Divider, Row, SectionHeader } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { Field, FormField } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import type { DeckViewProps } from '../DeckScreen';

type DayDraft = { open: boolean; start: string; end: string };

/** The portal's canonical key order for the schedule JSON. */
const JSON_ORDER: DayKey[] = ['fri', 'mon', 'sat', 'sun', 'thu', 'tue', 'wed'];

function toDraft(schedule: WeeklySchedule | null): Record<DayKey, DayDraft> {
  return Object.fromEntries(
    DAY_KEYS.map((d) => {
      const r = parseRange(schedule?.[d]);
      return [d, { open: !isClosed(schedule?.[d]), start: r?.start ?? '05:00 PM', end: r?.end ?? '06:30 PM' }];
    }),
  ) as Record<DayKey, DayDraft>;
}

function fromDraft(draft: Record<DayKey, DayDraft>): WeeklySchedule {
  return Object.fromEntries(
    DAY_KEYS.map((d) => [d, draft[d].open ? `${draft[d].start.trim().toUpperCase()} - ${draft[d].end.trim().toUpperCase()}` : 'Closed']),
  ) as WeeklySchedule;
}

/** Rename the deck, move rooms, reprice, and edit the 7-day timetable. */
export function SettingsView({ data }: DeckViewProps) {
  const { colors } = useTheme();
  const updateDeckSettings = useAppStore((s) => s.updateDeckSettings);
  const { toast } = useToast();
  const { deck } = data;
  const [name, setName] = useState(deck.name);
  const [room, setRoom] = useState(deck.room);
  const [fee, setFee] = useState(String(deck.monthlyFee));
  const [days, setDays] = useState(() => toDraft(deck.weeklySchedule));
  const [showJson, setShowJson] = useState(false);

  const schedule = useMemo(() => fromDraft(days), [days]);
  const badTimes = DAY_KEYS.filter((d) => days[d].open && !(isClockLabel(days[d].start) && isClockLabel(days[d].end)));
  const valid = name.trim().length > 2 && room.trim() && !badTimes.length && (!deck.isPrivate || parseInt(fee, 10) >= 0);

  const setDay = (d: DayKey, patch: Partial<DayDraft>) => setDays((prev) => ({ ...prev, [d]: { ...prev[d], ...patch } }));

  const json = JSON.stringify(Object.fromEntries(JSON_ORDER.map((k) => [k, schedule[k]])), null, 2);

  return (
    <View>
      <Card>
        <View style={{ gap: spacing.lg }}>
          <FormField label={deck.isPrivate ? 'Batch name' : 'Section code'} value={name} onChangeText={setName} />
          <FormField label="Room / venue" value={room} onChangeText={setRoom} />
          {deck.isPrivate ? (
            <FormField
              label="Default monthly fee (₹)"
              value={fee}
              onChangeText={(t) => setFee(t.replace(/\D/g, ''))}
              keyboardType="number-pad"
              hint="Applies to new students. Existing students keep their personalised fee."
            />
          ) : null}
        </View>
      </Card>

      <View style={{ marginTop: spacing.xxl }}>
        <SectionHeader title="Regular weekly days" subtitle={summarizeSchedule(schedule)} />
        <AppText variant="caption" tone="muted" style={{ marginTop: -spacing.sm, marginBottom: spacing.md }}>
          Turn on only the days this batch normally meets — usually one or two. One-off extra or cancelled classes
          are managed from Classes, not here.
        </AppText>
        <Card padded={false}>
          {DAY_KEYS.map((d, idx) => {
            const day = days[d];
            const bad = badTimes.includes(d);
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
                        Closed
                      </AppText>
                    )}
                    <Switch
                      value={day.open}
                      onValueChange={(open) => setDay(d, { open })}
                      trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
                      thumbColor={Platform.OS === 'android' ? colors.surface : undefined}
                    />
                  </Row>
                  {day.open ? (
                    <Row gap={spacing.sm} style={{ marginTop: spacing.sm }}>
                      <Ionicons name="sunny-outline" size={15} color={colors.gold} />
                      <Field
                        value={day.start}
                        onChangeText={(t) => setDay(d, { start: t })}
                        placeholder="09:00 AM"
                        autoCapitalize="characters"
                        style={[styles.time, bad && { borderColor: colors.error }]}
                      />
                      <AppText variant="overline" tone="muted">
                        TO
                      </AppText>
                      <Ionicons name="moon-outline" size={14} color={colors.info} />
                      <Field
                        value={day.end}
                        onChangeText={(t) => setDay(d, { end: t })}
                        placeholder="05:00 PM"
                        autoCapitalize="characters"
                        style={[styles.time, bad && { borderColor: colors.error }]}
                      />
                    </Row>
                  ) : null}
                </View>
              </View>
            );
          })}
        </Card>
        {badTimes.length ? (
          <AppText variant="caption" tone="error" style={{ marginTop: spacing.sm }}>
            Use times like 09:00 AM for {badTimes.map((d) => DAY_LABELS[d]).join(', ')}.
          </AppText>
        ) : null}

        <Pressable onPress={() => setShowJson((v) => !v)} style={{ marginTop: spacing.md }} hitSlop={6}>
          <Row gap={6}>
            <Ionicons name={showJson ? 'chevron-down' : 'chevron-forward'} size={14} color={colors.textMuted} />
            <AppText variant="captionStrong" tone="muted">
              Schedule JSON (synced to the student timetable)
            </AppText>
          </Row>
        </Pressable>
        {showJson ? (
          <View style={[styles.json, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <AppText style={[styles.mono, { color: colors.textSecondary }]}>{json}</AppText>
          </View>
        ) : null}
      </View>

      <Button
        label="Save settings"
        iconName="save-outline"
        fullWidth
        disabled={!valid}
        style={{ marginTop: spacing.xl }}
        onPress={() => {
          updateDeckSettings(deck.ref, {
            name: name.trim(),
            room: room.trim(),
            monthly_fee: parseInt(fee, 10) || deck.monthlyFee,
            weekly_schedule: schedule,
          });
          toast(`${deck.isPrivate ? 'Batch' : 'Section'} settings and weekly schedule saved`, 'success');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  time: { flex: 1, paddingVertical: 8, paddingHorizontal: spacing.md, fontSize: 13.5, textAlign: 'center' },
  json: { marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 12, lineHeight: 18 },
});
