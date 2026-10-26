// A teacher's private batches (public.private_batches). The server generates
// join_code and enforces every limit; RLS scopes rows to the signed-in teacher.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../AuthProvider';
import type { WeeklySchedule } from '../data/types';

export interface PrivateBatchRow {
  id: string;
  teacher_id: string;
  name: string;
  subject: string;
  /** Optional — music, art, yoga and play batches don't need a class or board. */
  grade: string | null;
  board: string | null;
  room: string;
  weekly_schedule: WeeklySchedule;
  monthly_fee: number;
  capacity: number;
  join_code: string;
  /** First day of the course's first and last month, e.g. "2026-04-01". */
  course_start: string | null;
  course_end: string | null;
  created_at: string;
  updated_at: string;
}

export type BatchInput = Pick<
  PrivateBatchRow,
  'name' | 'subject' | 'grade' | 'board' | 'room' | 'weekly_schedule' | 'monthly_fee' | 'capacity' | 'course_start' | 'course_end'
>;

export const BATCH_LIMITS = {
  nameMin: 3,
  nameMax: 60,
  roomMax: 60,
  feeMax: 1_000_000,
  capacityMin: 1,
  capacityMax: 500,
  perTeacher: 50,
};

/** Academic and non-academic subjects a private batch can teach. */
export const BATCH_SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'Computer Science',
  'Social Science',
  'Hindi',
  'Bengali',
  'Accountancy',
  'Economics',
  'Spoken English',
  'Coding',
  'Abacus',
  'Chess',
  'Singing',
  'Music',
  'Drawing & Art',
  'Dance',
  'Yoga',
  'Sports & Play',
];

/** Base of the shareable join link — vilarci.in now, study.vilarci.in later. */
export const JOIN_LINK_BASE = (process.env.EXPO_PUBLIC_JOIN_LINK_BASE ?? 'https://vilarci.in/join/').replace(/\/?$/, '/');

export function joinLinkFor(code: string): string {
  return `${JOIN_LINK_BASE}${code}`;
}

