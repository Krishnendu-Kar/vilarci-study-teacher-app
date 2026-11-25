import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import {
  BATCH_LIMITS,
  BATCH_SUBJECTS,
  BOARDS,
  describeBatchError,
  GRADES,
  usePrivateBatch,
  useSaveBatch,
} from '../../lib/api/privateBatches';
import { describeInstituteError, useCreateSection, useInstitute } from '../../lib/api/institutes';
import { useTeacherProfile } from '../../lib/api/teacherProfile';
import { summarizeSchedule } from '../../lib/utils/schedule';
import { addMonths, courseLabel, currentMonth } from '../../lib/utils/months';
import { MonthPicker } from '../../components/real/MonthPicker';
import { AppText, Chip, Row, SectionHeader } from '../../components/ui/base';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { ErrorBanner } from '../../components/auth/AuthKit';
import { RealTopBar } from '../../components/real/RealTopBar';
import { badScheduleDays, fromDraft, toDraft, WeeklyScheduleEditor } from '../../components/real/WeeklyScheduleEditor';

type Errors = Partial<Record<'name' | 'subject' | 'grade' | 'board' | 'fee' | 'capacity' | 'schedule' | 'course', string>>;

const OTHER = 'Other';

/**
 * Create a private batch, or edit one (route param `id`). With `instituteId`
 * it creates a section of that institute; editing a section works the same.
 * Sections have no subject or timetable of their own — their subjects do.
 */
