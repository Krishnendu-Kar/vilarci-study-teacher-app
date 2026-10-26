// Shared relational types mirroring the partner portal's TEACHER_PORTAL_DATA
// (Vilarci-study-partner-demo/Antigravity/js/data.js). Field names stay
// identical so a later Supabase swap only touches src/lib/api, never screens.
// Students are the same people the Vilarci Study student app shows.

export type TeacherId = string;
export type StudentId = string;
export type InstituteId = string;

export interface Teacher {
  id: TeacherId;
  name: string;
  qualification: string;
  primary_subject: string;
  phone: string;
  email: string;
  photo_initials: string;
  avatar_bg: string;
}

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** Canonical day-wise schedule: "09:00 AM - 05:00 PM" or "Closed". */
export type WeeklySchedule = Record<DayKey, string>;

export interface PrivateBatch {
  id: string;
  teacher_id: TeacherId;
  name: string;
  join_code: string;
  grade: string;
  board: string;
  subject: string;
  room: string;
  weekly_schedule: WeeklySchedule;
  monthly_fee: number;
  capacity: number;
  created_date: string;
  student_ids: StudentId[];
}

export type PermissionLevel =
  | 'Owner / Full Admin'
  | 'Co-Admin'
  | 'Faculty / Subject Teacher'
  | 'Lab Instructor';

export interface InstituteMember {
  teacher_id: TeacherId;
  role: string;
  permission_level: PermissionLevel;
  assigned_subjects: string[];
  joined_date: string;
  assigned_sections: string[];
}

export type NoticeCategory =
  | 'Important Circular'
  | 'Exam & Test Schedule'
  | 'Holiday & Vacation Notice'
  | 'General Announcement';

export interface Notice {
  id: string;
  title: string;
  category: NoticeCategory;
  target: string;
  date: string;
  author: string;
  body: string;
}

export interface SubjectFaculty {
  subject: string;
  teacher_id: TeacherId;
  lectures_per_week: number;
  /** e.g. "Mon, Wed, Fri • 07:30 AM" */
  schedule: string;
}

export interface CoachingSection {
  id: string;
  class_name: string;
  section_name: string;
  full_code: string;
  board: string;
  room: string;
  capacity: number;
  weekly_schedule?: WeeklySchedule;
  subject_faculty_map: SubjectFaculty[];
  student_ids: StudentId[];
}

export interface InstitutePermissions {
  can_manage_members: boolean;
  can_create_sections: boolean;
  can_manage_fees: boolean;
  can_issue_marksheets: boolean;
}

export interface CoachingInstitute {
  id: InstituteId;
  name: string;
  tagline: string;
  code: string;
  logo_text: string;
  theme_color: string;
  address: string;
  phone: string;
  email: string;
  established: number;
  owner_teacher_id: TeacherId;
  /** Permissions granted to members who are not the owner. */
  member_permissions: InstitutePermissions;
  members: InstituteMember[];
  notices: Notice[];
  classes_sections: CoachingSection[];
}

export type FeeStatus = 'paid' | 'pending';

export interface FeeLedgerEntry {
  status: FeeStatus;
  amount: number;
  paid_date: string | null;
  payment_mode: string | null;
  receipt_ref: string | null;
}

export interface Student {
  id: StudentId;
  name: string;
  roll: string;
  grade: string;
  board: string;
  phone: string;
  father_name: string;
  father_phone: string;
  father_phone_verified: boolean;
  mother_name: string;
  mother_phone: string;
  mother_phone_verified: boolean;
  guardian_name: string;
  guardian_phone: string;
  guardian_phone_verified: boolean;
  points: number;
  streak: number;
  /** Fallback rate used until a deck has its own attendance sessions. */
  attendance_rate: number;
  custom_monthly_fee: number;
  /** YYYY-MM */
  admission_start_month: string;
  /** YYYY-MM */
  course_end_month: string;
  fee_ledger: Record<string, FeeLedgerEntry>;
  photo_initials: string;
  avatar_gradient: [string, string];
}

export type DeckType = 'private_batch' | 'coaching_section';

export interface PointsDispatch {
  id: string;
  date: string;
  context_type: DeckType;
  context_id: string;
  context_title: string;
  teacher_id: TeacherId;
  teacher_name: string;
  student_id: StudentId;
  student_name: string;
  points: number;
  category: string;
  citation: string;
}

export type SyllabusStatus = 'upcoming' | 'in_progress' | 'covered';

export interface SyllabusTopic {
  id: string;
  context_id: string;
  subject: string;
  chapter_number: number;
  chapter_name: string;
  topic_name: string;
  planned_target_date: string;
  actual_completion_date: string | null;
  status: SyllabusStatus;
  revised_count: number;
}

export type SubmissionStatus = 'present' | 'absent' | 'pending';

export interface TestSubmission {
  student_id: StudentId;
  marks: number | null;
  status: SubmissionStatus;
  weak_topics: string;
}

export interface BatchTest {
  id: string;
  context_id: string;
  title: string;
  subject: string;
  max_marks: number;
  conducted_date: string;
  submissions: TestSubmission[];
}

export type AttendanceStatus = 'present' | 'late' | 'absent';

export interface AttendanceSession {
  id: string;
  context_id: string;
  date: string;
  topic_covered: string;
  records: Record<StudentId, AttendanceStatus>;
}

/**
 * One-off change to a deck's weekly timetable. Private batches usually meet
 * once or twice a week, so an extra class before a test or a holiday
 * cancellation is the norm rather than the exception.
 */
export interface ClassException {
  id: string;
  context_id: string;
  date: string;
  kind: 'extra' | 'cancelled';
  /** 'HH:MM AM' — extra classes only. */
  start_time: string | null;
  end_time: string | null;
  note: string;
}

/** Checked at the next class: done fully, partly, or not at all. */
export type HomeworkStatus = 'full' | 'partial' | 'none';

export interface Homework {
  id: string;
  context_id: string;
  title: string;
  details: string;
  /** Class date the homework was given. */
  assigned_date: string;
  /** Class date it is checked — normally the next class. */
  due_date: string;
  /** Null until the teacher checks it. */
  checked_date: string | null;
  records: Record<StudentId, HomeworkStatus>;
}

/** The full relational store, mirroring TEACHER_PORTAL_DATA on the website. */
export interface TeacherPortalData {
  teachers: Teacher[];
  private_batches: PrivateBatch[];
  coaching_institutes: CoachingInstitute[];
  students: Student[];
  points_dispatches: PointsDispatch[];
  syllabus_topics: SyllabusTopic[];
  tests: BatchTest[];
  attendance_sessions: AttendanceSession[];
  class_exceptions: ClassException[];
  homework: Homework[];
}
