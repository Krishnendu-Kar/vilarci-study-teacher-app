// Pure relational selectors over the teacher portal store. This is the ONLY
// module that knows how records relate — swapping the local store for Supabase
// means rewriting the bodies here, never the screens.
import type {
  AttendanceSession,
  AttendanceStatus,
  BatchTest,
  ClassException,
  DayKey,
  Homework,
  HomeworkStatus,
  CoachingInstitute,
  CoachingSection,
  FeeLedgerEntry,
  InstituteMember,
  InstitutePermissions,
  PointsDispatch,
  PrivateBatch,
  Student,
  SyllabusTopic,
  Teacher,
  TeacherPortalData,
  WeeklySchedule,
} from '../data/types';
import type { DeckRef } from '../store/useAppStore';
import { daysBetween, formatDateShort, monthRange, shiftDate } from '../utils/format';
import {
  addMinutes,
  clockMinutes,
  DAY_KEYS,
  dayKeyOf,
  parseFacultySlot,
  parseRange,
  summarizeSchedule,
} from '../utils/schedule';

// ─── Teacher scope ────────────────────────────────────────────────────────────

export function teacherById(db: TeacherPortalData, id: string): Teacher | null {
  return db.teachers.find((t) => t.id === id) ?? null;
}

export function batchesFor(db: TeacherPortalData, teacherId: string): PrivateBatch[] {
  return db.private_batches.filter((b) => b.teacher_id === teacherId);
}

export function isMember(inst: CoachingInstitute, teacherId: string): boolean {
  return inst.owner_teacher_id === teacherId || inst.members.some((m) => m.teacher_id === teacherId);
}

export function institutesFor(db: TeacherPortalData, teacherId: string): CoachingInstitute[] {
  return db.coaching_institutes.filter((i) => isMember(i, teacherId));
}

export function isOwner(inst: CoachingInstitute, teacherId: string): boolean {
  return inst.owner_teacher_id === teacherId;
}

export function membershipOf(inst: CoachingInstitute, teacherId: string): InstituteMember | null {
  return inst.members.find((m) => m.teacher_id === teacherId) ?? null;
}

/** Owners and co-admins hold every permission; others get the institute defaults. */
export function can(inst: CoachingInstitute, teacherId: string, permission: keyof InstitutePermissions): boolean {
  if (isOwner(inst, teacherId)) return true;
  const member = membershipOf(inst, teacherId);
  if (!member) return false;
  if (member.permission_level === 'Co-Admin' || member.permission_level === 'Owner / Full Admin') return true;
  return inst.member_permissions[permission];
}

export function roleLabel(inst: CoachingInstitute, teacherId: string): string {
  if (isOwner(inst, teacherId)) return 'Director & Owner';
  return membershipOf(inst, teacherId)?.role ?? 'Faculty Member';
}

/** Sections where this teacher holds at least one subject slot. */
export function mySections(inst: CoachingInstitute, teacherId: string): CoachingSection[] {
  return inst.classes_sections.filter((s) => s.subject_faculty_map.some((f) => f.teacher_id === teacherId));
}

// ─── The unified batch command deck ───────────────────────────────────────────

export interface Deck {
  ref: DeckRef;
  isPrivate: boolean;
  /** Full title used in audit trails, e.g. "Stellar Academy • Class 10-A". */
  title: string;
  /** Compact title for headers. */
  name: string;
  contextLabel: string;
  grade: string;
  board: string;
  /** The subject(s) this teacher teaches here. */
  subject: string;
  room: string;
  joinCode: string;
  inviteLink: string;
  monthlyFee: number;
  capacity: number;
  studentIds: string[];
  weeklySchedule: WeeklySchedule | null;
  /** This teacher's regular slot on each weekday, or null when there is no class. */
  slots: Record<DayKey, Slot | null>;
  scheduleText: string;
  color: string;
  institute: CoachingInstitute | null;
  section: CoachingSection | null;
  batch: PrivateBatch | null;
  canManageFees: boolean;
  canEditSettings: boolean;
}

