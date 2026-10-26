// Per-student fee ledger for a private batch (public.batch_fees). One row per
// recorded month (paid or waived); a missing month is due or upcoming. Only
// the batch's teacher can write; the database checks the course range.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { currentMonth, monthsBetween } from '../utils/months';

export type FeeStatus = 'paid' | 'waived';
export type PayMode = 'cash' | 'upi' | 'bank' | 'other';

export interface FeeRow {
  id: string;
  membership_id: string;
  month: string;
  status: FeeStatus;
  amount: number;
  paid_on: string | null;
  mode: PayMode | null;
  note: string;
}

export const PAY_MODES: { value: PayMode; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank', label: 'Bank' },
  { value: 'other', label: 'Other' },
];

export type LedgerState = 'paid' | 'waived' | 'due' | 'upcoming';

export interface LedgerMonth {
  month: string;
  state: LedgerState;
  row: FeeRow | null;
}

/** Course months with their state, plus totals for the summary card. */
export function buildLedger(start: string, end: string, rows: FeeRow[], monthlyFee: number) {
  const now = currentMonth();
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const months: LedgerMonth[] = monthsBetween(start, end).map((m) => {
    const row = byMonth.get(m) ?? null;
    const state: LedgerState = row ? row.status : m <= now ? 'due' : 'upcoming';
    return { month: m, state, row };
  });
  const paid = months.reduce((s, m) => s + (m.state === 'paid' ? m.row!.amount : 0), 0);
  const dueMonths = months.filter((m) => m.state === 'due').length;
  return {
    months,
    totalCourse: months.length * monthlyFee,
    paid,
    waivedMonths: months.filter((m) => m.state === 'waived').length,
    dueMonths,
    dueAmount: dueMonths * monthlyFee,
  };
}

const key = (membershipId: string) => ['batch-fees', membershipId] as const;

export function useMemberFees(membershipId: string | undefined) {
  return useQuery({
    queryKey: key(membershipId ?? ''),
    enabled: Boolean(membershipId),
    queryFn: async (): Promise<FeeRow[]> => {
      const { data, error } = await supabase.from('batch_fees').select('*').eq('membership_id', membershipId!).order('month');
      if (error) throw error;
      return (data ?? []) as FeeRow[];
    },
  });
}

export function useRecordFee(membershipId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Pick<FeeRow, 'month' | 'status' | 'amount' | 'paid_on' | 'mode' | 'note'>) => {
      const { error } = await supabase
        .from('batch_fees')
        .upsert({ membership_id: membershipId, ...input }, { onConflict: 'membership_id,month' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(membershipId) }),
  });
}

export function useUndoFee(membershipId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (month: string) => {
      const { error } = await supabase.from('batch_fees').delete().eq('membership_id', membershipId).eq('month', month);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(membershipId) }),
  });
}

export function describeFeeError(err: unknown): string {
  const msg = String((err as Error)?.message ?? '');
  if (/outside the course/i.test(msg)) return 'That month is outside the course.';
  if (/course duration/i.test(msg)) return 'Set the course duration for this batch first (Edit batch).';
  if (/approved students/i.test(msg)) return 'Accept the student into the batch first.';
  if (/network|fetch/i.test(msg)) return 'No connection. Check your internet and try again.';
  return msg || 'Something went wrong. Please try again.';
}
