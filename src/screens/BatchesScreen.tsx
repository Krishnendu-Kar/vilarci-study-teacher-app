import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { useAppStore } from '../lib/store/useAppStore';
import { useBatchNextClasses, useMyBatches } from '../lib/api/hooks';
import { summarizeSchedule } from '../lib/utils/schedule';
import { rupees } from '../lib/utils/format';
import {
  AppText,
  Chip,
  EmptyState,
  Pill,
  PressableCard,
  ProgressBar,
  Row,
} from '../components/ui/base';
import { Button } from '../components/ui/Button';
import { ChoiceChips } from '../components/ui/ChoiceChips';
import { FormField } from '../components/ui/Field';
import { Screen } from '../components/ui/Screen';
import { Sheet } from '../components/ui/Sheet';
import { useToast } from '../components/ui/Toast';
import { TeacherHeader } from '../components/TeacherHeader';
import { classDayLabel, shortClock } from '../components/ClassDate';

const GRADES = ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];
const BOARDS = ['CBSE', 'ICSE', 'State Board'];

/** Realm 1 — the teacher's own private tuition batches, grouped by class. */
export function BatchesScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const batches = useMyBatches();
  const { today, next } = useBatchNextClasses();
  const [grade, setGrade] = useState('all');
  const [creating, setCreating] = useState(false);

  // Deep link from Today's "New batch" quick action.
  useEffect(() => {
    if (route.params?.create) setCreating(true);
  }, [route.params?.create]);

  const grades = useMemo(
    () => [...new Set(batches.map((b) => b.grade))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })),
    [batches],
  );
  const visible = grade === 'all' ? batches : batches.filter((b) => b.grade === grade);
  const seats = batches.reduce((sum, b) => sum + b.student_ids.length, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <TeacherHeader
        overline="My private batches"
        right={<Button label="New" iconName="add" size="sm" onPress={() => setCreating(true)} />}
      />

      {batches.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm }}
        >
          <Chip label={`All · ${batches.length}`} selected={grade === 'all'} onPress={() => setGrade('all')} />
          {grades.map((g) => (
            <Chip
              key={g}
              label={`${g} · ${batches.filter((b) => b.grade === g).length}`}
              selected={grade === g}
              onPress={() => setGrade(g)}
            />
          ))}
        </ScrollView>
      ) : null}

      <Screen>
        {batches.length ? (
          <AppText variant="caption" tone="muted" style={{ marginBottom: spacing.md }}>
            {batches.length} batches · {seats} enrolled seats · tap a batch to open its command deck
          </AppText>
        ) : null}

        {visible.length ? (
          <View style={{ gap: spacing.md }}>
            {visible.map((b) => {
              const enrolled = b.student_ids.length;
              const fill = b.capacity ? (enrolled / b.capacity) * 100 : 0;
              return (
                <PressableCard
                  key={b.id}
                  level={1}
                  onPress={() => navigation.navigate('Deck', { type: 'private_batch', id: b.id, tab: 'students' })}
                >
                  <Row justify="space-between" align="flex-start" gap={spacing.md}>
                    <View style={{ flex: 1 }}>
                      <AppText variant="heading">{b.name}</AppText>
                      <Row gap={5} wrap style={{ marginTop: 6 }}>
                        <Pill label={`${b.grade} · ${b.board}`} tone="primary" />
                        <Pill label={b.subject} />
                      </Row>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Row>

                  <View style={{ marginTop: spacing.md, gap: 4 }}>
                    <Row gap={6}>
                      <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                      <AppText variant="caption" tone="secondary" style={{ flex: 1 }} numberOfLines={2}>
                        {summarizeSchedule(b.weekly_schedule)}
                      </AppText>
                    </Row>
                    {next[b.id] ? (
                      <Row gap={6}>
                        <Ionicons
                          name={next[b.id]!.date === today ? 'radio-button-on' : 'calendar-clear-outline'}
                          size={13}
                          color={next[b.id]!.date === today ? colors.success : colors.primary}
                        />
                        <AppText
                          variant="captionStrong"
                          style={{ color: next[b.id]!.date === today ? colors.successText : colors.primary }}
                        >
                          Next class {classDayLabel(next[b.id]!.date, today)} · {shortClock(next[b.id]!.start)}
                          {next[b.id]!.kind === 'extra' ? ' (extra)' : ''}
                        </AppText>
                      </Row>
                    ) : null}
                    <Row gap={6}>
                      <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                      <AppText variant="caption" tone="secondary" numberOfLines={1}>
                        {b.room}
                      </AppText>
                    </Row>
                  </View>

                  <View style={{ marginTop: spacing.md }}>
                    <Row justify="space-between" style={{ marginBottom: 5 }}>
                      <AppText variant="caption" tone="muted">
                        Enrolled
                      </AppText>
                      <AppText variant="captionStrong">
                        {enrolled} of {b.capacity} seats
                      </AppText>
                    </Row>
                    <ProgressBar value={fill} color={fill >= 90 ? colors.gold : colors.primary} />
                  </View>

                  <Row justify="space-between" style={{ marginTop: spacing.md }}>
                    <AppText variant="bodyStrong">
                      {rupees(b.monthly_fee)}
                      <AppText variant="caption" tone="muted">
                        {' '}
                        / month
                      </AppText>
                    </AppText>
                    <Pill label={b.join_code} tone="success" icon="key-outline" />
                  </Row>
                </PressableCard>
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon="school-outline"
            title={batches.length ? `No batches in ${grade}` : 'No private batches yet'}
            message="Create one batch per timing — morning, evening or weekend — for any class you teach."
          />
        )}

        {!batches.length ? (
          <Button
            label="Create your first batch"
            iconName="add"
            fullWidth
            onPress={() => setCreating(true)}
            style={{ marginTop: spacing.lg }}
          />
        ) : null}
      </Screen>

      <CreateBatchSheet
        visible={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => navigation.navigate('Deck', { type: 'private_batch', id, tab: 'settings' })}
      />
    </View>
  );
}

function CreateBatchSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const createBatch = useAppStore((s) => s.createBatch);
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('Class 10');
  const [board, setBoard] = useState('CBSE');
  const [subject, setSubject] = useState('Mathematics');
  const [room, setRoom] = useState('Home Studio');
  const [fee, setFee] = useState('2500');
  const [capacity, setCapacity] = useState('20');

  const feeNum = parseInt(fee, 10);
  const capNum = parseInt(capacity, 10);
  const valid = name.trim().length > 2 && subject.trim() && feeNum >= 0 && capNum > 0;

  const submit = () => {
    if (!valid) return;
    const id = createBatch({
      name: name.trim(),
      grade,
      board,
      subject: subject.trim(),
      room: room.trim() || 'Home Studio',
      monthly_fee: feeNum,
      capacity: capNum,
    });
    toast(`Created ${name.trim()} — set its weekly timings next.`, 'success');
    setName('');
    onClose();
    onCreated(id);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="New private batch" subtitle="You can rename and reschedule it any time">
      <View style={{ gap: spacing.lg }}>
        <FormField
          label="Batch name"
          placeholder="e.g. Class 10 Maths Weekend Achievers"
          value={name}
          onChangeText={setName}
        />
        <ChoiceChips label="Class" options={GRADES.map((g) => ({ value: g, label: g }))} value={grade} onChange={setGrade} />
        <ChoiceChips label="Board" options={BOARDS.map((b) => ({ value: b, label: b }))} value={board} onChange={setBoard} />
        <FormField label="Subject" value={subject} onChangeText={setSubject} />
        <FormField label="Room / venue" value={room} onChangeText={setRoom} />
        <Row gap={spacing.md} align="flex-start">
          <FormField
            label="Monthly fee (₹)"
            value={fee}
            onChangeText={(t) => setFee(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            containerStyle={{ flex: 1 }}
          />
          <FormField
            label="Seats"
            value={capacity}
            onChangeText={(t) => setCapacity(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            containerStyle={{ flex: 1 }}
          />
        </Row>
        <Button label="Create batch" iconName="checkmark" fullWidth disabled={!valid} onPress={submit} />
      </View>
    </Sheet>
  );
}
