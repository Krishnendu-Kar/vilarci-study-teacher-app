// A teacher's batches and their students, read from the phone's copy
// (lib/local). Edits to a batch's details go through the outbox and work
// offline; creating, deleting, and deciding who's in are online actions on
// the server (it makes the join code and checks seats), then a sync.
import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { supabase } from '../supabase';
import { useLocalStore } from '../local/store';
import type { Batch, BatchFields, BatchKind, Enrolment, EnrolmentStatus } from '../local/types';
import { requestSync, saveEdit } from '../sync/engine';

export type PrivateBatchRow = Batch;

/** What the batch form saves. Fee in paise, course months 'YYYY-MM'. */
export type BatchInput = Required<
  Pick<
    BatchFields,
    'name' | 'subject' | 'grade' | 'board' | 'room' | 'weekly_schedule' | 'monthly_fee' | 'capacity' | 'course_start' | 'course_end'
  >
>;

export const BATCH_LIMITS = {
  nameMin: 3,
  nameMax: 60,
  roomMax: 60,
  /** Rupees (the form's unit); stored ×100 as paise. */
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

export const EMPTY_SCHEDULE: Batch['weekly_schedule'] = {
  mon: 'Closed',
  tue: 'Closed',
  wed: 'Closed',
  thu: 'Closed',
  fri: 'Closed',
  sat: 'Closed',
  sun: 'Closed',
};

/** The phone's copy hasn't come from the server yet (a new phone, before the first sync). */
function useLoading(): boolean {
  return useLocalStore((s) => !s.ready || !s.account);
}

/** private, section or subject (rows from before institutes are private). */
export function batchKind(b: Pick<Batch, 'kind'> | undefined): BatchKind {
  return b?.kind ?? 'private';
}

/**
 * The classes this account takes itself (not deleted), newest first: its own
 * batches and the institute subjects it teaches. Institute sections and other
 * teachers' subjects (which admins also run) live under Institutes.
 */
export function usePrivateBatches(): { data: Batch[]; isLoading: boolean } {
  const isLoading = useLoading();
  const teaching = useLocalStore((s) => s.account?.teaching);
  const myId = useLocalStore((s) => s.account?.me?.id);
  const batches = useLocalStore((s) => s.batches);
  const data = useMemo(
    () =>
      (teaching ?? [])
        .filter((t) => t.deleted_at == null && batches[t.batch_id])
        .map((t) => batches[t.batch_id])
        .filter((b) => batchKind(b) === 'private' || (batchKind(b) === 'subject' && b.teacher_id === myId))
        .sort((a, b) => b.created_at - a.created_at),
    [teaching, batches, myId],
  );
  return { data, isLoading };
}

/** How this account stands on a batch: 'owner' runs it, 'subject' teaches it (institute subject teacher), null = not staff. */
export function useBatchRole(id: string | undefined): string | null {
  return useLocalStore((s) => (id ? s.account?.teaching.find((t) => t.batch_id === id)?.role ?? null : null));
}

export interface DeletedBatch {
  id: string;
  name: string;
  /** When it was deleted (ms). */
  deleted_at: number;
  /** The phone's last copy of it, when there is one. */
  batch: Batch | undefined;
}

/** Batches this account deleted (they can be restored), most recently deleted first. */
export function useDeletedBatches(): DeletedBatch[] {
  const teaching = useLocalStore((s) => s.account?.teaching);
  const batches = useLocalStore((s) => s.batches);
  return useMemo(
    () =>
      (teaching ?? [])
        .filter((t) => t.deleted_at != null && t.role === 'owner' && (t.kind ?? 'private') === 'private')
        .map((t) => ({ id: t.batch_id, name: t.name, deleted_at: t.deleted_at as number, batch: batches[t.batch_id] }))
        .sort((a, b) => b.deleted_at - a.deleted_at),
    [teaching, batches],
  );
}

/** Undo a delete (online): the batch, its students and their history come back. */
export function useRestoreBatch() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('batch_restore', { p_batch_id: id });
      if (error) throw error;
      await requestSync();
    },
  });
}

export function describeRestoreError(err: unknown): string {
  const msg = String((err as Error)?.message ?? '');
  if (/at most 50 batches/i.test(msg)) return `You already have ${BATCH_LIMITS.perTeacher} batches. Delete one before restoring another.`;
  if (/network|fetch|timed? ?out/i.test(msg)) return 'No connection. Restoring a batch needs the internet.';
  return msg || 'Something went wrong. Please try again.';
}

/** One batch. */
export function usePrivateBatch(id: string | undefined): { data: Batch | undefined; isLoading: boolean } {
  const isLoading = useLoading();
  const data = useLocalStore((s) => (id ? s.batches[id] : undefined));
  return { data, isLoading };
}

