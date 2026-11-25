// Rows as the server's sync call sends them to a batch's teacher
// (new-db-plan.md §7–§9, in the student app's repo). Money is paise, app
// times are milliseconds, months 'YYYY-MM', days 'YYYY-MM-DD'.

export type Gender = 'male' | 'female' | 'other';
export type Relation = 'self' | 'father' | 'mother' | 'friend' | 'teacher' | 'other';
export type EnrolmentStatus = 'pending' | 'approved' | 'declined' | 'left' | 'removed';
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type WeekSchedule = Record<DayKey, string>;

/** The signed-in account (public.users). */
export interface AccountMe {
  id: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  gender: Gender | null;
  whatsapp_number: string | null;
  email: string | null;
  dob: string | null;
  created_at: string;
  updated_at: string;
}

/** The account's teacher profile (public.teachers); one per account. */
export interface TeacherProfile {
  id: string;
  qualification: string;
  primary_subject: string;
  experience_years: number | null;
  bio: string;
  achievements: string[];
  authored_books: string[];
  created_at: string;
  updated_at: string;
}

/** private = the teacher's own batch; an institute has sections (students join) and their subjects. */
export type BatchKind = 'private' | 'section' | 'subject';

export interface Teaching {
  batch_id: string;
  /** owner: runs the batch (private owner, institute owner or admin) · subject: teaches one institute subject. */
  role: string;
  name: string;
  deleted_at: number | null;
  /** Missing on snapshots from before institutes (= private). */
  kind?: BatchKind;
  institute_id?: string | null;
  parent_id?: string | null;
}

export type InstituteRole = 'owner' | 'admin' | 'teacher';
export type StaffStatus = 'pending' | 'active' | 'declined' | 'left' | 'removed';

/** What families see of an institute (carried on its sections and subjects). */
export interface InstituteCard {
  id: string;
  name: string;
  tagline: string;
  logo_text: string;
  theme_color: string;
  address: string;
  phone: string;
  email: string;
  established: number | null;
}

export interface InstituteMember {
  user_id: string;
  name: string;
  /** Only admins get phone numbers. */
  whatsapp: string | null;
  role: InstituteRole;
  status: StaffStatus;
  title: string;
  subjects: string[];
  requested_at: number;
  decided_at: number | null;
}

export interface InstituteSubject {
  batch_id: string;
  subject: string;
  teacher_id: string | null;
  teacher_name: string | null;
  weekly_schedule: WeekSchedule;
  room: string;
}

export interface InstituteSection {
  batch_id: string;
  name: string;
  grade: string | null;
  board: string | null;
  room: string;
  capacity: number;
  monthly_fee: number;
  course_start: string | null;
  course_end: string | null;
  join_code: string;
  deleted_at: number | null;
  created_at: number;
  students: number;
  requests: number;
  subjects: InstituteSubject[];
}

/** An institute this account belongs to (or asked to join), from the account snapshot. */
export interface Institute extends InstituteCard {
  owner_id: string;
  /** Students' code (VLI-…), for active members. */
  join_code: string | null;
  /** Teachers' code (VLS-…), for the owner and admins. */
  staff_code: string | null;
  created_at: number;
  deleted_at: number | null;
  my_role: InstituteRole;
  my_status: StaffStatus;
  /** Null while this account's request is pending. */
  members: InstituteMember[] | null;
  sections: InstituteSection[] | null;
}

export interface AccountSnapshot {
  rev: number;
  me: AccountMe | null;
  teacher: TeacherProfile | null;
  /** Batches this account teaches, deleted ones included. */
  teaching: Teaching[];
  /** Missing on snapshots from before institutes. */
  institutes?: Institute[];
}

