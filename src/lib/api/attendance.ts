// Attendance for the teacher, from the phone's copy. Every change is saved on
// the phone and uploaded by sync (works in a classroom with no signal):
// - the class day:    batch_months.sessions["DD"] = { held, extra?, time?, note? } | null
// - each exception:   enrolment_months.att["DD"]  = "A" | "L" | null (present)
// The server checks the dates (no marks for future days) and keeps each day's
// own edit time, so two phones editing different days or students never clash.
import { useLocalStore } from '../local/store';
import type { Batch, BatchMonth, Enrolment, EnrolmentMonth, Session } from '../local/types';
import { saveEdits } from '../sync/engine';
import { attendanceStart, ClassDay, classDayOf, dayOfMonth, Mark, markOf, monthOf, scheduledTime } from '../utils/attendance';
import { studentName } from './privateBatches';

/** The server keeps a class's time in up to 20 characters and a note in up to 80. */
export const SESSION_TIME_MAX = 20;
export const SESSION_NOTE_MAX = 80;

export const CANCEL_REASONS = ['Holiday', 'Teacher on leave', 'Exams', 'Bad weather', 'Other'];

const NO_BATCH_MONTHS: Record<string, BatchMonth> = {};

/** A batch's class days, month → row (with this phone's unsent edits). */
export function useBatchMonths(batchId: string | undefined): Record<string, BatchMonth> {
  return useLocalStore((s) => (batchId ? s.batchMonths[batchId] ?? NO_BATCH_MONTHS : NO_BATCH_MONTHS));
}

/** Every student month on the phone: enrolment id → month → row. */
export function useStudentMonths(): Record<string, Record<string, EnrolmentMonth>> {
  return useLocalStore((s) => s.months);
}

/** When a student's attendance starts counting (the day they were approved). */
export function startOf(r: Enrolment): string | null {
  return attendanceStart(r.joined_month, r.decided_at);
}

/**
 * Who is on the register for a day: students in the batch from the day they
 * joined, plus anyone who left later but has a mark that day (history stays).
 * Sorted by name.
 */
export function rosterForDay(
  roster: Enrolment[],
  months: Record<string, Record<string, EnrolmentMonth>>,
  iso: string,
): Enrolment[] {
  const month = monthOf(iso);
  return roster
    .filter((r) => {
      const start = startOf(r);
      if (r.status === 'approved' && start && start <= iso) return true;
      return r.joined_month != null && markOf(months[r.id]?.[month], iso) !== 'P';
    })
    .sort((a, b) => studentName(a).localeCompare(studentName(b)));
}

export interface DayStatus {
  day: ClassDay | null;
  /** Present or late (held days only). */
  came: number;
  /** Students on the register that day. */
  total: number;
}

/** A batch's class on a date and how many came (for the batch page and Home). */
export function dayStatus(
  batch: Batch,
  batchMonths: Record<string, BatchMonth>,
  roster: Enrolment[],
  months: Record<string, Record<string, EnrolmentMonth>>,
  iso: string,
  today: string,
): DayStatus {
  const day = classDayOf(iso, batch.weekly_schedule, batchMonths[monthOf(iso)]?.sessions, today, {
    start: batch.course_start,
    end: batch.course_end,
  });
  if (day?.state !== 'held') return { day, came: 0, total: 0 };
  const onDay = rosterForDay(roster, months, iso);
  const came = onDay.filter((r) => markOf(months[r.id]?.[monthOf(iso)], iso) !== 'A').length;
  return { day, came, total: onDay.length };
}

/** The timetable's time for that date when it fits the server's limit. */
function timetableTime(batch: Batch, iso: string): string | undefined {
  const t = scheduledTime(batch.weekly_schedule, iso);
  return t && t.length <= SESSION_TIME_MAX ? t : undefined;
}

function sessionEdit(batchId: string, iso: string, session: Session | null) {
  return {
    t: 'batch_months' as const,
    b: batchId,
    m: monthOf(iso),
    patch: { sessions: { [dayOfMonth(iso)]: session } },
  };
}

function markEdit(batchId: string, enrolmentId: string, iso: string, mark: Mark) {
  return {
    t: 'enrolment_months' as const,
    b: batchId,
    e: enrolmentId,
    m: monthOf(iso),
    patch: { att: { [dayOfMonth(iso)]: mark === 'P' ? null : mark } },
  };
}

/** The class took place (everyone present until marked otherwise). Keeps the time with the record. */
export function markHeld(batch: Batch, iso: string): Promise<void> {
  const time = timetableTime(batch, iso);
  return saveEdits([sessionEdit(batch.id, iso, time ? { held: true, time } : { held: true })]);
}

/** A class on a day that isn't on the timetable. */
export function addExtraClass(batch: Batch, iso: string, time: string): Promise<void> {
  const t = time.trim().slice(0, SESSION_TIME_MAX);
  return saveEdits([sessionEdit(batch.id, iso, t ? { held: true, extra: true, time: t } : { held: true, extra: true })]);
}

/** No class that day; marks already given for it are cleared. */
export function markCancelled(batch: Batch, iso: string, note: string, marked: string[]): Promise<void> {
  const n = note.trim().slice(0, SESSION_NOTE_MAX);
  const time = timetableTime(batch, iso);
  const session: Session = { held: false, ...(time ? { time } : {}), ...(n ? { note: n } : {}) };
  return saveEdits([sessionEdit(batch.id, iso, session), ...marked.map((e) => markEdit(batch.id, e, iso, 'P'))]);
}

/** Back to "not marked" (or removes an extra class), with its marks. */
export function clearDay(batch: Batch, iso: string, marked: string[]): Promise<void> {
  return saveEdits([sessionEdit(batch.id, iso, null), ...marked.map((e) => markEdit(batch.id, e, iso, 'P'))]);
}

export function setMark(batchId: string, enrolmentId: string, iso: string, mark: Mark): Promise<void> {
  return saveEdits([markEdit(batchId, enrolmentId, iso, mark)]);
}

/** Everyone present: clears the day's absent and late marks in one go. */
export function markAllPresent(batchId: string, iso: string, marked: string[]): Promise<void> {
  return saveEdits(marked.map((e) => markEdit(batchId, e, iso, 'P')));
}

export function describeAttendanceError(err: unknown): string {
  const msg = String((err as Error)?.message ?? '');
  return msg || 'Couldn’t save. Please try again.';
}
