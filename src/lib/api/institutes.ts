// Coaching institutes (new-db-plan.md §23 in the student app's repo).
// An institute has teachers (owner, admins, teachers) and sections; a section
// is a batch students join, and each of its subjects is a child batch with
// one teacher. The institute itself (members, sections, codes) comes in the
// account snapshot; sections and subjects sync like any batch. Every change
// to the institute is an online action, then a sync.
import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { supabase } from '../supabase';
import { useLocalStore } from '../local/store';
import type { Batch, Institute, InstituteMember, InstituteRole, InstituteSection, WeekSchedule } from '../local/types';
import { requestSync, saveEdit } from '../sync/engine';
import type { BatchInput } from './privateBatches';

export const INSTITUTE_LIMITS = {
  nameMin: 3,
  nameMax: 60,
  taglineMax: 120,
  addressMax: 200,
  phoneMax: 20,
  emailMax: 120,
  titleMax: 60,
  perOwner: 5,
  sectionsPerInstitute: 200,
  subjectsPerSection: 20,
};

/** Colours an institute can pick for its logo and cards. */
export const INSTITUTE_COLORS = ['#8E1437', '#1E5AA8', '#0F7B6C', '#B4531C', '#6B3FA0', '#2F3640', '#C2185B', '#2E7D32'];

/** What the institute form saves. */
export interface InstituteInput {
  name: string;
  tagline: string;
  logo_text: string;
  theme_color: string;
  address: string;
  phone: string;
  email: string;
  established: number | null;
}

const NO_INSTITUTES: Institute[] = [];

/** Institutes this account belongs to or asked to join (deleted ones included, for the owner to restore). */
export function useInstitutes(): { data: Institute[]; isLoading: boolean } {
  const isLoading = useLocalStore((s) => !s.ready || !s.account);
  const data = useLocalStore((s) => s.account?.institutes ?? NO_INSTITUTES);
  return { data, isLoading };
}

export function useInstitute(id: string | undefined): Institute | undefined {
  return useLocalStore((s) => (id ? s.account?.institutes?.find((i) => i.id === id) : undefined));
}

/** The owner and admins run the institute. */
export function isInstituteAdmin(inst: Pick<Institute, 'my_role' | 'my_status'> | undefined): boolean {
  return !!inst && inst.my_status === 'active' && (inst.my_role === 'owner' || inst.my_role === 'admin');
}

export const ROLE_LABELS: Record<InstituteRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  teacher: 'Teacher',
};

/** "Director · Owner", "Physics faculty · Teacher". */
export function memberLine(m: Pick<InstituteMember, 'title' | 'role'>): string {
  return [m.title, ROLE_LABELS[m.role]].filter(Boolean).join(' · ');
}

/** The institute a section or subject belongs to, from the snapshot. */
export function useInstituteOf(b: Pick<Batch, 'institute_id'> | undefined): Institute | undefined {
  return useInstitute(b?.institute_id ?? undefined);
}

/** A section as listed in its institute (subjects with their teachers, counts). */
export function useSectionInfo(b: Pick<Batch, 'id' | 'institute_id' | 'kind'> | undefined): InstituteSection | undefined {
  const inst = useInstituteOf(b);
  return useMemo(() => (b && b.kind === 'section' ? inst?.sections?.find((s) => s.batch_id === b.id) : undefined), [inst, b]);
}

// ── the institute ──────────────────────────────────────────────────────────

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  await requestSync();
  return data as T;
}

/** Creates (phone-made id, retry-safe) or edits an institute. Returns its id. */
export function useSaveInstitute() {
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: InstituteInput }): Promise<string> => {
      if (id) {
        await rpc('institute_update', { p_id: id, p_data: input });
        return id;
      }
      const newId = Crypto.randomUUID();
      await rpc('institute_create', { p_id: newId, p_data: input });
      return newId;
    },
  });
}

export function useDeleteInstitute() {
  return useMutation({ mutationFn: (id: string) => rpc('institute_delete', { p_id: id }) });
}

export function useRestoreInstitute() {
  return useMutation({ mutationFn: (id: string) => rpc('institute_restore', { p_id: id }) });
}

/** A new students' or teachers' code: the old QR and code stop working. */
export function useResetInstituteCode() {
  return useMutation({
    mutationFn: ({ id, which }: { id: string; which: 'students' | 'staff' }) =>
      rpc('institute_reset_code', { p_id: id, p_which: which }),
  });
}

// ── teachers ───────────────────────────────────────────────────────────────

