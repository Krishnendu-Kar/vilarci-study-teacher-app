import { privateBatches } from './teachers';
import { coachingInstitutes } from './institutes';
import { parseFacultySlot } from '../utils/schedule';
import type {
  AttendanceSession,
  AttendanceStatus,
  BatchTest,
  ClassException,
  DayKey,
  Homework,
  HomeworkStatus,
  PointsDispatch,
  SyllabusTopic,
  TestSubmission,
} from './types';

// ─── Points dispatches (academic honours audit log) ──────────────────────────

export const pointsDispatches: PointsDispatch[] = [
  {
    id: 'disp-101',
    date: '2026-10-18',
    context_type: 'private_batch',
    context_id: 'pbatch-10-m',
    context_title: 'Class 10 Maths Morning Super 20',
    teacher_id: 'teacher-alok',
    teacher_name: 'Er. Alok Sharma',
    student_id: 'student-1',
    student_name: 'Aryan Mehta',
    points: 150,
    category: 'Test Excellence',
    citation: 'Flawless proof in Quadratic Equations discriminant test.',
  },
  {
    id: 'disp-102',
    date: '2026-10-17',
    context_type: 'coaching_section',
    context_id: 'sec-10-a',
    context_title: 'Stellar Academy • Class 10-A',
    teacher_id: 'teacher-alok',
    teacher_name: 'Er. Alok Sharma',
    student_id: 'student-ext-1',
    student_name: 'Rahul Sharma',
    points: 120,
    category: 'Concept Mastery',
    citation: 'Solved all 5 bonus polynomial challenge questions in under 12 minutes.',
  },
  {
    id: 'disp-103',
    date: '2026-10-16',
    context_type: 'private_batch',
    context_id: 'pbatch-10-m',
    context_title: 'Class 10 Maths Morning Super 20',
    teacher_id: 'teacher-alok',
    teacher_name: 'Er. Alok Sharma',
    student_id: 'student-ext-2',
    student_name: 'Vivek Gupta',
    points: 80,
    category: 'Homework Streak',
    citation: 'Consistent 18-day study streak with neat homework formatting.',
  },
];

// ─── Curriculum tracker (planned target vs reality) ──────────────────────────

export const syllabusTopics: SyllabusTopic[] = [
  {
    id: 'syl-1',
    context_id: 'pbatch-10-m',
    subject: 'Mathematics',
    chapter_number: 1,
    chapter_name: 'Real Numbers',
    topic_name: 'Fundamental Theorem of Arithmetic & Proof of Irrationality',
    planned_target_date: '2026-07-15',
    actual_completion_date: '2026-07-15',
    status: 'covered',
    revised_count: 17,
  },
  {
    id: 'syl-2',
    context_id: 'pbatch-10-m',
    subject: 'Mathematics',
    chapter_number: 2,
    chapter_name: 'Polynomials',
    topic_name: 'Relationship between Zeroes and Coefficients of Quadratic Polynomials',
    planned_target_date: '2026-08-10',
    actual_completion_date: '2026-08-17',
    status: 'covered',
    revised_count: 16,
  },
  {
    id: 'syl-3',
    context_id: 'pbatch-10-m',
    subject: 'Mathematics',
    chapter_number: 4,
    chapter_name: 'Quadratic Equations',
    topic_name: 'Quadratic Formula, Nature of Roots & Word Problems',
    planned_target_date: '2026-09-25',
    actual_completion_date: '2026-10-04',
    status: 'covered',
    revised_count: 14,
  },
  {
    id: 'syl-4',
    context_id: 'pbatch-10-m',
    subject: 'Mathematics',
    chapter_number: 5,
    chapter_name: 'Arithmetic Progressions',
    topic_name: 'nth Term of an AP and Sum of First n Terms',
    planned_target_date: '2026-10-25',
    actual_completion_date: null,
    status: 'in_progress',
    revised_count: 8,
  },
  {
    id: 'syl-5',
    context_id: 'pbatch-10-m',
    subject: 'Mathematics',
    chapter_number: 6,
    chapter_name: 'Triangles & Similarity',
    topic_name: 'Basic Proportionality Theorem (Thales) & Criterion for Similarity',
    planned_target_date: '2026-11-20',
    actual_completion_date: null,
    status: 'upcoming',
    revised_count: 0,
  },
  {
    id: 'syl-6',
    context_id: 'sec-10-a',
    subject: 'Mathematics',
    chapter_number: 1,
    chapter_name: 'Real Numbers',
    topic_name: 'Fundamental Theorem of Arithmetic',
    planned_target_date: '2026-07-20',
    actual_completion_date: '2026-07-20',
    status: 'covered',
    revised_count: 26,
  },
  {
    id: 'syl-7',
    context_id: 'sec-10-a',
    subject: 'Physics',
    chapter_number: 1,
    chapter_name: 'Light: Reflection & Refraction',
    topic_name: 'Spherical Mirrors Ray Diagrams & Lens Formula',
    planned_target_date: '2026-08-15',
    actual_completion_date: '2026-08-20',
    status: 'covered',
    revised_count: 24,
  },
];

