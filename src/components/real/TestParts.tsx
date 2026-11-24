import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/tokens';
import type { BatchTest } from '../../lib/local/types';
import { TestInput, testProblem } from '../../lib/api/tests';
import { addDays, classDateLabel, dateOf, isoDate, localToday } from '../../lib/utils/attendance';
import {
  formatMarks,
  MAX_MARKS_PRESETS,
  summaryOf,
  TEST_SUBJECT_MAX,
  TEST_TITLE_MAX,
} from '../../lib/utils/tests';
import { AppText, Card, Chip, Pill, Row } from '../ui/base';
import { Button } from '../ui/Button';
import { FormField } from '../ui/Field';
import { Sheet } from '../ui/Sheet';

/** One test in a list: name, subject · date · out of, how many marks are in, the class average. */
export function TestCard({ test, entered, total }: { test: BatchTest; entered: number; total: number }) {
  const { colors } = useTheme();
  const s = summaryOf(test);
  const done = total > 0 && entered >= total;
  return (
    <Card>
      <Row justify="space-between" align="flex-start" gap={spacing.sm}>
        <View style={{ flex: 1 }}>
          <AppText variant="subheading" numberOfLines={1}>
            {test.title}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {[test.subject, classDateLabel(test.held_on), `out of ${formatMarks(test.max_marks)}`].filter(Boolean).join(' · ')}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Row>
      <Row gap={spacing.sm} wrap style={{ marginTop: spacing.sm }}>
        <Pill
          label={total ? `${entered}/${total} marked` : 'No students'}
          tone={done ? 'success' : entered ? 'warning' : 'neutral'}
          icon={done ? 'checkmark-circle-outline' : 'create-outline'}
        />
        {s?.avg != null ? <Pill label={`Avg ${formatMarks(s.avg)}`} tone="info" /> : null}
        {s?.high != null ? <Pill label={`High ${formatMarks(s.high)}`} tone="gold" /> : null}
        {test.pending ? <Pill label="Waiting to upload" tone="info" icon="cloud-upload-outline" /> : null}
      </Row>
    </Card>
  );
}

/** Make or edit a test. `highest` = the top mark already given (max marks can't go below it). */
export function TestEditor({
  initial,
  defaultSubject,
  highest,
  onClose,
  onSave,
}: {
  initial?: BatchTest;
  defaultSubject: string;
  highest?: number | null;
  onClose: () => void;
  onSave: (input: TestInput) => void;
}) {
  const { colors, isDark } = useTheme();
  const today = localToday();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [subject, setSubject] = useState(initial?.subject ?? defaultSubject);
  const [heldOn, setHeldOn] = useState(initial?.held_on ?? today);
  const [maxText, setMaxText] = useState(initial ? formatMarks(initial.max_marks) : '50');
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canPick = Platform.OS === 'android' || Platform.OS === 'ios';

  const save = () => {
    const input: TestInput = { title, subject: subject.trim() || null, held_on: heldOn, max_marks: Number(maxText.replace(',', '.')) };
    const problem = testProblem(input, highest);
    if (problem) {
      setError(problem);
      return;
    }
    onSave(input);
  };

  return (
    <Sheet visible onClose={onClose} title={initial ? 'Edit test' : 'New test'} subtitle="Marks are entered on the next screen">
      <View style={{ gap: spacing.lg }}>
        <FormField
          label={`Test name (${title.trim().length}/${TEST_TITLE_MAX})`}
          placeholder="e.g. Unit test 3 — Motion"
          maxLength={TEST_TITLE_MAX}
          value={title}
          autoFocus={!initial}
          onChangeText={(t) => {
            setTitle(t);
            if (error) setError(null);
          }}
        />
        <FormField label="Subject" placeholder="Optional" maxLength={TEST_SUBJECT_MAX} value={subject} onChangeText={setSubject} />

        <View style={{ gap: 6 }}>
          <AppText variant="overline" tone="muted">
            DATE
          </AppText>
          <View style={[styles.dateBar, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Step icon="chevron-back" label="Day before" onPress={() => setHeldOn(addDays(heldOn, -1))} />
            <Pressable
              onPress={() => canPick && setPicking((p) => !p)}
              disabled={!canPick}
              accessibilityRole="button"
              style={({ pressed }) => ({ flex: 1, alignItems: 'center', opacity: pressed ? 0.6 : 1 })}
            >
              <AppText variant="subheading">{classDateLabel(heldOn, true)}</AppText>
              <AppText variant="caption" tone={heldOn === today ? 'primary' : 'muted'}>
                {heldOn === today ? 'Today' : canPick ? 'Tap to pick a date' : ' '}
              </AppText>
            </Pressable>
            <Step icon="chevron-forward" label="Day after" onPress={() => setHeldOn(addDays(heldOn, 1))} />
          </View>
          {picking && Platform.OS === 'android' ? (
            <DateTimePicker
              value={dateOf(heldOn)}
              mode="date"
              onValueChange={(_, d) => {
                setPicking(false);
                setHeldOn(isoDate(d));
              }}
              onDismiss={() => setPicking(false)}
            />
          ) : null}
          {picking && Platform.OS === 'ios' ? (
            <DateTimePicker
              value={dateOf(heldOn)}
              mode="date"
              display="inline"
              themeVariant={isDark ? 'dark' : 'light'}
              onValueChange={(_, d) => {
                setHeldOn(isoDate(d));
                setPicking(false);
              }}
            />
          ) : null}
        </View>

        <View style={{ gap: 6 }}>
          <AppText variant="overline" tone="muted">
            MAX MARKS
          </AppText>
          <Row gap={spacing.sm} wrap>
            {MAX_MARKS_PRESETS.map((n) => (
              <Chip
                key={n}
                label={String(n)}
                selected={maxText === String(n)}
                onPress={() => {
                  setMaxText(String(n));
                  if (error) setError(null);
                }}
              />
            ))}
          </Row>
          <FormField
            label="Or type it"
            keyboardType="decimal-pad"
            value={maxText}
            onChangeText={(t) => {
              setMaxText(t);
              if (error) setError(null);
            }}
            containerStyle={{ marginTop: spacing.xs }}
          />
        </View>

        {error ? (
          <AppText variant="caption" tone="error">
            {error}
          </AppText>
        ) : null}
        <Button label={initial ? 'Save test' : 'Create test'} iconName={initial ? 'checkmark' : 'add'} fullWidth onPress={save} />
      </View>
    </Sheet>
  );
}

function Step({ icon, label, onPress }: { icon: 'chevron-back' | 'chevron-forward'; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.step, { backgroundColor: colors.surface, opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={17} color={colors.textMain} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  step: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