export interface Slot {
  start: string;
  end: string;
}

function slotsFromSchedule(schedule: WeeklySchedule): Record<DayKey, Slot | null> {
  return Object.fromEntries(DAY_KEYS.map((d) => [d, parseRange(schedule[d])])) as Record<DayKey, Slot | null>;
}

/** Coaching faculty slots only carry a start time; lectures run an hour. */
function slotsFromFaculty(slots: { schedule: string }[]): Record<DayKey, Slot | null> {
  const out = Object.fromEntries(DAY_KEYS.map((d) => [d, null])) as Record<DayKey, Slot | null>;
  for (const f of slots) {
    const { days, time } = parseFacultySlot(f.schedule);
    if (!time) continue;
    for (const d of days) {
      if (!out[d] || clockMinutes(time) < clockMinutes(out[d]!.start)) out[d] = { start: time, end: addMinutes(time, 60) };
    }
  }
  return out;
}

export function resolveDeck(db: TeacherPortalData, ref: DeckRef, teacherId: string): Deck | null {
  if (ref.type === 'private_batch') {
    const batch = db.private_batches.find((b) => b.id === ref.id);
    // A private batch is visible only to the tutor who runs it.
    if (!batch || batch.teacher_id !== teacherId) return null;
    return {
      ref,
      isPrivate: true,
      title: batch.name,
      name: batch.name,
      contextLabel: 'Private tuition batch',
      grade: batch.grade,
      board: batch.board,
      subject: batch.subject,
      room: batch.room,
      joinCode: batch.join_code,
      inviteLink: inviteLinkFor(batch.id, batch.join_code),
      monthlyFee: batch.monthly_fee,
      capacity: batch.capacity,
      studentIds: batch.student_ids,
      weeklySchedule: batch.weekly_schedule,
      slots: slotsFromSchedule(batch.weekly_schedule),
      scheduleText: summarizeSchedule(batch.weekly_schedule),
      color: '#800020',
      institute: null,
      section: null,
      batch,
      canManageFees: batch.teacher_id === teacherId,
      canEditSettings: batch.teacher_id === teacherId,
    };
  }

  const inst = db.coaching_institutes.find((i) => i.id === ref.instituteId);
  const sec = inst?.classes_sections.find((s) => s.id === ref.id);
  if (!inst || !sec || !isMember(inst, teacherId)) return null;
  const mine = sec.subject_faculty_map.filter((f) => f.teacher_id === teacherId);
  const joinCode = `${inst.code}-${sec.section_name.replace(/[^a-zA-Z0-9]/g, '').slice(-3).toUpperCase()}`;
  return {
    ref,
    isPrivate: false,
    title: `${inst.name} • ${sec.full_code}`,
    name: sec.full_code,
    contextLabel: inst.name,
    grade: sec.class_name,
    board: sec.board,
    subject: mine.map((m) => m.subject).join(', ') || sec.subject_faculty_map[0]?.subject || 'General',
    room: sec.room,
    joinCode,
    inviteLink: inviteLinkFor(sec.id, joinCode),
    monthlyFee: 2500,
    capacity: sec.capacity,
    studentIds: sec.student_ids,
    weeklySchedule: sec.weekly_schedule ?? null,
    slots: sec.weekly_schedule ? slotsFromSchedule(sec.weekly_schedule) : slotsFromFaculty(mine),
    scheduleText: sec.weekly_schedule
      ? summarizeSchedule(sec.weekly_schedule)
      : mine.map((m) => `${m.subject}: ${m.schedule}`).join('  /  ') || 'Regular class hours',
    color: inst.theme_color,
    institute: inst,
    section: sec,
    batch: null,
    canManageFees: can(inst, teacherId, 'can_manage_fees'),
    canEditSettings: can(inst, teacherId, 'can_create_sections'),
  };
}