/** Creates (online: the server makes the join code) or edits (saved on the phone, uploaded by sync). */
export function useSaveBatch() {
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: BatchInput }): Promise<string> => {
      if (id) {
        await saveEdit({ t: 'batches', b: id, data: input });
        return id;
      }
      const newId = Crypto.randomUUID();
      const { error } = await supabase.rpc('batch_create', { p_id: newId, p_data: input });
      if (error) throw error;
      await requestSync();
      return newId;
    },
  });
}

export function useDeleteBatch() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('batch_delete', { p_batch_id: id });
      if (error) throw error;
      await requestSync();
    },
  });
}

/** A new join code (online): the old link, QR and code stop working. */
export function useResetJoinCode() {
  return useMutation({
    mutationFn: async (id: string): Promise<string> => {
      const { data, error } = await supabase.rpc('batch_reset_code', { p_batch_id: id });
      if (error) throw error;
      await requestSync();
      return (data as { join_code: string }).join_code;
    },
  });
}

export function describeBatchError(err: unknown): string {
  const msg = String((err as Error)?.message ?? '');
  if (/at most 50 batches/i.test(msg)) return `You can have up to ${BATCH_LIMITS.perTeacher} batches.`;
  if (/teacher profile/i.test(msg)) return 'Create your teacher profile first.';
  if (/network|fetch|timed? ?out/i.test(msg)) return 'No connection. Creating a batch needs the internet.';
  return msg.replace(/^Batch: /, '') || 'Something went wrong. Please try again.';
}

// ── students (public.enrolments, the teacher's roster) ─────────────────────

export type MemberStatus = EnrolmentStatus;
export type RosterRow = Enrolment;

const NO_ROWS: Enrolment[] = [];

/** Everyone who is in, or asked to join, a batch (oldest request first). */
export function useBatchRoster(batchId: string | undefined): { data: Enrolment[]; isLoading: boolean } {
  const isLoading = useLoading();
  const data = useLocalStore((s) => (batchId ? s.enrolments[batchId] ?? NO_ROWS : NO_ROWS));
  return { data, isLoading };
}

/** Approved and pending counts per batch, for list cards and badges. */
export function useBatchCounts(): Record<string, { approved: number; pending: number }> {
  const enrolments = useLocalStore((s) => s.enrolments);
  return useMemo(() => {
    const counts: Record<string, { approved: number; pending: number }> = {};
    for (const [batchId, rows] of Object.entries(enrolments)) {
      counts[batchId] = {
        approved: rows.filter((r) => r.status === 'approved').length,
        pending: rows.filter((r) => r.status === 'pending').length,
      };
    }
    return counts;
  }, [enrolments]);
}

export function useDecideRequest() {
  return useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc('join_decide', { p_enrolment_id: id, p_approve: approve });
      if (error) throw error;
      await requestSync();
    },
  });
}

export function useRemoveMember() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('enrolment_remove', { p_enrolment_id: id });
      if (error) throw error;
      await requestSync();
    },
  });
}

/**
 * A student's own monthly fee (sibling discount, scholarship…) in paise, or
 * null to go back to the batch fee. Online: the parent's ledger follows on
 * their next sync. Months already paid keep what was recorded.
 */
export function useSetStudentFee() {
  return useMutation({
    mutationFn: async ({ id, fee }: { id: string; fee: number | null }) => {
      const { error } = await supabase.rpc('enrolment_set_fee', { p_enrolment_id: id, p_fee: fee });
      if (error) throw error;
      await requestSync();
    },
  });
}

export function describeMemberError(err: unknown): string {
  const msg = String((err as Error)?.message ?? '');
  if (/batch is full/i.test(msg)) return 'This batch is full. Increase seats in Edit to accept more students.';
  if (/network|fetch|timed? ?out/i.test(msg)) return 'No connection. This needs the internet.';
  return msg || 'Something went wrong. Please try again.';
}

/** "Class 10 · CBSE", "Class 10", "CBSE" or null when neither is set. */
export function gradeBoardLabel(b: Pick<Batch, 'grade' | 'board'>): string | null {
  return [b.grade, b.board].filter(Boolean).join(' · ') || null;
}

/** "Aarav Kumar Sen" */
export function studentName(r: Enrolment): string {
  const c = r.student_card;
  return [c.first_name, c.middle_name, c.last_name].filter((s) => s && s.trim()).join(' ');
}

/** What a student pays a month in this batch, in paise. */
export function feeFor(r: Pick<Enrolment, 'fee_override'>, b: Pick<Batch, 'monthly_fee'>): number {
  return r.fee_override ?? b.monthly_fee;
}
