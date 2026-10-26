import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import {
  BATCH_LIMITS,
  BOARDS,
  describeBatchError,
  GRADES,
  usePrivateBatch,
  useSaveBatch,
} from '../../lib/api/privateBatches';
import { SUBJECTS, useTeacherProfile } from '../../lib/api/teacherProfile';
import { summarizeSchedule } from '../../lib/utils/schedule';
import { AppText, Chip, Row, SectionHeader } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { ErrorBanner } from '../../components/auth/AuthKit';
import { RealTopBar } from '../../components/real/RealTopBar';
import { badScheduleDays, fromDraft, toDraft, WeeklyScheduleEditor } from '../../components/real/WeeklyScheduleEditor';

type Errors = Partial<Record<'name' | 'subject' | 'grade' | 'board' | 'fee' | 'capacity' | 'schedule', string>>;

const OTHER = 'Other';

/** Create a private batch, or edit one (route param `id`). */
export function BatchFormScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const toast = useToast();
  const editingId: string | undefined = route.params?.id;
  const { data: existing } = usePrivateBatch(editingId);
  const { data: teacher } = useTeacherProfile();
  const save = useSaveBatch();

  const initialSubject = existing?.subject ?? teacher?.primary_subject ?? '';
  const subjectKnown = SUBJECTS.includes(initialSubject);

  const [name, setName] = useState(existing?.name ?? '');
  const [subject, setSubject] = useState<string | null>(initialSubject ? (subjectKnown ? initialSubject : OTHER) : null);
  const [otherSubject, setOtherSubject] = useState(subjectKnown ? '' : initialSubject);
  const [grade, setGrade] = useState<string | null>(existing?.grade ?? null);
  const [board, setBoard] = useState<string | null>(existing?.board ?? null);
  const [room, setRoom] = useState(existing?.room ?? '');
  const [fee, setFee] = useState(existing ? String(existing.monthly_fee) : '');
  const [capacity, setCapacity] = useState(existing ? String(existing.capacity) : '20');
  const [schedule, setSchedule] = useState(() => toDraft(existing?.weekly_schedule));
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);

  const clear = (k: keyof Errors) => errors[k] && setErrors((e) => ({ ...e, [k]: undefined }));

  const submit = async () => {
    const e: Errors = {};
    const n = name.trim();
    if (n.length < BATCH_LIMITS.nameMin || n.length > BATCH_LIMITS.nameMax) {
      e.name = `Batch name must be ${BATCH_LIMITS.nameMin}–${BATCH_LIMITS.nameMax} characters.`;
    }
    const finalSubject = subject === OTHER ? otherSubject.trim() : subject ?? '';
    if (finalSubject.length < 2) e.subject = 'Choose the subject.';
    if (!grade) e.grade = 'Choose the class.';
    if (!board) e.board = 'Choose the board.';
    const feeNum = fee.trim() === '' ? 0 : Number(fee);
    if (!Number.isInteger(feeNum) || feeNum < 0 || feeNum > BATCH_LIMITS.feeMax) e.fee = 'Enter the monthly fee in rupees.';
    const capNum = Number(capacity);
    if (!Number.isInteger(capNum) || capNum < BATCH_LIMITS.capacityMin || capNum > BATCH_LIMITS.capacityMax) {
      e.capacity = `Seats must be ${BATCH_LIMITS.capacityMin}–${BATCH_LIMITS.capacityMax}.`;
    }
    if (badScheduleDays(schedule).length) e.schedule = 'Fix the highlighted class timings.';
    setErrors(e);
    setFailure(null);
    if (Object.keys(e).length) return;

    try {
      const id = await save.mutateAsync({
        id: editingId,
        input: {
          name: n,
          subject: finalSubject,
          grade: grade!,
          board: board!,
          room: room.trim(),
          monthly_fee: feeNum,
          capacity: capNum,
          weekly_schedule: fromDraft(schedule),
        },
      });
      toast.toast(editingId ? 'Batch updated' : `${n} created`, 'success');
      if (editingId) navigation.goBack();
      else navigation.replace('BatchDetail', { id });
    } catch (err) {
      setFailure(describeBatchError(err));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bgApp }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <RealTopBar title={editingId ? 'Edit batch' : 'New private batch'} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={failure} />

        <FormField
          label="Batch name"
          placeholder="e.g. Class 10 Physics — Evening"
          maxLength={BATCH_LIMITS.nameMax}
          value={name}
          onChangeText={(t) => {
            setName(t);
            clear('name');
          }}
          error={errors.name}
        />

        <ChipGroup
          label="Subject"
          options={[...SUBJECTS, OTHER]}
          value={subject}
          onChange={(v) => {
            setSubject(v);
            clear('subject');
          }}
          error={errors.subject}
        />
        {subject === OTHER ? (
          <FormField
            label="Your subject"
            placeholder="e.g. Political Science"
            maxLength={40}
            value={otherSubject}
            onChangeText={(t) => {
              setOtherSubject(t);
              clear('subject');
            }}
            containerStyle={{ marginTop: spacing.md }}
          />
        ) : null}

        <ChipGroup
          label="Class"
          options={GRADES}
          value={grade}
          onChange={(v) => {
            setGrade(v);
            clear('grade');
          }}
          error={errors.grade}
        />
        <ChipGroup
          label="Board"
          options={BOARDS}
          value={board}
          onChange={(v) => {
            setBoard(v);
            clear('board');
          }}
          error={errors.board}
        />

        <View style={{ gap: spacing.lg, marginTop: spacing.xl }}>
          <FormField label="Room / venue" placeholder="e.g. Home study room, Room 2" maxLength={BATCH_LIMITS.roomMax} value={room} onChangeText={setRoom} />
          <Row gap={spacing.md} align="flex-start">
            <FormField
              label="Monthly fee (₹)"
              placeholder="1500"
              keyboardType="number-pad"
              maxLength={7}
              value={fee}
              onChangeText={(t) => {
                setFee(t.replace(/\D/g, ''));
                clear('fee');
              }}
              error={errors.fee}
              containerStyle={{ flex: 1 }}
            />
            <FormField
              label="Seats"
              placeholder="20"
              keyboardType="number-pad"
              maxLength={3}
              value={capacity}
              onChangeText={(t) => {
                setCapacity(t.replace(/\D/g, ''));
                clear('capacity');
              }}
              error={errors.capacity}
              containerStyle={{ flex: 1 }}
            />
          </Row>
        </View>

        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Weekly class days" subtitle={summarizeSchedule(fromDraft(schedule))} />
          <WeeklyScheduleEditor
            value={schedule}
            onChange={(next) => {
              setSchedule(next);
              clear('schedule');
            }}
          />
          {errors.schedule ? (
            <AppText variant="caption" tone="error" style={{ marginTop: spacing.sm }}>
              {errors.schedule}
            </AppText>
          ) : null}
        </View>

        <Button
          label={editingId ? 'Save changes' : 'Create batch'}
          iconName={editingId ? 'checkmark-circle-outline' : 'add-circle-outline'}
          size="lg"
          fullWidth
          loading={save.isPending}
          onPress={submit}
          style={{ marginTop: spacing.xl }}
        />
        {editingId ? null : (
          <AppText variant="caption" tone="muted" center style={{ marginTop: spacing.md }}>
            A join code is created automatically for students to join.
          </AppText>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ChipGroup({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <AppText variant="overline" tone={error ? 'error' : 'muted'} style={{ marginBottom: spacing.sm }}>
        {label.toUpperCase()}
      </AppText>
      <Row gap={spacing.sm} wrap>
        {options.map((o) => (
          <Chip key={o} label={o} selected={value === o} onPress={() => onChange(o)} />
        ))}
      </Row>
      {error ? (
        <AppText variant="caption" tone="error" style={{ marginTop: 6 }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