export function inviteLinkFor(contextId: string, code: string): string {
  return `https://study.vilarci.in/join?batch=${encodeURIComponent(contextId)}&code=${encodeURIComponent(code)}`;
}

export function studentsOf(db: TeacherPortalData, ids: string[]): Student[] {
  return ids.map((id) => db.students.find((s) => s.id === id)).filter((s): s is Student => Boolean(s));
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export function sessionsFor(db: TeacherPortalData, deckId: string): AttendanceSession[] {
  return db.attendance_sessions.filter((s) => s.context_id === deckId).sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Deck-level attendance rate. Late counts as half an attendance, matching the
 * partner portal. Falls back to the student's portal-wide rate until this deck
 * has sessions recorded for them.
 */
export function attendanceRate(student: Student, sessions: AttendanceSession[]): number {
  const marked = sessions.filter((s) => s.records[student.id]);
  if (!marked.length) return student.attendance_rate;
  const attended = marked.reduce((sum, s) => {
    const st = s.records[student.id];
    return sum + (st === 'present' ? 1 : st === 'late' ? 0.5 : 0);
  }, 0);
  return (attended / marked.length) * 100;
}

export interface DayCounts {
  present: number;
  late: number;
  absent: number;
}

export function countStatuses(records: Record<string, AttendanceStatus>, ids: string[]): DayCounts {
  const c: DayCounts = { present: 0, late: 0, absent: 0 };
  for (const id of ids) c[records[id] ?? 'present'] += 1;
  return c;
}

// ─── Fees (academic ledger, no receipts) ──────────────────────────────────────

export type LedgerState = 'paid' | 'pending' | 'overdue' | 'not_billed';

export interface LedgerCell {
  monthKey: string;
  state: LedgerState;
  amount: number;
  entry: FeeLedgerEntry | null;
}

export function isBillable(student: Student, monthKey: string): boolean {
  return monthKey >= student.admission_start_month && monthKey <= student.course_end_month;
}

export function ledgerCell(student: Student, monthKey: string, currentMonth: string): LedgerCell {
  const entry = student.fee_ledger[monthKey] ?? null;
  if (!isBillable(student, monthKey)) {
    return { monthKey, state: 'not_billed', amount: 0, entry };
  }
  if (entry?.status === 'paid') return { monthKey, state: 'paid', amount: entry.amount, entry };
  return {
    monthKey,
    state: monthKey < currentMonth ? 'overdue' : 'pending',
    amount: entry?.amount ?? student.custom_monthly_fee,
    entry,
  };
}

export function studentLedger(student: Student, currentMonth: string): LedgerCell[] {
  return monthRange(student.admission_start_month, student.course_end_month).map((k) =>
    ledgerCell(student, k, currentMonth),
  );
}

/** Unpaid billable months up to and including the current month. */
export function arrears(student: Student, currentMonth: string): LedgerCell[] {
  return studentLedger(student, currentMonth).filter(
    (c) => (c.state === 'pending' || c.state === 'overdue') && c.monthKey <= currentMonth,
  );
}

export interface FeeSummary {
  expected: number;
  collected: number;
  pending: number;
  billed: number;
  paidCount: number;
  rate: number;
}

export function monthFeeSummary(students: Student[], monthKey: string, currentMonth: string): FeeSummary {
  const cells = students.map((s) => ledgerCell(s, monthKey, currentMonth)).filter((c) => c.state !== 'not_billed');
  const expected = cells.reduce((sum, c) => sum + c.amount, 0);
  const collected = cells.filter((c) => c.state === 'paid').reduce((sum, c) => sum + c.amount, 0);
  return {
    expected,
    collected,
    pending: expected - collected,
    billed: cells.length,
    paidCount: cells.filter((c) => c.state === 'paid').length,
    rate: expected ? (collected / expected) * 100 : 100,
  };
}

/** Months worth offering in the fee month switcher for a roster. */
export function billingMonths(students: Student[]): string[] {
  if (!students.length) return [];
  const start = students.reduce((m, s) => (s.admission_start_month < m ? s.admission_start_month : m), '9999-99');
  const end = students.reduce((m, s) => (s.course_end_month > m ? s.course_end_month : m), '0000-00');
  return monthRange(start, end);
}

// ─── Tests & scorecards ───────────────────────────────────────────────────────

export function testsFor(db: TeacherPortalData, deckId: string): BatchTest[] {
  return db.tests.filter((t) => t.context_id === deckId).sort((a, b) => b.conducted_date.localeCompare(a.conducted_date));
}

/** CBSE nine-point style bands used on partner scorecards. */
export function cbseGrade(percent: number): string {
  if (percent >= 90) return 'A1';
  if (percent >= 80) return 'A2';
  if (percent >= 70) return 'B1';
  if (percent >= 60) return 'B2';
  if (percent >= 50) return 'C1';
  if (percent >= 33) return 'D';
  return 'E';
}

export interface ScoreRow {
  student: Student;
  marks: number | null;
  status: 'present' | 'absent' | 'pending';
  weak_topics: string;
  rank: number | null;
  percent: number | null;
}

export interface TestStats {
  graded: number;
  average: number;
  highest: number;
  lowest: number;
  passRate: number;
  passed: number;
  topper: string | null;
}

/** Ranks graded students by marks; absent and ungraded rows sink to the bottom. */
export function scorecard(test: BatchTest, roster: Student[]): { rows: ScoreRow[]; stats: TestStats } {
  const rows: ScoreRow[] = roster.map((student) => {
    const sub = test.submissions.find((s) => s.student_id === student.id);
    const marks = sub?.marks ?? null;
    const status = sub?.status ?? 'pending';
    return {
      student,
      marks,
      status,
      weak_topics: sub?.weak_topics ?? '',
      rank: null,
      percent: marks != null && status === 'present' ? (marks / test.max_marks) * 100 : null,
    };
  });

  const graded = rows.filter((r) => r.status === 'present' && r.marks != null);
  graded.sort((a, b) => (b.marks as number) - (a.marks as number));
  graded.forEach((r, i) => {
    // Equal marks share a rank.
    r.rank = i > 0 && graded[i - 1].marks === r.marks ? graded[i - 1].rank : i + 1;
  });
  const ungraded = rows.filter((r) => !graded.includes(r));
  const marks = graded.map((r) => r.marks as number);
  const passMark = test.max_marks * 0.33;
  const passed = marks.filter((m) => m >= passMark).length;

  return {
    rows: [...graded, ...ungraded],
    stats: {
      graded: graded.length,
      average: marks.length ? marks.reduce((a, b) => a + b, 0) / marks.length : 0,
      highest: marks.length ? Math.max(...marks) : 0,
      lowest: marks.length ? Math.min(...marks) : 0,
      passRate: marks.length ? (passed / marks.length) * 100 : 0,
      passed,
      topper: graded[0]?.student.name ?? null,
    },
  };
}

// ─── Curriculum (planned target vs reality) ───────────────────────────────────

export function topicsFor(db: TeacherPortalData, deckId: string): SyllabusTopic[] {
  return db.syllabus_topics
    .filter((t) => t.context_id === deckId)
    .sort((a, b) => a.chapter_number - b.chapter_number || a.planned_target_date.localeCompare(b.planned_target_date));
}

export type VarianceTone = 'success' | 'error' | 'warning' | 'neutral' | 'info';

export interface Variance {
  tone: VarianceTone;
  label: string;
  delayed: boolean;
}

/** Derived live from dates, so it never drifts from the topic's real state. */
export function topicVariance(t: SyllabusTopic, today: string): Variance {
  const target = formatDateShort(t.planned_target_date);
  if (t.status === 'covered') {
    const late = t.actual_completion_date ? daysBetween(t.planned_target_date, t.actual_completion_date) : 0;
    if (late > 0) return { tone: 'error', label: `Completed ${late} day${late === 1 ? '' : 's'} late`, delayed: true };
    if (late < 0) return { tone: 'success', label: `Completed ${-late} day${late === -1 ? '' : 's'} early`, delayed: false };
    return { tone: 'success', label: 'Completed on target', delayed: false };
  }
  const overdue = daysBetween(t.planned_target_date, today);
  if (overdue > 0) {
    return { tone: 'error', label: `${overdue} day${overdue === 1 ? '' : 's'} behind target (${target})`, delayed: true };
  }
  if (t.status === 'in_progress') return { tone: 'warning', label: `In progress · target ${target}`, delayed: false };
  return { tone: 'neutral', label: `Upcoming · target ${target}`, delayed: false };
}

export interface SyllabusSummary {
  total: number;
  covered: number;
  inProgress: number;
  delayed: number;
  plannedByToday: number;
  plannedPercent: number;
  actualPercent: number;
}

export function syllabusSummary(topics: SyllabusTopic[], today: string): SyllabusSummary {
  const total = topics.length;
  const covered = topics.filter((t) => t.status === 'covered').length;
  const plannedByToday = topics.filter((t) => t.planned_target_date <= today).length;
  return {
    total,
    covered,
    inProgress: topics.filter((t) => t.status === 'in_progress').length,
    delayed: topics.filter((t) => topicVariance(t, today).delayed).length,
    plannedByToday,
    plannedPercent: total ? (plannedByToday / total) * 100 : 0,
    actualPercent: total ? (covered / total) * 100 : 0,
  };
}

// ─── Honours ──────────────────────────────────────────────────────────────────

export function leaderboard(students: Student[]): Student[] {
  return [...students].sort((a, b) => b.points - a.points);
}

export function dispatchesFor(db: TeacherPortalData, filter: { deckId?: string; teacherId?: string }): PointsDispatch[] {
  return db.points_dispatches
    .filter((d) => (!filter.deckId || d.context_id === filter.deckId) && (!filter.teacherId || d.teacher_id === filter.teacherId))
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Class calendar (weekly pattern + extra & cancelled classes) ────────────

export interface ClassOccurrence {
  date: string;
  start: string;
  end: string;
  kind: 'regular' | 'extra';
  /** The cancellation, when this class is called off. */
  cancelled: ClassException | null;
  /** The extra-class record, so it can be removed again. */
  extra: ClassException | null;
  note: string;
}

export function exceptionsFor(db: TeacherPortalData, deckId: string): ClassException[] {
  return db.class_exceptions.filter((x) => x.context_id === deckId);
}

function dateOf(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Every class date of a deck in [from, to], inclusive. Regular weekdays come
 * from the weekly pattern; extra classes are added, cancellations are kept
 * (flagged) so the calendar can show them struck through.
 */
export function classCalendar(db: TeacherPortalData, deck: Deck, from: string, to: string): ClassOccurrence[] {
  const exceptions = exceptionsFor(db, deck.ref.id);
  const out: ClassOccurrence[] = [];
  for (let date = from; date <= to; date = shiftDate(date, 1)) {
    const slot = deck.slots[dayKeyOf(dateOf(date))];
    const cancelled = exceptions.find((x) => x.kind === 'cancelled' && x.date === date) ?? null;
    if (slot) {
      out.push({ date, start: slot.start, end: slot.end, kind: 'regular', cancelled, extra: null, note: cancelled?.note ?? '' });
    }
    for (const x of exceptions.filter((e) => e.kind === 'extra' && e.date === date)) {
      out.push({
        date,
        start: x.start_time ?? slot?.start ?? '',
        end: x.end_time ?? '',
        kind: 'extra',
        cancelled: null,
        extra: x,
        note: x.note,
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || clockMinutes(a.start) - clockMinutes(b.start));
}

/** Classes that actually take place (cancellations dropped). */
export function heldClasses(db: TeacherPortalData, deck: Deck, from: string, to: string): ClassOccurrence[] {
  return classCalendar(db, deck, from, to).filter((c) => !c.cancelled);
}

/** The next class strictly after `after` (looks ahead up to eight weeks). */
export function nextClassAfter(db: TeacherPortalData, deck: Deck, after: string): ClassOccurrence | null {
  return heldClasses(db, deck, shiftDate(after, 1), shiftDate(after, 56))[0] ?? null;
}

/** Up to `count` upcoming class dates on or after `from`. */
export function upcomingClasses(db: TeacherPortalData, deck: Deck, from: string, count: number): ClassOccurrence[] {
  return heldClasses(db, deck, from, shiftDate(from, 70)).slice(0, count);
}

/** Past classes in the last `days` days that have no attendance saved. */
export function unmarkedClasses(db: TeacherPortalData, deck: Deck, today: string, days = 7): ClassOccurrence[] {
  const marked = new Set(sessionsFor(db, deck.ref.id).map((s) => s.date));
  return heldClasses(db, deck, shiftDate(today, -days), shiftDate(today, -1)).filter((c) => !marked.has(c.date));
}

// ─── Homework ─────────────────────────────────────────────────────────────────

export function homeworkFor(db: TeacherPortalData, deckId: string): Homework[] {
  return db.homework
    .filter((h) => h.context_id === deckId)
    .sort((a, b) => b.assigned_date.localeCompare(a.assigned_date));
}

/** Due on or before today and not checked yet. */
export function homeworkToCheck(list: Homework[], today: string): Homework[] {
  return list.filter((h) => !h.checked_date && h.due_date <= today);
}

export interface HomeworkCounts {
  full: number;
  partial: number;
  none: number;
}

export function homeworkCounts(h: Homework, ids: string[]): HomeworkCounts {
  const c: HomeworkCounts = { full: 0, partial: 0, none: 0 };
  for (const id of ids) {
    const st = h.records[id];
    if (st) c[st] += 1;
  }
  return c;
}

export interface HomeworkRecordStats {
  checked: number;
  full: number;
  partial: number;
  none: number;
  /** Full counts 1, partial 0.5 — null until something has been checked. */
  rate: number | null;
  recent: { homework: Homework; status: HomeworkStatus }[];
}

export function studentHomework(studentId: string, list: Homework[]): HomeworkRecordStats {
  const checked = list
    .filter((h) => h.checked_date && h.records[studentId])
    .sort((a, b) => b.due_date.localeCompare(a.due_date));
  const count = (st: HomeworkStatus) => checked.filter((h) => h.records[studentId] === st).length;
  const full = count('full');
  const partial = count('partial');
  return {
    checked: checked.length,
    full,
    partial,
    none: count('none'),
    rate: checked.length ? ((full + partial * 0.5) / checked.length) * 100 : null,
    recent: checked.slice(0, 6).map((h) => ({ homework: h, status: h.records[studentId] })),
  };
}

// ─── Today's teaching plan ────────────────────────────────────────────────────

export interface ClassSlot {
  key: string;
  ref: DeckRef;
  title: string;
  context: string;
  subject: string;
  start: string;
  end: string;
  room: string;
  studentCount: number;
  color: string;
  kind: 'regular' | 'extra';
  cancelled: ClassException | null;
  note: string;
}

export function classesOn(db: TeacherPortalData, teacherId: string, date: string): ClassSlot[] {
  const slots: ClassSlot[] = [];
  for (const ref of allDecksFor(db, teacherId)) {
    const deck = resolveDeck(db, ref, teacherId);
    if (!deck) continue;
    for (const c of classCalendar(db, deck, date, date)) {
      slots.push({
        key: `${deck.ref.id}:${c.start}:${c.kind}`,
        ref: deck.ref,
        title: deck.isPrivate ? deck.name : `${deck.name} · ${deck.subject}`,
        context: deck.isPrivate ? 'Private batch' : deck.contextLabel,
        subject: deck.subject,
        start: c.start,
        end: c.end,
        room: deck.room,
        studentCount: deck.studentIds.length,
        color: deck.color,
        kind: c.kind,
        cancelled: c.cancelled,
        note: c.note,
      });
    }
  }
  return slots.sort((a, b) => clockMinutes(a.start) - clockMinutes(b.start));
}

/** Every deck this teacher runs, used for portfolio-wide rollups. */
export function allDecksFor(db: TeacherPortalData, teacherId: string): DeckRef[] {
  const refs: DeckRef[] = batchesFor(db, teacherId).map((b) => ({ type: 'private_batch', id: b.id }));
  for (const inst of institutesFor(db, teacherId)) {
    for (const sec of mySections(inst, teacherId)) {
      refs.push({ type: 'coaching_section', id: sec.id, instituteId: inst.id });
    }
  }
  return refs;
}

// ─── Institute analytics ──────────────────────────────────────────────────────

export interface SectionHealth {
  section: CoachingSection;
  enrolled: number;
  occupancy: number;
  attendance: number;
  tier: 'optimal' | 'good' | 'critical' | 'empty';
}

export interface InstituteAnalytics {
  students: number;
  capacity: number;
  occupancy: number;
  attendance: number;
  faculty: number;
  lecturesPerWeek: number;
  sections: SectionHealth[];
  load: { teacher: Teacher | null; subjects: string[]; lectures: number }[];
}

export function instituteAnalytics(db: TeacherPortalData, inst: CoachingInstitute): InstituteAnalytics {
  const sections: SectionHealth[] = inst.classes_sections.map((section) => {
    const roster = studentsOf(db, section.student_ids);
    const sessions = sessionsFor(db, section.id);
    const attendance = roster.length
      ? roster.reduce((sum, s) => sum + attendanceRate(s, sessions), 0) / roster.length
      : 0;
    return {
      section,
      enrolled: roster.length,
      occupancy: section.capacity ? (roster.length / section.capacity) * 100 : 0,
      attendance,
      tier: !roster.length ? 'empty' : attendance >= 90 ? 'optimal' : attendance >= 80 ? 'good' : 'critical',
    };
  });

  const uniqueIds = new Set(inst.classes_sections.flatMap((s) => s.student_ids));
  const unique = studentsOf(db, [...uniqueIds]);
  const capacity = inst.classes_sections.reduce((sum, s) => sum + s.capacity, 0);
  const enrolled = sections.reduce((sum, s) => sum + s.enrolled, 0);

  const loadMap = new Map<string, { subjects: Set<string>; lectures: number }>();
  for (const sec of inst.classes_sections) {
    for (const f of sec.subject_faculty_map) {
      const entry = loadMap.get(f.teacher_id) ?? { subjects: new Set<string>(), lectures: 0 };
      entry.subjects.add(f.subject);
      entry.lectures += f.lectures_per_week;
      loadMap.set(f.teacher_id, entry);
    }
  }

  return {
    students: unique.length,
    capacity,
    occupancy: capacity ? (enrolled / capacity) * 100 : 0,
    attendance: unique.length ? unique.reduce((sum, s) => sum + s.attendance_rate, 0) / unique.length : 0,
    faculty: inst.members.length,
    lecturesPerWeek: [...loadMap.values()].reduce((sum, l) => sum + l.lectures, 0),
    sections,
    load: [...loadMap.entries()]
      .map(([id, l]) => ({ teacher: teacherById(db, id), subjects: [...l.subjects], lectures: l.lectures }))
      .sort((a, b) => b.lectures - a.lectures),
  };
}
