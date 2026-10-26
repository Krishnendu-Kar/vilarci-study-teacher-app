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
  grade: string;
  board: string;
  room: string;
  weekly_schedule: WeeklySchedule;
  monthly_fee: number;
  capacity: number;
  join_code: string;
  created_at: string;
  updated_at: string;
}

export type BatchInput = Pick<
  PrivateBatchRow,
  'name' | 'subject' | 'grade' | 'board' | 'room' | 'weekly_schedule' | 'monthly_fee' | 'capacity'
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
  if (/capacity/i.test(msg)) return `Seats must be between ${BATCH_LIMITS.capacityMin} and ${BATCH_LIMITS.capacityMax}.`;
  if (/monthly_fee/i.test(msg)) return 'Enter a valid monthly fee.';
  if (/name_check|name/i.test(msg)) return `Batch name must be ${BATCH_LIMITS.nameMin}–${BATCH_LIMITS.nameMax} characters.`;
  if (/network|fetch/i.test(msg)) return 'No connection. Check your internet and try again.';
  return msg || 'Something went wrong. Please try again.';
}