// ─── Tests & scorecards ──────────────────────────────────────────────────────

const sub = (student_id: string, marks: number, weak_topics: string): TestSubmission => ({
  student_id,
  marks,
  status: 'present',
  weak_topics,
});

export const tests: BatchTest[] = [
  {
    id: 'test-1',
    context_id: 'pbatch-10-m',
    title: 'Polynomials & Real Numbers Comprehensive Exam',
    subject: 'Mathematics',
    max_marks: 50,
    conducted_date: '2026-08-22',
    submissions: [
      sub('student-ext-1', 50, ''),
      sub('student-ext-2', 46, 'Irrational proofs algebraic phrasing'),
      sub('student-1', 44, 'Discriminant coefficient roots'),
      sub('student-ext-3', 42, 'Zeroes relation signs'),
      sub('student-ext-5', 40, 'Euclid division lemma remainder'),
      sub('student-ext-4', 38, 'Factorization speed'),
      sub('student-ext-6', 34, 'Fundamental theorem of arithmetic'),
    ],
  },
  {
    id: 'test-2',
    context_id: 'pbatch-10-m',
    title: 'Quadratic Equations & Discriminant Mastery Test',
    subject: 'Mathematics',
    max_marks: 40,
    conducted_date: '2026-09-29',
    submissions: [
      sub('student-ext-1', 40, ''),
      sub('student-1', 38, 'Time management under speed'),
      sub('student-ext-2', 36, 'Completing square sign error'),
      sub('student-ext-3', 35, 'Roots condition when b²−4ac = 0'),
      sub('student-ext-5', 34, 'Word problem translation'),
      sub('student-ext-4', 30, 'Quadratic formula fractions'),
      sub('student-ext-6', 28, 'Nature of roots case 2'),
    ],
  },
  {
    id: 'test-3',
    context_id: 'pbatch-10-m',
    title: 'Arithmetic Progressions Diagnostic Quiz',
    subject: 'Mathematics',
    max_marks: 25,
    conducted_date: '2026-10-17',
    submissions: [
      sub('student-ext-1', 25, ''),
      sub('student-1', 24, 'Sum of n terms calculation'),
      sub('student-ext-2', 23, 'AP negative common difference'),
      sub('student-ext-3', 22, 'First term from T5 & T9'),
      sub('student-ext-5', 21, 'AP application word problem'),
      sub('student-ext-4', 19, 'Formula memory nth term'),
      sub('student-ext-6', 17, 'Common difference identification'),
    ],
  },
  {
    id: 'test-4',
    context_id: 'sec-10-a',
    title: 'Class 10-A Term 1 Mathematics Prelims',
    subject: 'Mathematics',
    max_marks: 80,
    conducted_date: '2026-10-09',
    submissions: [
      sub('student-ext-1', 80, ''),
      sub('student-1', 74, 'Trigonometry identities'),
      sub('student-ext-2', 72, 'Geometry proofs'),
    ],
  },
];

// ─── Extra & cancelled classes ───────────────────────────────────────────────

