import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, radius, spacing } from '../../theme/tokens';
import { useAppStore } from '../../lib/store/useAppStore';
import { cbseGrade, scorecard } from '../../lib/api/selectors';
import type { BatchTest, SubmissionStatus, TestSubmission } from '../../lib/data/types';
import { formatDate, todayIso } from '../../lib/utils/format';
import { AppText, Card, Chip, EmptyState, Pill, Row, StatTile } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { Field, FormField } from '../../components/ui/Field';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import type { DeckViewProps } from '../DeckScreen';

type Draft = Record<string, { marks: string; status: SubmissionStatus; weak: string }>;

/** Tests, marks entry and diagnostic scorecards with automatic ranking. */
export function TestsView({ data }: DeckViewProps) {
  const { deck, tests } = data;
  const [activeId, setActiveId] = useState<string | null>(tests[0]?.id ?? null);
  const [scheduling, setScheduling] = useState(false);
  const active = tests.find((t) => t.id === activeId) ?? tests[0] ?? null;

  return (
    <View>
      <Button
        label="Schedule a test"
        iconName="add"
        variant="secondary"
        fullWidth
        onPress={() => setScheduling(true)}
      />
      {tests.length ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.lg }}
          >
            {tests.map((t) => (
              <Chip
                key={t.id}
                label={`${t.title.length > 26 ? `${t.title.slice(0, 26)}…` : t.title} · ${t.max_marks}M`}
                selected={t.id === active?.id}
                onPress={() => setActiveId(t.id)}
              />
            ))}
          </ScrollView>
          {active ? <Scorecard key={active.id} test={active} data={data} onDeleted={() => setActiveId(null)} /> : null}
        </>
      ) : (
        <View style={{ marginTop: spacing.lg }}>
          <EmptyState
            icon="document-text-outline"
            title="No tests yet"
            message="Schedule a chapter test, then enter marks to build ranked scorecards."
          />
        </View>
      )}

      <ScheduleTestSheet
        deckId={deck.ref.id}
        defaultSubject={deck.subject.split(',')[0]}
        visible={scheduling}
        onClose={() => setScheduling(false)}
        onCreated={setActiveId}
      />
    </View>
  );
}

