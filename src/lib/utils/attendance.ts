// Attendance, worked out on the phone (new-db-plan.md §6). This file is the
// same in the student and teacher apps — keep the two copies in step.
//
// The teacher records each class day once (batch_months.sessions, day "DD" →
// { held, extra?, time?, note? }) and only the exceptions per student
// (enrolment_months.att, day "DD" → "A" absent | "L" late). A held class with
// no mark is present. Late counts as present (attended).
import type { BatchMonth, EnrolmentMonth, Session, WeekSchedule } from '../local/types';

/** Present, late or absent on a held class. */
export type Mark = 'P' | 'L' | 'A';

/**
 * held — the teacher marked the class as held (attendance counts);
 * cancelled — the teacher marked it cancelled (holiday, leave…);
 * unmarked — on the timetable, today or earlier, nothing recorded yet;
 * upcoming — on the timetable, after today, nothing recorded.
 */
export type DayState = 'held' | 'cancelled' | 'unmarked' | 'upcoming';

export interface ClassDay {
  /** 'YYYY-MM-DD' */
  date: string;
  state: DayState;
  /** "05:00 PM - 06:30 PM": the time kept with the record, else the timetable's. */
  time: string | null;
  /** Added on a day that isn't on the weekly timetable. */
  extra: boolean;
  /** Why it was cancelled, etc. */
  note: string | null;
  /** On the weekly timetable (and inside the course months). */
  scheduled: boolean;
}

export interface Tally {
  /** Held classes that count for this student. */
  held: number;
  /** On time. */
  present: number;
  late: number;
  absent: number;
  /** Present + late. */
  attended: number;
  /** attended / held, rounded; null when no class has been held yet. */
  percent: number | null;
}

/** Below this, attendance is shown as a concern. */
export const LOW_ATTENDANCE = 75;

export const MARK_LABEL: Record<Mark, string> = { P: 'Present', L: 'Late', A: 'Absent' };

type DayKey = keyof WeekSchedule;
const DAY_BY_JS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── dates ('YYYY-MM-DD', local time) ──────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localToday(): string {
  return isoDate(new Date());
}