export const classExceptions: ClassException[] = [
  {
    id: 'cx-10m-1015',
    context_id: 'pbatch-10-m',
    date: '2026-10-15',
    kind: 'extra',
    start_time: '05:30 PM',
    end_time: '07:00 PM',
    note: 'Doubt-clearing before the AP quiz',
  },
  {
    id: 'cx-10m-1026',
    context_id: 'pbatch-10-m',
    date: '2026-10-26',
    kind: 'extra',
    start_time: '07:30 PM',
    end_time: '09:00 PM',
    note: 'Triangles kick-off before the Diwali break',
  },
  { id: 'cx-10m-1031', context_id: 'pbatch-10-m', date: '2026-10-31', kind: 'cancelled', start_time: null, end_time: null, note: 'Diwali break' },
  {
    id: 'cx-10m-1105',
    context_id: 'pbatch-10-m',
    date: '2026-11-05',
    kind: 'extra',
    start_time: '07:00 AM',
    end_time: '08:30 AM',
    note: 'Make-up class for the Diwali break',
  },
  { id: 'cx-10e-1029', context_id: 'pbatch-10-e', date: '2026-10-29', kind: 'cancelled', start_time: null, end_time: null, note: 'Diwali break' },
  { id: 'cx-10e-1101', context_id: 'pbatch-10-e', date: '2026-11-01', kind: 'cancelled', start_time: null, end_time: null, note: 'Diwali break' },
  { id: 'cx-10o-1101', context_id: 'pbatch-10-o', date: '2026-11-01', kind: 'cancelled', start_time: null, end_time: null, note: 'Diwali break' },
  {
    id: 'cx-12s-1023',
    context_id: 'pbatch-12-s',
    date: '2026-10-23',
    kind: 'extra',
    start_time: '08:00 PM',
    end_time: '09:30 PM',
    note: 'Extra practice: limits & continuity PYQs',
  },
];

// ─── Date-by-date attendance register ────────────────────────────────────────

const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Stable pseudo-random status so the seed reads like a real register. */
function statusFor(studentId: string, date: string): AttendanceStatus {
  let h = 0;
  for (const ch of studentId + date) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  if (h % 13 === 0) return 'absent';
  if (h % 7 === 0) return 'late';
  return 'present';
}

const TOPICS = [
  'Concept lecture & worked examples',
  'Previous-year questions practice',
  'Doubt clearing & homework review',
  'Chapter drill & quick quiz',
];

/**
 * Registers for every class held between 1 September and 25 October — private batches
 * (regular weekdays plus extra classes, minus cancellations) and institute sections. The Morning Super 20
 * class on Sat 24 Oct is deliberately left unmarked so the app's "not
 * marked yet" reminders have something real to show.
 */
function seedRegisters(): AttendanceSession[] {
  const out: AttendanceSession[] = [];
  for (const b of privateBatches) {
    const extras = classExceptions.filter((x) => x.context_id === b.id && x.kind === 'extra').map((x) => x.date);
    const cancelled = new Set(classExceptions.filter((x) => x.context_id === b.id && x.kind === 'cancelled').map((x) => x.date));
    for (let d = new Date(2026, 8, 1); d <= new Date(2026, 9, 25); d.setDate(d.getDate() + 1)) {
      const date = isoDate(d);
      const regular = b.weekly_schedule[DAY_KEYS[d.getDay()]] !== 'Closed';
      if ((!regular && !extras.includes(date)) || cancelled.has(date)) continue;
      if (b.id === 'pbatch-10-m' && date === '2026-10-24') continue;
      out.push({
        id: `att-${b.id}-${date.replace(/-/g, '')}`,
        context_id: b.id,
        date,
        topic_covered: TOPICS[out.length % TOPICS.length],
        records: Object.fromEntries(b.student_ids.map((sid) => [sid, statusFor(sid, date)])),
      });
    }
  }
  // Institute sections meet on every weekday any of their faculty teach.
  for (const sec of coachingInstitutes.flatMap((i) => i.classes_sections)) {
    const days = new Set(sec.subject_faculty_map.flatMap((f) => parseFacultySlot(f.schedule).days));
    for (let d = new Date(2026, 8, 1); d <= new Date(2026, 9, 25); d.setDate(d.getDate() + 1)) {
      if (!days.has(DAY_KEYS[d.getDay()])) continue;
      const date = isoDate(d);
      out.push({
        id: `att-${sec.id}-${date.replace(/-/g, '')}`,
        context_id: sec.id,
        date,
        topic_covered: TOPICS[out.length % TOPICS.length],
        records: Object.fromEntries(sec.student_ids.map((sid) => [sid, statusFor(sid, date)])),
      });
    }
  }
  return out;
}

