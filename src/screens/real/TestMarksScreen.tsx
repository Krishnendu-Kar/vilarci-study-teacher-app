import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  type FlatListInstance,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  TextInput,
  type TextInputInstance,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, radius, spacing } from '../../theme/tokens';
import { studentName, useBatchRoster, usePrivateBatch } from '../../lib/api/privateBatches';
import { deleteTest, describeTestError, rosterForTest, saveScore, updateTest, useBatchTests } from '../../lib/api/tests';
import type { Enrolment } from '../../lib/local/types';
import { useLocalStore } from '../../lib/local/store';
import { classDateLabel } from '../../lib/utils/attendance';
import { formatMarks, parseScore, Score, scoreOf, scorePercent, summarize } from '../../lib/utils/tests';
import { AppText, Card, Chip, EmptyState, Row } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { RealTopBar } from '../../components/real/RealTopBar';
import { SyncBanner } from '../../components/real/SyncBanner';
import { TestEditor } from '../../components/real/TestParts';

type Filter = 'all' | 'missing';
type SheetName = 'options' | 'edit' | 'delete' | null;

/** One test's mark sheet: every student's marks (or AB), saved as you go — offline too. */
export function TestMarksScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const toast = useToast();
  const { batchId, testId } = useRoute<any>().params as { batchId: string; testId: string };
  const { data: batch } = usePrivateBatch(batchId);
  const { data: roster } = useBatchRoster(batchId);
  const tests = useBatchTests(batchId);
  const months = useLocalStore((s) => s.months);
  const test = tests.find((t) => t.id === testId);

  // Marks show at once; the store catches up a moment later.
  const [overrides, setOverrides] = useState<Record<string, Score | null>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [sheet, setSheet] = useState<SheetName>(null);
  const listRef = useRef<FlatListInstance>(null);
  const inputs = useRef<Record<string, TextInputInstance | null>>({});

  const students = useMemo(() => rosterForTest(roster, months, testId), [roster, months, testId]);
  const stored = useCallback((id: string) => scoreOf(months[id], testId), [months, testId]);
  const current = useCallback((id: string) => (id in overrides ? overrides[id] : stored(id)), [overrides, stored]);

  // Drop the instant marks the saved copy now agrees with.
  useEffect(() => {
    setOverrides((o) => {
      const keep = Object.fromEntries(Object.entries(o).filter(([id, v]) => scoreOf(months[id], testId) !== v));
      return Object.keys(keep).length === Object.keys(o).length ? o : keep;
    });
  }, [months, testId]);

  if (!test || !batch) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
        <RealTopBar title="Marks" />
        {!batch ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : (
          <View style={{ padding: spacing.lg }}>
            <EmptyState icon="document-text-outline" title="Test not found" message="It may have been deleted." />
          </View>
        )}
      </View>
    );
  }

  const scores = students.map((r) => current(r.id));
  const summary = summarize(scores);
  const entered = scores.filter((s) => s != null).length;
  const missing = students.length - entered;
  const highest = summary.high;
  const shown = filter === 'missing' ? students.filter((r) => current(r.id) == null) : students;

  const commit = (r: Enrolment, value: Score | null) => {
    if (value === current(r.id)) return;
    setOverrides((o) => ({ ...o, [r.id]: value }));
    const classScores = students.map((x) => (x.id === r.id ? value : current(x.id)));
    saveScore(test, r.id, value, months[r.id], classScores).catch((err) => toast.toast(describeTestError(err), 'error'));
  };

  /** Next student's box (the list may need to scroll it into view first). */
  const focusAfter = (index: number) => {
    const next = shown[index + 1];
    if (!next) return;
    const field = inputs.current[next.id];
    if (field) field.focus();
    else {
      listRef.current?.scrollToIndex({ index: index + 1, viewPosition: 0.4, animated: true });
      setTimeout(() => inputs.current[next.id]?.focus(), 250);
    }
  };

  const header = (
    <View>
      <SyncBanner />
      <Card>
        <AppText variant="caption" tone="muted">
          {[test.subject, classDateLabel(test.held_on, true)].filter(Boolean).join(' · ')}
        </AppText>
        <AppText variant="subheading" style={{ marginTop: 2 }}>
          Out of {formatMarks(test.max_marks)}
        </AppText>
        <Row gap={spacing.sm} style={{ marginTop: spacing.md }}>
          <Stat value={`${entered}/${students.length}`} label="Marked" />
          <Stat value={summary.avg != null ? formatMarks(summary.avg) : '—'} label="Average" />
          <Stat value={summary.high != null ? formatMarks(summary.high) : '—'} label="Highest" />
          <Stat value={String(summary.ab)} label="Absent" />
        </Row>
      </Card>
      <Row gap={spacing.sm} style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
        <Chip label={`All · ${students.length}`} selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label={`Not marked · ${missing}`} selected={filter === 'missing'} onPress={() => setFilter('missing')} />
      </Row>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bgApp }} behavior="padding">
      <RealTopBar
        title={test.title}
        right={
          <Pressable
            onPress={() => setSheet('options')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Test options"
            style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={colors.textMain} />
          </Pressable>
        }
      />
      <FlatList
        ref={listRef}
        data={shown}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        onScrollToIndexFailed={({ averageItemLength, index }) =>
          listRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: true })
        }
        ListEmptyComponent={
          <AppText variant="caption" tone="muted" style={{ padding: spacing.lg }}>
            {filter === 'missing' ? 'Everyone is marked.' : 'No students in this batch yet.'}
          </AppText>
        }
        ListFooterComponent={
          shown.length ? (
            <AppText variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
              Marks save as you go (offline too). Type AB or tap AB for absent; clear a box to remove a mark.
            </AppText>
          ) : undefined
        }
        renderItem={({ item: r, index }) => (
          <MarkRow
            student={r}
            value={current(r.id)}
            max={test.max_marks}
            first={index === 0}
            setRef={(el) => (inputs.current[r.id] = el)}
            onCommit={(v) => commit(r, v)}
            onNext={() => focusAfter(index)}
            onFocus={() =>
              setTimeout(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.35, animated: true }), 300)
            }
          />
        )}
      />

      <Sheet visible={sheet === 'options'} onClose={() => setSheet(null)} title={test.title} scroll={false}>
        <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
          <Button
            label="Edit test"
            iconName="create-outline"
            variant="secondary"
            fullWidth
            onPress={() => {
              setSheet(null);
              setTimeout(() => setSheet('edit'), 300);
            }}
          />
          <Button
            label="Delete test"
            iconName="trash-outline"
            variant="danger"
            fullWidth
            onPress={() => {
              setSheet(null);
              setTimeout(() => setSheet('delete'), 300);
            }}
          />
        </View>
      </Sheet>
      {sheet === 'edit' ? (
        <TestEditor
          initial={test}
          defaultSubject={batch.subject}
          highest={highest}
          onClose={() => setSheet(null)}
          onSave={(input) => {
            setSheet(null);
            updateTest(test, input, highest)
              .then(() => toast.toast('Test saved', 'success'))
              .catch((err) => toast.toast(describeTestError(err), 'error'));
          }}
        />
      ) : null}
      <ConfirmSheet
        visible={sheet === 'delete'}
        title="Delete this test?"
        message={`“${test.title}” and its ${entered} mark${entered === 1 ? '' : 's'} disappear for you and every parent on their next refresh.`}
        confirmLabel="Delete test"
        onClose={() => setSheet(null)}
        onConfirm={() => {
          deleteTest(test, roster, months)
            .then(() => {
              toast.toast('Test deleted', 'info');
              navigation.goBack();
            })
            .catch((err) => toast.toast(describeTestError(err), 'error'));
        }}
      />
    </KeyboardAvoidingView>
  );
}