export function BatchFormScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const toast = useToast();
  const editingId: string | undefined = route.params?.id;
  const { data: existing } = usePrivateBatch(editingId);
  const { data: teacher } = useTeacherProfile();
  const save = useSaveBatch();
  const createSection = useCreateSection();
  const newSectionOf: string | undefined = route.params?.instituteId;
  const isSection = !!newSectionOf || existing?.kind === 'section';
  const institute = useInstitute(newSectionOf ?? existing?.institute_id ?? undefined);

  const initialSubject = existing?.subject ?? teacher?.primary_subject ?? '';
  const subjectKnown = BATCH_SUBJECTS.includes(initialSubject);

  const [name, setName] = useState(existing?.name ?? '');
  const [subject, setSubject] = useState<string | null>(initialSubject ? (subjectKnown ? initialSubject : OTHER) : null);
  const [otherSubject, setOtherSubject] = useState(subjectKnown ? '' : initialSubject);
  const [grade, setGrade] = useState<string | null>(existing?.grade ?? null);
  const [board, setBoard] = useState<string | null>(existing?.board ?? null);
  const [room, setRoom] = useState(existing?.room ?? '');
  // The form takes whole rupees; the server keeps paise.
  const [fee, setFee] = useState(existing ? String(Math.round(existing.monthly_fee / 100)) : '');
  const [capacity, setCapacity] = useState(existing ? String(existing.capacity) : newSectionOf ? '40' : '20');
  const [schedule, setSchedule] = useState(() => toDraft(existing?.weekly_schedule));
  const [courseStart, setCourseStart] = useState(existing?.course_start ?? currentMonth());
  const [courseEnd, setCourseEnd] = useState(existing?.course_end ?? addMonths(existing?.course_start ?? currentMonth(), 11));
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);

  const clear = (k: keyof Errors) => errors[k] && setErrors((e) => ({ ...e, [k]: undefined }));

  const submit = async () => {
    const e: Errors = {};
    const n = name.trim();
    if (n.length < BATCH_LIMITS.nameMin || n.length > BATCH_LIMITS.nameMax) {
      e.name = `${isSection ? 'Section' : 'Batch'} name must be ${BATCH_LIMITS.nameMin}–${BATCH_LIMITS.nameMax} characters.`;
    }
    const finalSubject = isSection ? existing?.subject ?? 'Section' : subject === OTHER ? otherSubject.trim() : subject ?? '';
    if (finalSubject.length < 2) e.subject = 'Choose the subject.';
    const feeNum = fee.trim() === '' ? 0 : Number(fee);
    if (!Number.isInteger(feeNum) || feeNum < 0 || feeNum > BATCH_LIMITS.feeMax) e.fee = 'Enter the monthly fee in rupees.';
    const capNum = Number(capacity);
    if (!Number.isInteger(capNum) || capNum < BATCH_LIMITS.capacityMin || capNum > BATCH_LIMITS.capacityMax) {
      e.capacity = `Seats must be ${BATCH_LIMITS.capacityMin}–${BATCH_LIMITS.capacityMax}.`;
    }
    if (badScheduleDays(schedule).length) e.schedule = 'Fix the highlighted class timings.';
    if (courseEnd < courseStart) e.course = 'The course must end on or after the start month.';
    else if (courseEnd > addMonths(courseStart, 35)) e.course = 'A course can run for at most 36 months.';
    setErrors(e);
    setFailure(null);
    if (Object.keys(e).length) return;

    const input = {
      name: n,
      subject: finalSubject,
      grade,
      board,
      room: room.trim(),
      monthly_fee: feeNum * 100,
      capacity: capNum,
      weekly_schedule: fromDraft(schedule),
      course_start: courseStart,
      course_end: courseEnd,
    };
    try {
      if (newSectionOf) {
        const { subject: _section, ...sectionInput } = input;
        const id = await createSection.mutateAsync({ instituteId: newSectionOf, input: sectionInput });
        toast.toast(`${n} created — now add its subjects`, 'success');
        navigation.replace('BatchDetail', { id });
        return;
      }
      const id = await save.mutateAsync({ id: editingId, input });
      toast.toast(editingId ? (isSection ? 'Section updated' : 'Batch updated') : `${n} created`, 'success');
      if (editingId) navigation.goBack();
      else navigation.replace('BatchDetail', { id });
    } catch (err) {
      setFailure(newSectionOf ? describeInstituteError(err) : describeBatchError(err));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bgApp }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <RealTopBar title={isSection ? (editingId ? 'Edit section' : 'New section') : editingId ? 'Edit batch' : 'New private batch'} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={failure} />
        {isSection && institute ? (
          <AppText variant="caption" tone="muted" style={{ marginBottom: spacing.md }}>
            {institute.name} · students join a section and get all its subjects. Add the subjects, their teachers and timetables on the section’s page.
          </AppText>
        ) : null}

        <FormField
          label={isSection ? 'Section name' : 'Batch name'}
          placeholder={isSection ? 'e.g. Class 10-A' : 'e.g. Class 10 Physics — Evening'}
          maxLength={BATCH_LIMITS.nameMax}
          value={name}
          onChangeText={(t) => {
            setName(t);
            clear('name');
          }}
          error={errors.name}
        />

        {isSection ? null : (
          <ChipGroup
            label="Subject"
            options={[...BATCH_SUBJECTS, OTHER]}
            value={subject}
            onChange={(v) => {
              setSubject(v);
              clear('subject');
            }}
            error={errors.subject}
          />
        )}
        {!isSection && subject === OTHER ? (
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
          optional
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
          optional
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
          <SectionHeader title="Course duration" subtitle={courseLabel(courseStart, courseEnd) ?? undefined} />
          <Row gap={spacing.md}>
            <MonthPicker
              label="Starts"
              value={courseStart}
              onChange={(v) => {
                setCourseStart(v);
                if (courseEnd < v) setCourseEnd(addMonths(v, 11));
                clear('course');
              }}
            />
            <MonthPicker
              label="Ends"
              value={courseEnd}
              min={courseStart}
              max={addMonths(courseStart, 35)}
              onChange={(v) => {
                setCourseEnd(v);
                clear('course');
              }}
            />
          </Row>
          <AppText variant="caption" tone={errors.course ? 'error' : 'muted'} style={{ marginTop: spacing.sm }}>
            {errors.course ?? 'Every student’s fee ledger runs month by month across this period.'}
          </AppText>
        </View>

        <View style={{ marginTop: spacing.xxl, display: isSection ? 'none' : 'flex' }}>
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
          label={editingId ? 'Save changes' : isSection ? 'Create section' : 'Create batch'}
          iconName={editingId ? 'checkmark-circle-outline' : 'add-circle-outline'}
          size="lg"
          fullWidth
          loading={save.isPending || createSection.isPending}
          onPress={submit}
          style={{ marginTop: spacing.xl }}
        />
        {editingId ? null : (
          <AppText variant="caption" tone="muted" center style={{ marginTop: spacing.md }}>
            {isSection
              ? 'The section gets its own join code; families can also find it with the institute’s code.'
              : 'A join code is created automatically for students to join.'}
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
  optional,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
  error?: string;
  /** Adds a "Not needed" choice (null) — for music, art, yoga and play batches. */
  optional?: boolean;
}) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <AppText variant="overline" tone={error ? 'error' : 'muted'} style={{ marginBottom: spacing.sm }}>
        {label.toUpperCase()}
      </AppText>
      <Row gap={spacing.sm} wrap>
        {optional ? <Chip label="Not needed" selected={value === null} onPress={() => onChange(null)} /> : null}
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
