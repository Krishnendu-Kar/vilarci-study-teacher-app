import React, { useState } from 'react';
import { View } from 'react-native';
import { spacing } from '../../theme/tokens';
import { BATCH_LIMITS, BATCH_SUBJECTS } from '../../lib/api/privateBatches';
import { describeInstituteError, useSaveSubject } from '../../lib/api/institutes';
import type { Institute, WeekSchedule } from '../../lib/local/types';
import { summarizeSchedule } from '../../lib/utils/schedule';
import { AppText, Chip, Row, SectionHeader } from '../ui/base';
import { Button } from '../ui/Button';
import { FormField } from '../ui/Field';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { badScheduleDays, fromDraft, toDraft, WeeklyScheduleEditor } from './WeeklyScheduleEditor';

const OTHER = 'Other';

/** A subject being edited, as the section page knows it. */
export interface SubjectDraft {
  id: string;
  subject: string;
  teacher_id: string | null;
  weekly_schedule: WeekSchedule;
  room: string;
}

/**
 * Admins: add a subject to a section, or change one — its name, who teaches
 * it, room and timetable. Everyone in the section is in every subject.
 */
export function SubjectSheet({
  visible,
  onClose,
  sectionId,
  institute,
  editing,
}: {
  visible: boolean;
  onClose: () => void;
  sectionId: string;
  institute: Institute | undefined;
  /** Absent: a new subject. */
  editing?: SubjectDraft | null;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={editing ? `Edit ${editing.subject}` : 'Add a subject'} subtitle="Students of the section get it automatically">
      {visible ? <SubjectForm key={editing?.id ?? 'new'} sectionId={sectionId} institute={institute} editing={editing ?? null} onDone={onClose} /> : null}
    </Sheet>
  );
}

function SubjectForm({
  sectionId,
  institute,
  editing,
  onDone,
}: {
  sectionId: string;
  institute: Institute | undefined;
  editing: SubjectDraft | null;
  onDone: () => void;
}) {
  const toast = useToast();
  const save = useSaveSubject();
  const known = editing ? BATCH_SUBJECTS.includes(editing.subject) : true;
  const [subject, setSubject] = useState<string | null>(editing ? (known ? editing.subject : OTHER) : null);
  const [other, setOther] = useState(editing && !known ? editing.subject : '');
  const [teacherId, setTeacherId] = useState<string | null>(editing?.teacher_id ?? null);
  const [room, setRoom] = useState(editing?.room ?? '');
  const [schedule, setSchedule] = useState(() => toDraft(editing?.weekly_schedule));
  const [error, setError] = useState<string | null>(null);
  const teachers = (institute?.members ?? []).filter((m) => m.status === 'active');

  const submit = async () => {
    const name = subject === OTHER ? other.trim() : subject ?? '';
    if (name.length < 2 || name.length > 40) return setError('Choose the subject (2–40 characters).');
    if (badScheduleDays(schedule).length) return setError('Fix the highlighted class timings.');
    setError(null);
    try {
      await save.mutateAsync({
        sectionId,
        id: editing?.id,
        input: { subject: name, teacher_id: teacherId, weekly_schedule: fromDraft(schedule), room: room.trim() },
        before: editing ? { subject: editing.subject, teacher_id: editing.teacher_id } : undefined,
      });
      toast.toast(editing ? `${name} saved` : `${name} added to the section`, 'success');
      onDone();
    } catch (err) {
      setError(describeInstituteError(err));
    }
  };

  return (
    <View style={{ paddingBottom: spacing.lg }}>
      <AppText variant="overline" tone="muted" style={{ marginBottom: spacing.sm }}>
        SUBJECT
      </AppText>
      <Row gap={spacing.sm} wrap>
        {[...BATCH_SUBJECTS, OTHER].map((o) => (
          <Chip key={o} label={o} selected={subject === o} onPress={() => setSubject(o)} />
        ))}
      </Row>
      {subject === OTHER ? (
        <FormField label="Subject name" placeholder="e.g. Political Science" maxLength={40} value={other} onChangeText={setOther} containerStyle={{ marginTop: spacing.md }} />
      ) : null}

      <AppText variant="overline" tone="muted" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
        TEACHER
      </AppText>
      <Row gap={spacing.sm} wrap>
        <Chip label="Not yet" selected={teacherId === null} onPress={() => setTeacherId(null)} />
        {teachers.map((m) => (
          <Chip key={m.user_id} label={m.name} selected={teacherId === m.user_id} onPress={() => setTeacherId(m.user_id)} />
        ))}
      </Row>
      <AppText variant="caption" tone="muted" style={{ marginTop: 6 }}>
        They take attendance, tests and notices for this subject. Invite more teachers from the institute page.
      </AppText>

      <FormField
        label="Room"
        placeholder="e.g. Room 2, Lab 1 (optional)"
        maxLength={BATCH_LIMITS.roomMax}
        value={room}
        onChangeText={setRoom}
        containerStyle={{ marginTop: spacing.xl }}
      />

      <View style={{ marginTop: spacing.xl }}>
        <SectionHeader title="Weekly classes" subtitle={summarizeSchedule(fromDraft(schedule))} />
        <WeeklyScheduleEditor value={schedule} onChange={setSchedule} />
      </View>

      {error ? (
        <AppText variant="caption" tone="error" style={{ marginTop: spacing.md }}>
          {error}
        </AppText>
      ) : null}
      <Button
        label={editing ? 'Save subject' : 'Add subject'}
        iconName={editing ? 'checkmark-circle-outline' : 'add-circle-outline'}
        fullWidth
        loading={save.isPending}
        onPress={submit}
        style={{ marginTop: spacing.lg }}
      />
    </View>
  );
}
