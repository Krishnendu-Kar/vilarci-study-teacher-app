import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import { useAppStore } from '../../lib/store/useAppStore';
import { syllabusSummary, topicVariance } from '../../lib/api/selectors';
import type { SyllabusStatus, SyllabusTopic } from '../../lib/data/types';
import { formatDateShort, todayIso } from '../../lib/utils/format';
import { AppText, Card, EmptyState, Pill, PillTone, ProgressBar, Row, StatTile } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { ChoiceChips } from '../../components/ui/ChoiceChips';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { FormField } from '../../components/ui/Field';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import type { DeckViewProps } from '../DeckScreen';

const STATUS: Record<SyllabusStatus, { label: string; tone: PillTone; next: string }> = {
  upcoming: { label: 'Upcoming', tone: 'neutral', next: 'Start topic' },
  in_progress: { label: 'In progress', tone: 'warning', next: 'Mark covered' },
  covered: { label: 'Covered', tone: 'success', next: 'Reopen' },
};

/** Curriculum tracker: the planned target against what was actually taught. */
export function SyllabusView({ data }: DeckViewProps) {
  const { colors } = useTheme();
  const cycleTopicStatus = useAppStore((s) => s.cycleTopicStatus);
  const removeTopic = useAppStore((s) => s.removeTopic);
  const { toast } = useToast();
  const { deck, topics } = data;
  const today = todayIso();
  const summary = syllabusSummary(topics, today);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<SyllabusTopic | null>(null);

  return (
    <View>
      {topics.length ? (
        <>
          <Card>
            <Row justify="space-between" style={{ marginBottom: 5 }}>
              <AppText variant="captionStrong">Planned by today</AppText>
              <AppText variant="caption" tone="muted">
                {summary.plannedByToday} of {summary.total} · {summary.plannedPercent.toFixed(0)}%
              </AppText>
            </Row>
            <ProgressBar value={summary.plannedPercent} color={colors.info} height={7} />
            <Row justify="space-between" style={{ marginTop: spacing.md, marginBottom: 5 }}>
              <AppText variant="captionStrong">Actually covered</AppText>
              <AppText variant="caption" tone="muted">
                {summary.covered} of {summary.total} · {summary.actualPercent.toFixed(0)}%
              </AppText>
            </Row>
            <ProgressBar value={summary.actualPercent} gradient={colors.primaryGradient} height={7} />
            <AppText variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
              {summary.actualPercent >= summary.plannedPercent
                ? 'Teaching is keeping pace with the plan.'
                : `${summary.plannedByToday - summary.covered} topic${summary.plannedByToday - summary.covered === 1 ? '' : 's'} behind the planned pace.`}
            </AppText>
          </Card>
          <Row gap={spacing.md} wrap style={{ marginTop: spacing.md }}>
            <StatTile label="In progress" value={String(summary.inProgress)} sub="Active topics" tone="warning" />
            <StatTile
              label="Delayed"
              value={String(summary.delayed)}
              sub={summary.delayed ? 'Behind target date' : 'Fully on schedule'}
              tone={summary.delayed ? 'error' : 'success'}
            />
          </Row>
        </>
      ) : null}

      <Button
        label="Add chapter / topic"
        iconName="add"
        variant="secondary"
        fullWidth
        onPress={() => setAdding(true)}
        style={{ marginTop: spacing.lg }}
      />

      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        {topics.length ? (
          topics.map((t) => {
            const variance = topicVariance(t, today);
            const s = STATUS[t.status];
            return (
              <Card key={t.id} rail={variance.delayed ? colors.error : t.status === 'covered' ? colors.success : undefined}>
                <Row justify="space-between" align="flex-start" gap={spacing.md}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="overline" tone="primary">
                      CHAPTER {t.chapter_number} · {t.subject.toUpperCase()}
                    </AppText>
                    <AppText variant="subheading" style={{ marginTop: 2 }}>
                      {t.chapter_name}
                    </AppText>
                    <AppText variant="caption" tone="secondary">
                      {t.topic_name}
                    </AppText>
                  </View>
                  <Pill label={s.label} tone={s.tone} />
                </Row>
                <Row gap={5} wrap style={{ marginTop: spacing.md }}>
                  <Pill label={variance.label} tone={variance.tone} />
                  <Pill label={`Target ${formatDateShort(t.planned_target_date)}`} />
                  {t.actual_completion_date ? <Pill label={`Done ${formatDateShort(t.actual_completion_date)}`} tone="success" /> : null}
                </Row>
                <AppText variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
                  {t.revised_count
                    ? `Self-revised by ${t.revised_count} student${t.revised_count === 1 ? '' : 's'} in the Vilarci Study app`
                    : 'No student revisions logged yet'}
                </AppText>
                <Row gap={spacing.sm} style={{ marginTop: spacing.md }}>
                  <Button
                    label={s.next}
                    size="sm"
                    variant={t.status === 'covered' ? 'secondary' : 'primary'}
                    iconName={t.status === 'covered' ? 'refresh-outline' : 'arrow-forward'}
                    onPress={() => {
                      const next = cycleTopicStatus(t.id);
                      if (next) toast(`${t.chapter_name}: ${STATUS[next].label}`, 'info');
                    }}
                  />
                  <Button label="Remove" size="sm" variant="ghost" iconName="trash-outline" onPress={() => setRemoving(t)} />
                </Row>
              </Card>
            );
          })
        ) : (
          <EmptyState
            icon="book-outline"
            title="No curriculum yet"
            message="Add chapters with a planned target date to track delays against reality."
          />
        )}
      </View>

      <AddTopicSheet
        deckId={deck.ref.id}
        defaultSubject={deck.subject.split(',')[0]}
        nextChapter={(topics.reduce((m, t) => Math.max(m, t.chapter_number), 0) || 0) + 1}
        visible={adding}
        onClose={() => setAdding(false)}
      />
      <ConfirmSheet
        visible={Boolean(removing)}
        title="Remove this topic?"
        message={removing ? `Chapter ${removing.chapter_number}: ${removing.chapter_name} — ${removing.topic_name}` : ''}
        onConfirm={() => {
          if (!removing) return;
          removeTopic(removing.id);
          toast('Topic removed from curriculum', 'info');
        }}
        onClose={() => setRemoving(null)}
      />
    </View>
  );
}