function Scorecard({ test, data, onDeleted }: { test: BatchTest; data: DeckViewProps['data']; onDeleted: () => void }) {
  const { colors } = useTheme();
  const saveScorecard = useAppStore((s) => s.saveScorecard);
  const deleteTest = useAppStore((s) => s.deleteTest);
  const { toast } = useToast();
  const { roster } = data;
  const { rows, stats } = useMemo(() => scorecard(test, roster), [test, roster]);
  const [draft, setDraft] = useState<Draft>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const seed = () =>
    Object.fromEntries(
      rows.map((r) => [r.student.id, { marks: r.marks == null ? '' : String(r.marks), status: r.status, weak: r.weak_topics }]),
    );
  useEffect(() => setDraft(seed()), [test]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (id: string, p: Partial<Draft[string]>) => setDraft((d) => ({ ...d, [id]: { ...d[id], ...p } }));

  const invalid = Object.values(draft).some((d) => d.marks !== '' && Number(d.marks) > test.max_marks);

  const save = () => {
    const submissions: TestSubmission[] = roster.map((s) => {
      const d = draft[s.id];
      const marks = d?.marks === '' || d?.marks == null ? null : Math.min(test.max_marks, Math.max(0, Number(d.marks)));
      const status: SubmissionStatus = d?.status === 'absent' ? 'absent' : marks == null ? 'pending' : 'present';
      return { student_id: s.id, marks: status === 'absent' ? null : marks, status, weak_topics: d?.weak.trim() ?? '' };
    });
    saveScorecard(test.id, submissions);
    toast(`Scorecard saved for ${test.title}. Ranks recomputed.`, 'success');
  };

  return (
    <View>
      <Card>
        <Row gap={5} wrap>
          <Pill label={test.subject} tone="primary" />
          <Pill label={formatDate(test.conducted_date)} />
          <Pill label={`Max ${test.max_marks}`} />
        </Row>
        <AppText variant="heading" style={{ marginTop: spacing.sm }}>
          {test.title}
        </AppText>
        <AppText variant="caption" tone="muted">
          {stats.graded} of {roster.length} graded · pass mark 33%
        </AppText>
      </Card>

      <Row gap={spacing.md} wrap style={{ marginTop: spacing.md }}>
        <StatTile
          label="Class average"
          value={stats.graded ? `${stats.average.toFixed(1)}` : '—'}
          sub={stats.graded ? `${((stats.average / test.max_marks) * 100).toFixed(0)}% of ${test.max_marks}` : 'Enter marks'}
          tone="primary"
        />
        <StatTile
          label="Highest"
          value={stats.graded ? `${stats.highest}` : '—'}
          sub={stats.topper ?? '—'}
          tone="success"
        />
      </Row>
      <Row gap={spacing.md} wrap style={{ marginTop: spacing.md }}>
        <StatTile label="Lowest" value={stats.graded ? `${stats.lowest}` : '—'} sub="Benchmark floor" tone="warning" />
        <StatTile
          label="Pass rate"
          value={stats.graded ? `${stats.passRate.toFixed(0)}%` : '—'}
          sub={`${stats.passed} of ${stats.graded} passed`}
          tone="gold"
        />
      </Row>

      <AppText variant="subheading" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
        Scorecard
      </AppText>
      <View style={{ gap: spacing.sm }}>
        {rows.map((r) => {
          const d = draft[r.student.id] ?? { marks: '', status: r.status, weak: '' };
          const absent = d.status === 'absent';
          const pct = !absent && d.marks !== '' ? (Number(d.marks) / test.max_marks) * 100 : null;
          const over = d.marks !== '' && Number(d.marks) > test.max_marks;
          return (
            <Card key={r.student.id} padded={false}>
              <View style={{ padding: spacing.md }}>
                <Row gap={spacing.md}>
                  <AppText variant="captionStrong" style={{ width: 34 }} tone={r.rank && r.rank <= 3 ? 'gold' : 'muted'}>
                    {r.rank ? `#${r.rank}` : '—'}
                  </AppText>
                  <View style={{ flex: 1 }}>
                    <AppText variant="subheading" numberOfLines={1}>
                      {r.student.name}
                    </AppText>
                    <AppText variant="caption" tone="muted">
                      {r.student.roll}
                      {pct != null ? ` · ${pct.toFixed(0)}% · ${cbseGrade(pct)}` : ''}
                    </AppText>
                  </View>
                  <Field
                    value={absent ? '' : d.marks}
                    editable={!absent}
                    placeholder={absent ? 'AB' : '—'}
                    onChangeText={(t) => patch(r.student.id, { marks: t.replace(/[^\d]/g, ''), status: 'present' })}
                    keyboardType="number-pad"
                    maxLength={4}
                    style={[
                      styles.marks,
                      { borderColor: over ? colors.error : colors.border, fontFamily: fonts.sansBold },
                    ]}
                  />
                  <AppText variant="caption" tone="muted">
                    /{test.max_marks}
                  </AppText>
                </Row>
                <Row gap={spacing.sm} style={{ marginTop: spacing.sm }}>
                  <Pressable
                    onPress={() => patch(r.student.id, { status: absent ? 'pending' : 'absent' })}
                    style={[
                      styles.absentToggle,
                      {
                        backgroundColor: absent ? colors.errorBg : colors.surfaceMuted,
                        borderColor: absent ? colors.error : colors.border,
                      },
                    ]}
                  >
                    <AppText variant="captionStrong" style={{ color: absent ? colors.errorText : colors.textSecondary }}>
                      {absent ? 'Absent' : 'Mark absent'}
                    </AppText>
                  </Pressable>
                  <Field
                    value={d.weak}
                    onChangeText={(t) => patch(r.student.id, { weak: t })}
                    placeholder="Weak topic / feedback"
                    style={{ flex: 1, paddingVertical: 8, fontSize: 13 }}
                  />
                </Row>
              </View>
            </Card>
          );
        })}
      </View>

      {invalid ? (
        <AppText variant="caption" tone="error" style={{ marginTop: spacing.sm }}>
          Marks cannot exceed {test.max_marks}.
        </AppText>
      ) : null}
      <Button
        label="Save scorecard & re-rank"
        iconName="save-outline"
        fullWidth
        disabled={invalid}
        onPress={save}
        style={{ marginTop: spacing.lg }}
      />
      <Button
        label="Delete test"
        iconName="trash-outline"
        variant="ghost"
        fullWidth
        onPress={() => setConfirmDelete(true)}
        style={{ marginTop: spacing.sm }}
      />

      <ConfirmSheet
        visible={confirmDelete}
        title="Delete this test?"
        message={`"${test.title}" and every student's marks for it will be removed.`}
        confirmLabel="Delete"
        onConfirm={() => {
          deleteTest(test.id);
          toast('Test removed', 'info');
          onDeleted();
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </View>
  );
}

function ScheduleTestSheet({
  deckId,
  defaultSubject,
  visible,
  onClose,
  onCreated,
}: {
  deckId: string;
  defaultSubject: string;
  visible: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const scheduleTest = useAppStore((s) => s.scheduleTest);
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [maxMarks, setMaxMarks] = useState('50');
  const [date, setDate] = useState(todayIso());
  const valid = title.trim().length > 3 && parseInt(maxMarks, 10) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);

  return (
    <Sheet visible={visible} onClose={onClose} title="Schedule a test" subtitle="Every enrolled student gets a scorecard row">
      <View style={{ gap: spacing.lg }}>
        <FormField label="Test title" placeholder="e.g. Triangles Chapter Test" value={title} onChangeText={setTitle} />
        <FormField label="Subject" value={subject} onChangeText={setSubject} />
        <Row gap={spacing.md} align="flex-start">
          <FormField
            label="Max marks"
            value={maxMarks}
            onChangeText={(t) => setMaxMarks(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            containerStyle={{ flex: 1 }}
          />
          <FormField label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" containerStyle={{ flex: 1.4 }} />
        </Row>
        <Button
          label="Schedule test"
          iconName="checkmark"
          fullWidth
          disabled={!valid}
          onPress={() => {
            const id = scheduleTest(deckId, {
              title: title.trim(),
              subject: subject.trim() || defaultSubject,
              max_marks: parseInt(maxMarks, 10),
              date,
            });
            toast(`Scheduled ${title.trim()} (${maxMarks} marks)`, 'success');
            setTitle('');
            onClose();
            onCreated(id);
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  marks: { width: 64, textAlign: 'center', paddingVertical: 8, paddingHorizontal: 6, fontSize: 16 },
  absentToggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