export interface Batch {
  id: string;
  owner_id: string;
  /** Missing on rows downloaded before institutes (= private). */
  kind?: BatchKind;
  institute_id?: string | null;
  /** A subject's section. */
  parent_id?: string | null;
  /** A subject's teacher. */
  teacher_id?: string | null;
  institute_card?: InstituteCard | null;
  teacher_card?: { name?: string } | null;
  name: string;
  subject: string;
  grade: string | null;
  board: string | null;
  room: string;
  weekly_schedule: WeekSchedule;
  monthly_fee: number;
  capacity: number;
  course_start: string | null;
  course_end: string | null;
  require_approval: boolean;
  join_code: string;
  seq: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

/** What the teacher's roster keeps about a student. */
export interface StudentCard {
  first_name: string;
  middle_name: string;
  last_name: string;
  gender: Gender | null;
  dob: string | null;
  class_name: string | null;
  board: string | null;
}

/** A guardian to call about a student (only while approved). */
export interface ContactCard {
  name: string;
  whatsapp: string | null;
  relation: Relation;
  relation_other: string | null;
}

/** A student in (or asking to join) one of the teacher's batches. */
export interface Enrolment {
  id: string;
  batch_id: string;
  student_id: string;
  status: EnrolmentStatus;
  requested_at: number;
  decided_at: number | null;
  joined_month: string | null;
  fee_override: number | null;
  student_card: StudentCard;
  contact: ContactCard[] | null;
  seq: number;
}

export interface Session {
  held: boolean;
  extra?: boolean;
  time?: string;
  note?: string;
}

export interface BatchMonth {
  batch_id: string;
  month: string;
  sessions: Record<string, Session>;
  seq: number;
}

export type FeeMode = 'cash' | 'upi' | 'bank' | 'other';

export interface MonthFee {
  status: 'paid' | 'waived';
  amount: number;
  paid_on?: string | null;
  mode?: FeeMode | null;
  note?: string | null;
}

/** One student's month in one batch: attendance exceptions, fee, marks, remark. */
export interface EnrolmentMonth {
  enrolment_id: string;
  month: string;
  batch_id: string;
  att: Record<string, 'A' | 'L'>;
  fee: MonthFee | null;
  score: Record<string, number | 'AB'>;
  remark: string | null;
  seq: number;
}

export interface BatchTest {
  batch_id: string;
  id: string;
  title: string;
  subject: string | null;
  held_on: string;
  max_marks: number;
  /** Worked out on the teacher's phone (utils/tests TestSummary): count, average, highest… */
  summary: Record<string, unknown> | null;
  created_at?: number;
  deleted_at: number | null;
  seq: number;
  /** Phone only: made or edited here and not uploaded yet. */
  pending?: boolean;
}

export interface BatchNotice {
  batch_id: string;
  id: string;
  body: string;
  pinned: boolean;
  created_at: number;
  deleted_at: number | null;
  seq: number;
  /** Phone only: posted or edited here and not uploaded yet. */
  pending?: boolean;
}

// ── uploads (the outbox) ──────────────────────────────────────────────────

/** Batch fields the teacher edits through sync (create, delete and the join code are online actions). */
export type BatchFields = Partial<
  Pick<
    Batch,
    | 'name'
    | 'subject'
    | 'grade'
    | 'board'
    | 'room'
    | 'weekly_schedule'
    | 'monthly_fee'
    | 'capacity'
    | 'course_start'
    | 'course_end'
    | 'require_approval'
  >
>;

/** Keys of a student's month; null removes one (a day back to present, a fee back to due). */
export interface MonthPatch {
  att?: Record<string, 'A' | 'L' | null>;
  score?: Record<string, number | 'AB' | null>;
  fee?: MonthFee | null;
  remark?: string | null;
}

/** Class days of a month: day "DD" → the class (held / cancelled / extra), null removes the record. */
export interface SessionsPatch {
  sessions: Record<string, Session | null>;
}

/** A notice is sent whole (the latest edit wins); the id is made on the phone. */
export interface NoticeFields {
  body: string;
  pinned: boolean;
}

/** A test is sent whole (the latest edit wins); the id is made on the phone. */
export interface TestFields {
  title: string;
  subject: string | null;
  held_on: string;
  max_marks: number;
  summary: Record<string, unknown> | null;
}

export type Change =
  | { t: 'batches'; b: string; at: number; data: BatchFields }
  | { t: 'batch_months'; b: string; at: number; m: string; patch: SessionsPatch }
  | { t: 'batch_tests'; b: string; at: number; id: string; data: TestFields }
  | { t: 'batch_tests'; b: string; at: number; id: string; deleted: true }
  | { t: 'batch_notices'; b: string; at: number; id: string; data: NoticeFields }
  | { t: 'batch_notices'; b: string; at: number; id: string; deleted: true }
  | { t: 'enrolment_months'; b: string; at: number; e: string; m: string; patch: MonthPatch };

// ── the sync call ─────────────────────────────────────────────────────────

export interface BatchPage {
  upto: number;
  more: boolean;
  full: boolean;
  role: string;
  batch: Batch | null;
  batch_months: BatchMonth[];
  batch_tests: BatchTest[];
  batch_notices: BatchNotice[];
  enrolments: Enrolment[];
  enrolment_months: EnrolmentMonth[];
}

export type BatchAnswer = BatchPage | { gone: true } | { later: true };

export interface ChangeResult {
  i: number;
  status: 'applied' | 'rejected';
  reason?: 'not_allowed' | 'invalid' | 'older' | 'not_member' | 'no_batch' | 'deleted' | 'error';
  detail?: string;
}

export interface SyncResponse {
  server_now: number;
  results: ChangeResult[];
  account: AccountSnapshot | null;
  batches: Record<string, BatchAnswer>;
}