function AddTopicSheet({
  deckId,
  defaultSubject,
  nextChapter,
  visible,
  onClose,
}: {
  deckId: string;
  defaultSubject: string;
  nextChapter: number;
  visible: boolean;
  onClose: () => void;
}) {
  const addTopic = useAppStore((s) => s.addTopic);
  const { toast } = useToast();
  const [chapter, setChapter] = useState('');
  const [chapterName, setChapterName] = useState('');
  const [topicName, setTopicName] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [target, setTarget] = useState(todayIso());
  const [status, setStatus] = useState<SyllabusStatus>('upcoming');
  const chapterNum = parseInt(chapter || String(nextChapter), 10);
  const valid = chapterName.trim() && topicName.trim() && chapterNum > 0 && /^\d{4}-\d{2}-\d{2}$/.test(target);

  return (
    <Sheet visible={visible} onClose={onClose} title="Add chapter / topic" subtitle="Set the planned target date">
      <View style={{ gap: spacing.lg }}>
        <Row gap={spacing.md} align="flex-start">
          <FormField
            label="Chapter no."
            value={chapter}
            placeholder={String(nextChapter)}
            onChangeText={(t) => setChapter(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            containerStyle={{ flex: 1 }}
          />
          <FormField label="Subject" value={subject} onChangeText={setSubject} containerStyle={{ flex: 2 }} />
        </Row>
        <FormField label="Chapter name" placeholder="e.g. Circles" value={chapterName} onChangeText={setChapterName} />
        <FormField
          label="Topic"
          placeholder="e.g. Tangent to a circle & number of tangents"
          value={topicName}
          onChangeText={setTopicName}
        />
        <FormField label="Planned target date" value={target} onChangeText={setTarget} placeholder="YYYY-MM-DD" />
        <ChoiceChips
          label="Status"
          options={[
            { value: 'upcoming' as SyllabusStatus, label: 'Upcoming' },
            { value: 'in_progress' as SyllabusStatus, label: 'In progress' },
            { value: 'covered' as SyllabusStatus, label: 'Covered' },
          ]}
          value={status}
          onChange={setStatus}
        />
        <Button
          label="Add to curriculum"
          iconName="checkmark"
          fullWidth
          disabled={!valid}
          onPress={() => {
            addTopic(deckId, {
              subject: subject.trim() || defaultSubject,
              chapter_number: chapterNum,
              chapter_name: chapterName.trim(),
              topic_name: topicName.trim(),
              planned_target_date: target,
              status,
            });
            toast(`Added Chapter ${chapterNum}: ${chapterName.trim()}`, 'success');
            setChapter('');
            setChapterName('');
            setTopicName('');
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}
