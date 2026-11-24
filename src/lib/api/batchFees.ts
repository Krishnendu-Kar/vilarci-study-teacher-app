// Per-student fee ledger for a batch: the `fee` of each of the student's
// months (public.enrolment_months, from the phone's copy). A month without one
// is due (started) or upcoming. Recording a payment is saved on the phone and
// uploaded by sync, so it works in class with no signal; the server checks the
// course range and dates again.
import { useLocalStore } from '../local/store';
import type { EnrolmentMonth, FeeMode, MonthFee } from '../local/types';
import { saveEdit } from '../sync/engine';
import { currentMonth, monthsBetween } from '../utils/months';
import { todayIso } from '../utils/format';

export type FeeStatus = MonthFee['status'];
export type PayMode = FeeMode;

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
  fee: MonthFee | null;
}

/** Course months with their state, plus totals for the summary card. Money in paise. */
export function buildLedger(start: string, end: string, months: Record<string, EnrolmentMonth>, monthlyFee: number) {
  const now = currentMonth();
  const list: LedgerMonth[] = monthsBetween(start, end).map((m) => {
    const fee = months[m]?.fee ?? null;
    const state: LedgerState = fee ? fee.status : m <= now ? 'due' : 'upcoming';
    return { month: m, state, fee };
  });
  const paid = list.reduce((s, m) => s + (m.state === 'paid' ? m.fee!.amount : 0), 0);
  const dueMonths = list.filter((m) => m.state === 'due').length;
  return {
    months: list,
    totalCourse: list.length * monthlyFee,
    paid,
    waivedMonths: list.filter((m) => m.state === 'waived').length,
    dueMonths,
    dueAmount: dueMonths * monthlyFee,
  };
}

const NO_MONTHS: Record<string, EnrolmentMonth> = {};

/** One student's months in a batch (month → row). */
export function useEnrolmentMonths(enrolmentId: string | undefined): Record<string, EnrolmentMonth> {
  return useLocalStore((s) => (enrolmentId ? s.months[enrolmentId] ?? NO_MONTHS : NO_MONTHS));
}

/** Record (or change) a month's fee; null puts it back to due. */
export async function setMonthFee(batchId: string, enrolmentId: string, month: string, fee: MonthFee | null): Promise<void> {
  if (fee?.status === 'paid' && fee.paid_on && fee.paid_on > todayIso()) {
    throw new Error('The paid-on date can’t be in the future.');
  }
  await saveEdit({ t: 'enrolment_months', b: batchId, e: enrolmentId, m: month, patch: { fee } });
}

export function describeFeeError(err: unknown): string {
  const msg = String((err as Error)?.message ?? '');
  return msg || 'Something went wrong. Please try again.';
}