export interface StaffPreview {
  id: string;
  name: string;
  tagline: string;
  logo_text: string;
  theme_color: string;
  address: string;
  owner_name: string;
  teachers: number;
  sections: number;
  my_status: string | null;
  my_role: string | null;
}

/** What a staff code opens (null: no such institute). */
export async function previewStaffCode(code: string): Promise<StaffPreview | null> {
  const { data, error } = await supabase.rpc('institute_staff_preview', { p_code: code });
  if (error) throw error;
  return (data as StaffPreview | null) ?? null;
}

export function useAskToJoinInstitute() {
  return useMutation({
    mutationFn: ({ code, title }: { code: string; title: string }) =>
      rpc('institute_staff_request', { p_code: code, p_data: { title } }),
  });
}

export function useDecideTeacher() {
  return useMutation({
    mutationFn: ({ id, userId, approve }: { id: string; userId: string; approve: boolean }) =>
      rpc('institute_staff_decide', { p_id: id, p_user: userId, p_approve: approve }),
  });
}

export function useUpdateMember() {
  return useMutation({
    mutationFn: ({
      id,
      userId,
      data,
    }: {
      id: string;
      userId: string;
      data: Partial<{ role: 'admin' | 'teacher'; title: string; subjects: string[] }>;
    }) => rpc('institute_member_update', { p_id: id, p_user: userId, p_data: data }),
  });
}

export function useRemoveTeacher() {
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => rpc('institute_member_remove', { p_id: id, p_user: userId }),
  });
}

export function useLeaveInstitute() {
  return useMutation({ mutationFn: (id: string) => rpc('institute_leave', { p_id: id }) });
}

// ── sections and subjects ──────────────────────────────────────────────────

/** A new section (a batch students join). Returns its id. */
export function useCreateSection() {
  return useMutation({
    mutationFn: async ({ instituteId, input }: { instituteId: string; input: Omit<BatchInput, 'subject'> }): Promise<string> => {
      const id = Crypto.randomUUID();
      await rpc('section_create', { p_institute: instituteId, p_id: id, p_data: input });
      return id;
    },
  });
}

export interface SubjectInput {
  subject: string;
  teacher_id: string | null;
  weekly_schedule: WeekSchedule;
  room: string;
}

/**
 * Adds a subject (online) or edits one: the subject and its teacher online,
 * the timetable and room through the outbox (offline too).
 */
export function useSaveSubject() {
  return useMutation({
    mutationFn: async ({
      sectionId,
      id,
      input,
      before,
    }: {
      sectionId: string;
      id?: string;
      input: SubjectInput;
      /** The subject as it was, so only what changed is sent. */
      before?: Pick<SubjectInput, 'subject' | 'teacher_id'>;
    }): Promise<string> => {
      if (!id) {
        const newId = Crypto.randomUUID();
        await rpc('subject_add', { p_section: sectionId, p_id: newId, p_data: input });
        return newId;
      }
      if (!before || before.subject !== input.subject || before.teacher_id !== input.teacher_id) {
        await rpc('subject_update', { p_id: id, p_data: { subject: input.subject, teacher_id: input.teacher_id } });
      }
      await saveEdit({ t: 'batches', b: id, data: { weekly_schedule: input.weekly_schedule, room: input.room } });
      return id;
    },
  });
}

export function describeInstituteError(err: unknown): string {
  const msg = String((err as Error)?.message ?? '');
  if (/network|fetch|timed? ?out/i.test(msg)) return 'No connection. This needs the internet.';
  if (/teacher profile/i.test(msg)) return 'Create your teacher profile first.';
  if (/up to 5 institutes/i.test(msg)) return `You can own up to ${INSTITUTE_LIMITS.perOwner} institutes.`;
  if (/owner or admins/i.test(msg)) return 'Only the institute’s owner or admins can do this.';
  if (/already waiting/i.test(msg)) return 'Your request is already waiting for the institute.';
  if (/already a teacher/i.test(msg)) return 'You are already a teacher of this institute.';
  if (/No institute found/i.test(msg)) return 'No institute has this code. Check it with the institute.';
  if (/not in the institute/i.test(msg)) return 'That teacher is no longer in the institute.';
  if (/up to 20 subjects/i.test(msg)) return `A section can have up to ${INSTITUTE_LIMITS.subjectsPerSection} subjects.`;
  if (/up to 200 sections/i.test(msg)) return `An institute can have up to ${INSTITUTE_LIMITS.sectionsPerInstitute} sections.`;
  return msg.replace(/^(Institute|Section|Batch): /, '') || 'Something went wrong. Please try again.';
}