function display(v: Score | null): string {
  return v == null ? '' : v === 'AB' ? 'AB' : formatMarks(v);
}

/** One student's marks: type a number (or AB), or tap AB. Saves when the box is left. */
function MarkRow({
  student: r,
  value,
  max,
  first,
  setRef,
  onCommit,
  onNext,
  onFocus,
}: {
  student: Enrolment;
  value: Score | null;
  max: number;
  first: boolean;
  setRef: (el: TextInputInstance | null) => void;
  onCommit: (v: Score | null) => void;
  onNext: () => void;
  onFocus: () => void;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState(display(value));
  const [error, setError] = useState<string | null>(null);
  const editing = useRef(false);
  const latest = useRef({ text, value, onCommit, max });
  useEffect(() => {
    latest.current = { text, value, onCommit, max };
  });

  // Show the saved mark when it changes from elsewhere (not while typing).
  useEffect(() => {
    if (!editing.current) setText(display(value));
  }, [value]);

  const commitText = (t: string) => {
    const parsed = parseScore(t, max);
    if ('error' in parsed) {
      setError(parsed.error);
      return false;
    }
    setError(null);
    if (parsed.value !== value) onCommit(parsed.value);
    return true;
  };

  // Leaving the screen while typing still saves a valid mark.
  useEffect(
    () => () => {
      const { text: t, value: v, onCommit: save, max: m } = latest.current;
      if (!editing.current) return;
      const parsed = parseScore(t, m);
      if (!('error' in parsed) && parsed.value !== v) save(parsed.value);
    },
    [],
  );

  const pct = scorePercent(value, max);
  const absent = value === 'AB';
  return (
    <View style={[styles.row, { borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
      <Row gap={spacing.md}>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {studentName(r)}
          </AppText>
          <AppText variant="caption" tone={error ? 'error' : 'muted'} numberOfLines={1}>
            {error ?? (absent ? 'Absent' : pct != null ? `${pct}%` : r.status !== 'approved' ? 'No longer in the batch' : 'Not marked')}
          </AppText>
        </View>
        <TextInput
          ref={setRef}
          value={text}
          onChangeText={(t) => {
            setText(t);
            if (error) setError(null);
          }}
          onFocus={() => {
            editing.current = true;
            onFocus();
          }}
          onBlur={() => {
            editing.current = false;
            if (!commitText(text)) return;
          }}
          onSubmitEditing={() => {
            if (commitText(text)) onNext();
          }}
          placeholder="—"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          returnKeyType="next"
          submitBehavior="submit"
          selectTextOnFocus
          maxLength={7}
          accessibilityLabel={`${studentName(r)}'s marks out of ${formatMarks(max)}`}
          style={[
            styles.input,
            {
              color: absent ? colors.error : colors.textMain,
              backgroundColor: colors.surfaceMuted,
              borderColor: error ? colors.error : colors.border,
            },
          ]}
        />
        <AppText variant="caption" tone="muted" style={{ width: 38 }}>
          / {formatMarks(max)}
        </AppText>
        <Pressable
          onPress={() => {
            const next = absent ? null : 'AB';
            setText(display(next));
            setError(null);
            onCommit(next);
          }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityState={{ selected: absent }}
          accessibilityLabel={absent ? `${studentName(r)} absent. Tap to clear` : `Mark ${studentName(r)} absent`}
          style={({ pressed }) => [
            styles.ab,
            {
              backgroundColor: absent ? colors.error : colors.surfaceMuted,
              borderColor: absent ? colors.error : colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <AppText variant="captionStrong" style={{ color: absent ? '#FFFFFF' : colors.textMuted }}>
            AB
          </AppText>
        </Pressable>
      </Row>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surfaceMuted }]}>
      <AppText variant="subheading">{value}</AppText>
      <AppText variant="overline" tone="muted">
        {label.toUpperCase()}
      </AppText>
    </View>
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
  row: { paddingVertical: spacing.md },
  input: {
    width: 72,
    height: 42,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: fonts.sansSemibold,
  },
  ab: {
    width: 40,
    height: 42,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md },
});