/** 'YYYY-MM-DD' → local Date (no UTC shift). */
export function dateOf(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = dateOf(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

/** '2026-11-24' → '2026-11' */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/** '2026-11-24' → '24' (the key the server uses inside a month). */
export function dayOfMonth(iso: string): string {
  return iso.slice(8, 10);
}

/** Every date of a month, in order. */
export function datesOfMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return Array.from({ length: last }, (_, i) => `${month}-${pad(i + 1)}`);
}

/** 'Tue, 24 Nov' (or 'Tuesday, 24 Nov 2026' with long). */
export function classDateLabel(iso: string, long = false): string {
  const d = dateOf(iso);
  return long
    ? `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
    : `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function weekdayShort(iso: string): string {
  return WEEKDAYS[dateOf(iso).getDay()];
}

/** "05:00 PM - 06:30 PM" → "05:00 PM – 06:30 PM" for display. */
export function prettyTime(time: string | null | undefined): string {
  return time ? time.replace(/\s*-\s*/, ' – ') : '';
}

/** "05:00 PM - 06:30 PM" (or "17:00-18:30") → minutes since midnight of the start; unknown sorts last. */
export function clockStart(time: string | null | undefined): number {
  const m = time?.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return 24 * 60;
  let h = Number(m[1]);
  if (m[3]) h = (h % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0);
  return h * 60 + Number(m[2]);
}

// ── class days ────────────────────────────────────────────────────────────

/** The weekly timetable's time for that date, or null when it's a closed day. */
export function scheduledTime(schedule: WeekSchedule | null | undefined, iso: string): string | null {
  const v = schedule?.[DAY_BY_JS[dateOf(iso).getDay()]]?.trim();
  return !v || v.toLowerCase() === 'closed' ? null : v;
}

export interface CourseRange {
  start: string | null;
  end: string | null;
}

function inCourse(iso: string, course?: CourseRange): boolean {
  if (!course?.start || !course?.end) return true;
  const m = monthOf(iso);
  return m >= course.start && m <= course.end;
}

/** A day's class: the teacher's record if there is one, else the timetable. Null when there's no class. */
export function classDayOf(
  iso: string,
  schedule: WeekSchedule | null | undefined,
  sessions: Record<string, Session> | undefined,
  today: string,
  course?: CourseRange,
): ClassDay | null {
  const time = scheduledTime(schedule, iso);
  const scheduled = Boolean(time) && inCourse(iso, course);
  const s = sessions?.[dayOfMonth(iso)];
  if (s) {
    return {
      date: iso,
      state: s.held ? 'held' : 'cancelled',
      time: s.time ?? time,
      extra: Boolean(s.extra),
      note: s.note ?? null,
      scheduled,
    };
  }
  if (!scheduled) return null;
  return { date: iso, state: iso <= today ? 'unmarked' : 'upcoming', time, extra: false, note: null, scheduled: true };
}

/** Every class day of a month — on the timetable or recorded by the teacher — in date order. */
export function classDaysOfMonth(
  month: string,
  schedule: WeekSchedule | null | undefined,
  row: BatchMonth | undefined,
  today: string,
  course?: CourseRange,
): ClassDay[] {
  const out: ClassDay[] = [];
  for (const iso of datesOfMonth(month)) {
    const day = classDayOf(iso, schedule, row?.sessions, today, course);
    if (day) out.push(day);
  }
  return out;
}

/** The nearest class day before (-1) or after (+1) a date, within two months; else the next calendar day. */
export function stepClassDay(
  iso: string,
  dir: 1 | -1,
  schedule: WeekSchedule | null | undefined,
  batchMonths: Record<string, BatchMonth> | undefined,
  today: string,
  course?: CourseRange,
): string {
  let d = iso;
  for (let i = 0; i < 62; i++) {
    d = addDays(d, dir);
    if (classDayOf(d, schedule, batchMonths?.[monthOf(d)]?.sessions, today, course)) return d;
  }
  return addDays(iso, dir);
}

// ── students ──────────────────────────────────────────────────────────────

/** A student's mark on a held class. */
export function markOf(row: EnrolmentMonth | undefined, iso: string): Mark {
  const v = row?.att?.[dayOfMonth(iso)];
  return v === 'A' ? 'A' : v === 'L' ? 'L' : 'P';
}

/**
 * The first day a student's attendance counts: the day they were approved
 * (so classes before they joined don't count as present), or the 1st of the
 * joining month when the latest decision came later (re-approved).
 */
export function attendanceStart(joinedMonth: string | null, decidedAt: number | null): string | null {
  if (!joinedMonth) return null;
  const first = `${joinedMonth}-01`;
  if (decidedAt == null) return first;
  const decided = isoDate(new Date(decidedAt));
  return monthOf(decided) === joinedMonth && decided > first ? decided : first;
}

export function percentOf(attended: number, held: number): number | null {
  return held ? Math.round((attended / held) * 100) : null;
}

export const EMPTY_TALLY: Tally = { held: 0, present: 0, late: 0, absent: 0, attended: 0, percent: null };

/**
 * A student's attendance: held classes from `start` to `until` (inclusive),
 * optionally inside one month only.
 */
export function tally(
  batchMonths: Record<string, BatchMonth> | undefined,
  months: Record<string, EnrolmentMonth> | undefined,
  start: string | null,
  until: string,
  onlyMonth?: string,
): Tally {
  if (!start || !batchMonths) return EMPTY_TALLY;
  let held = 0;
  let late = 0;
  let absent = 0;
  for (const [month, row] of Object.entries(batchMonths)) {
    if (onlyMonth ? month !== onlyMonth : month < monthOf(start) || month > monthOf(until)) continue;
    for (const [dd, s] of Object.entries(row.sessions ?? {})) {
      if (!s?.held) continue;
      const iso = `${month}-${dd}`;
      if (iso < start || iso > until) continue;
      held += 1;
      const mark = markOf(months?.[month], iso);
      if (mark === 'A') absent += 1;
      else if (mark === 'L') late += 1;
    }
  }
  const attended = held - absent;
  return { held, present: attended - late, late, absent, attended, percent: percentOf(attended, held) };
}

/** "92%" or "—" */
export function percentLabel(p: number | null): string {
  return p == null ? '—' : `${p}%`;
}