export const GRADES = ['Nursery', 'KG', ...Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`), 'College'];
export const BOARDS = ['CBSE', 'ICSE', 'State Board', 'IB', 'Other'];

export const EMPTY_SCHEDULE: WeeklySchedule = {
  mon: 'Closed',
  tue: 'Closed',
  wed: 'Closed',
  thu: 'Closed',
  fri: 'Closed',
  sat: 'Closed',
  sun: 'Closed',
};

const listKey = (teacherId: string | undefined) => ['private-batches', teacherId] as const;

export function usePrivateBatches() {
  const { session } = useAuth();
  const teacherId = session?.user.id;
  return useQuery({
    queryKey: listKey(teacherId),
    enabled: Boolean(teacherId),
    queryFn: async (): Promise<PrivateBatchRow[]> => {
      const { data, error } = await supabase
        .from('private_batches')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PrivateBatchRow[];
    },
  });
}

/** One batch, served from the list cache. */
export function usePrivateBatch(id: string | undefined) {
  const list = usePrivateBatches();
  return { ...list, data: list.data?.find((b) => b.id === id) };
}

export function useSaveBatch() {
  const { session } = useAuth();
  const teacherId = session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: BatchInput }): Promise<string> => {
      if (!teacherId) throw new Error('Please log in again.');
      if (id) {
        const { error } = await supabase.from('private_batches').update(input).eq('id', id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from('private_batches')
        .insert({ ...input, teacher_id: teacherId })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey(teacherId) }),
  });
}

export function useDeleteBatch() {
  const { session } = useAuth();
  const teacherId = session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('private_batches').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey(teacherId) }),
  });
}

export function describeBatchError(err: unknown): string {
  const msg = String((err as Error)?.message ?? '');
  if (/at most 50 private batches/i.test(msg)) return `You can have up to ${BATCH_LIMITS.perTeacher} private batches.`;
  if (/foreign key|teachers/i.test(msg)) return 'Create your teacher profile first.';
  if (/weekly_schedule/i.test(msg)) return 'Check the weekly timings and try again.';
  if (/course_check/i.test(msg)) return 'The course must end on or after it starts, within 36 months.';
  if (/capacity/i.test(msg)) return `Seats must be between ${BATCH_LIMITS.capacityMin} and ${BATCH_LIMITS.capacityMax}.`;
  if (/monthly_fee/i.test(msg)) return 'Enter a valid monthly fee.';
  if (/name_check|name/i.test(msg)) return `Batch name must be ${BATCH_LIMITS.nameMin}–${BATCH_LIMITS.nameMax} characters.`;
  if (/network|fetch/i.test(msg)) return 'No connection. Check your internet and try again.';
  return msg || 'Something went wrong. Please try again.';
}

// ── members (public.batch_students) ─────────────────────────────────────────

export type MemberStatus = 'pending' | 'approved' | 'declined';

export interface RosterRow {
  id: string;
  student_id: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  class_name: string | null;
  relation: string;
  relation_other: string | null;
  status: MemberStatus;
  requested_at: string;
  decided_at: string | null;
  account_name: string;
  /** Only returned once the request is approved. */
  account_whatsapp: string | null;
}

const rosterKey = (batchId: string | undefined) => ['batch-roster', batchId] as const;
const countsKey = (teacherId: string | undefined) => ['batch-counts', teacherId] as const;

export function useBatchRoster(batchId: string | undefined) {
  return useQuery({
    queryKey: rosterKey(batchId),
    enabled: Boolean(batchId),
    queryFn: async (): Promise<RosterRow[]> => {
      const { data, error } = await supabase.rpc('batch_roster', { p_batch_id: batchId });
      if (error) throw error;
      return (data ?? []) as RosterRow[];
    },
  });
}

/** Approved and pending counts per batch, for list cards and badges. */
export function useBatchCounts() {
  const { session } = useAuth();
  const teacherId = session?.user.id;
  return useQuery({
    queryKey: countsKey(teacherId),
    enabled: Boolean(teacherId),
    queryFn: async (): Promise<Record<string, { approved: number; pending: number }>> => {
      const { data, error } = await supabase.from('batch_students').select('batch_id, status');
      if (error) throw error;
      const counts: Record<string, { approved: number; pending: number }> = {};
      for (const row of (data ?? []) as { batch_id: string; status: MemberStatus }[]) {
        const c = (counts[row.batch_id] ??= { approved: 0, pending: 0 });
        if (row.status === 'approved') c.approved += 1;
        if (row.status === 'pending') c.pending += 1;
      }
      return counts;
    },
  });
}

function useInvalidateMembers() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return (batchId: string) => {
    queryClient.invalidateQueries({ queryKey: rosterKey(batchId) });
    queryClient.invalidateQueries({ queryKey: countsKey(session?.user.id) });
  };
}

export function useDecideRequest(batchId: string) {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc('decide_join_request', { p_id: id, p_approve: approve });
      if (error) throw error;
    },
    onSuccess: () => invalidate(batchId),
  });
}

export function useRemoveMember(batchId: string) {
  const invalidate = useInvalidateMembers();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('batch_students').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(batchId),
  });
}

export function describeMemberError(err: unknown): string {
  const msg = String((err as Error)?.message ?? '');
  if (/batch is full/i.test(msg)) return 'This batch is full. Increase seats in Edit to accept more students.';
  if (/network|fetch/i.test(msg)) return 'No connection. Check your internet and try again.';
  return msg || 'Something went wrong. Please try again.';
}

/** "Class 10 · CBSE", "Class 10", "CBSE" or null when neither is set. */
export function gradeBoardLabel(b: Pick<PrivateBatchRow, 'grade' | 'board'>): string | null {
  return [b.grade, b.board].filter(Boolean).join(' · ') || null;
}