export const attendanceSessions: AttendanceSession[] = seedRegisters();

// ─── Homework (set in one class, checked at the next) ───────────────────────

const hw = (records: Record<string, HomeworkStatus>) => records;

export const homework: Homework[] = [
  {
    id: 'hw-10m-1',
    context_id: 'pbatch-10-m',
    title: 'Ex 5.1 Q1–10 · nth term of an AP',
    details: 'Show the formula step in every answer.',
    assigned_date: '2026-10-13',
    due_date: '2026-10-15',
    checked_date: '2026-10-15',
    records: hw({
      'student-1': 'full',
      'student-ext-1': 'full',
      'student-ext-2': 'full',
      'student-ext-3': 'partial',
      'student-ext-4': 'partial',
      'student-ext-5': 'full',
      'student-ext-6': 'none',
    }),
  },
  {
    id: 'hw-10m-2',
    context_id: 'pbatch-10-m',
    title: 'Ex 5.2 Q1–12 · find a and d from given terms',
    details: '',
    assigned_date: '2026-10-15',
    due_date: '2026-10-17',
    checked_date: '2026-10-17',
    records: hw({
      'student-1': 'full',
      'student-ext-1': 'full',
      'student-ext-2': 'partial',
      'student-ext-3': 'full',
      'student-ext-4': 'none',
      'student-ext-5': 'full',
      'student-ext-6': 'partial',
    }),
  },
  {
    id: 'hw-10m-3',
    context_id: 'pbatch-10-m',
    title: 'Ex 5.3 Q1–8 · sum of first n terms',
    details: 'Attempt Q8 using both formulas.',
    assigned_date: '2026-10-17',
    due_date: '2026-10-20',
    checked_date: '2026-10-20',
    records: hw({
      'student-1': 'partial',
      'student-ext-1': 'full',
      'student-ext-2': 'full',
      'student-ext-3': 'full',
      'student-ext-4': 'partial',
      'student-ext-5': 'full',
      'student-ext-6': 'none',
    }),
  },
  {
    id: 'hw-10m-4',
    context_id: 'pbatch-10-m',
    title: 'Ex 5.3 Q9–20 + 5 board PYQs',
    details: 'PYQ sheet shared on the batch WhatsApp group.',
    assigned_date: '2026-10-20',
    due_date: '2026-10-24',
    checked_date: null,
    records: {},
  },
  {
    id: 'hw-12s-1',
    context_id: 'pbatch-12-s',
    title: 'NCERT Ex 5.2 · continuity & differentiability',
    details: 'Full solutions in the practice register.',
    assigned_date: '2026-10-21',
    due_date: '2026-10-25',
    checked_date: null,
    records: {},
  },
  {
    id: 'hw-10e-1',
    context_id: 'pbatch-10-e',
    title: 'Quadratic equations · 15 mixed board questions',
    details: '',
    assigned_date: '2026-10-22',
    due_date: '2026-10-25',
    checked_date: '2026-10-25',
    records: hw({ 'student-ext-2': 'full', 'student-ext-4': 'partial', 'student-ext-7': 'full' }),
  },
  {
    id: 'hw-10a-1',
    context_id: 'sec-10-a',
    title: 'Trigonometric identities worksheet',
    details: '',
    assigned_date: '2026-10-21',
    due_date: '2026-10-23',
    checked_date: '2026-10-23',
    records: hw({
      'student-1': 'full',
      'student-ext-1': 'full',
      'student-ext-2': 'partial',
      'student-ext-3': 'full',
      'student-ext-5': 'none',
    }),
  },
];
