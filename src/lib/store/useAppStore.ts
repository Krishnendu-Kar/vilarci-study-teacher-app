import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AVATAR_GRADIENTS, DEFAULT_TEACHER_ID, emptySchedule, freshSeed, inviteJoiners } from '../data';
import type {
  AttendanceStatus,
  CoachingInstitute,
  CoachingSection,
  DeckType,
  FeeLedgerEntry,
  HomeworkStatus,
  NoticeCategory,
  PrivateBatch,
  Student,
  SyllabusStatus,
  TeacherPortalData,
  TestSubmission,
  WeeklySchedule,
} from '../data/types';
import { initialsOf, monthYear, todayIso } from '../utils/format';

export type ThemeMode = 'system' | 'light' | 'dark';

/** Addresses one batch command deck: a private batch or a coaching section. */
export interface DeckRef {
  type: DeckType;
  id: string;
  /** Parent institute, required for coaching sections. */
  instituteId?: string;
}

export interface Result {
  ok: boolean;
  message: string;
}

export interface NewStudentInput {
  name: string;
  roll: string;
  grade: string;
  board: string;
  father_name: string;
  father_phone: string;
  mother_name: string;
  mother_phone: string;
  guardian_name: string;
  guardian_phone: string;
  monthly_fee: number;
  current_month_paid: boolean;
  welcome_points: number;
}

interface AppState {
  db: TeacherPortalData;

  // ── who is signed in ──────────────────────────────────────────────────────
  teacherId: string;
  setTeacher: (id: string) => void;

  // ── preferences ───────────────────────────────────────────────────────────
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;

  // ── private batches ───────────────────────────────────────────────────────
  createBatch: (input: {
    name: string;
    grade: string;
    board: string;
    subject: string;
    room: string;
    monthly_fee: number;
    capacity: number;
  }) => string;
  updateDeckSettings: (
    deck: DeckRef,
    patch: { name: string; room: string; monthly_fee: number; weekly_schedule: WeeklySchedule },
  ) => void;

  // ── coaching institutes ───────────────────────────────────────────────────
  createInstitute: (input: { name: string; tagline: string; code: string; address: string }) => Result & { id?: string };
  joinInstituteByCode: (code: string) => Result & { id?: string };
  updateInstitute: (id: string, patch: Partial<Pick<CoachingInstitute, 'name' | 'tagline' | 'address' | 'phone' | 'email'>>) => void;
  addSection: (
    instituteId: string,
    input: { class_name: string; section_name: string; board: string; room: string; capacity: number; subject: string },
  ) => void;
  inviteMember: (
    instituteId: string,
    input: { name: string; contact: string; role: string; subjects: string[] },
  ) => void;
  removeMember: (instituteId: string, teacherId: string) => void;
  postNotice: (instituteId: string, input: { title: string; target: string; category: NoticeCategory; body: string }) => void;
  deleteNotice: (instituteId: string, noticeId: string) => void;

  // ── roster ────────────────────────────────────────────────────────────────
  enrollNewStudent: (deck: DeckRef, input: NewStudentInput) => string;
  simulateInviteJoin: (deck: DeckRef) => string;
  removeStudentFromDeck: (deck: DeckRef, studentId: string) => void;

  // ── class calendar ────────────────────────────────────────────────────────
  addExtraClass: (
    deckId: string,
    input: { date: string; start_time: string | null; end_time: string | null; note: string },
  ) => void;
  cancelClass: (deckId: string, date: string, note: string) => void;
  /** Removes an extra class or restores a cancelled one. */
  removeClassException: (id: string) => void;

  // ── attendance ────────────────────────────────────────────────────────────
  saveAttendance: (deckId: string, date: string, topic: string, records: Record<string, AttendanceStatus>) => void;

  // ── homework ──────────────────────────────────────────────────────────────
  assignHomework: (
    deckId: string,
    input: { title: string; details: string; assigned_date: string; due_date: string },
  ) => string;
  checkHomework: (homeworkId: string, records: Record<string, HomeworkStatus>, checkedDate: string) => void;
  deleteHomework: (homeworkId: string) => void;

  // ── honours ───────────────────────────────────────────────────────────────
  awardPoints: (
    deck: DeckRef,
    deckTitle: string,
    studentId: string,
    points: number,
    category: string,
    citation: string,
  ) => void;

  // ── tests ─────────────────────────────────────────────────────────────────
  scheduleTest: (deckId: string, input: { title: string; subject: string; max_marks: number; date: string }) => string;
  saveScorecard: (testId: string, submissions: TestSubmission[]) => void;
  deleteTest: (testId: string) => void;

  // ── curriculum ────────────────────────────────────────────────────────────
  addTopic: (
    deckId: string,
    input: {
      subject: string;
      chapter_number: number;
      chapter_name: string;
      topic_name: string;
      planned_target_date: string;
      status: SyllabusStatus;
    },
  ) => void;
  cycleTopicStatus: (topicId: string) => SyllabusStatus | null;
  removeTopic: (topicId: string) => void;

  // ── fees (academic ledger — Vilarci never issues receipts) ────────────────
  recordPayment: (studentId: string, monthKey: string, entry: Omit<FeeLedgerEntry, 'status'>) => void;
  configureStudentFee: (studentId: string, monthlyFee: number, startMonth: string, endMonth: string) => void;

  resetDemo: () => void;
}

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;

/** Copy-on-write: every action edits a fresh clone, so selectors see new refs. */
function edit(db: TeacherPortalData, fn: (draft: TeacherPortalData) => void): TeacherPortalData {
  const draft: TeacherPortalData = JSON.parse(JSON.stringify(db));
  fn(draft);
  return draft;
}

function findSection(db: TeacherPortalData, deck: DeckRef): CoachingSection | undefined {
  const inst = db.coaching_institutes.find((i) => i.id === deck.instituteId);
  return inst?.classes_sections.find((s) => s.id === deck.id);
}

function findBatch(db: TeacherPortalData, id: string): PrivateBatch | undefined {
  return db.private_batches.find((b) => b.id === id);
}

function deckStudentIds(db: TeacherPortalData, deck: DeckRef): string[] | undefined {
  return deck.type === 'private_batch' ? findBatch(db, deck.id)?.student_ids : findSection(db, deck)?.student_ids;
}

/** Next free SA-xxx roll number across the whole directory. */
export function nextRollNumber(students: Student[]): string {
  const max = students.reduce((m, s) => {
    const n = parseInt(s.roll.match(/\d+/)?.[0] ?? '0', 10);
    return n > m ? n : m;
  }, 100);
  return `SA-${max + 1}`;
}

function newStudent(db: TeacherPortalData, input: NewStudentInput): Student {
  const month = todayIso().slice(0, 7);
  const ledger: Record<string, FeeLedgerEntry> = input.current_month_paid
    ? {
        [month]: {
          status: 'paid',
          amount: input.monthly_fee,
          paid_date: todayIso(),
          payment_mode: 'Cash / Offline Desk',
          receipt_ref: null,
        },
      }
    : {};
  return {
    id: uid('student'),
    name: input.name,
    roll: input.roll,
    grade: input.grade,
    board: input.board,
    phone: input.father_phone,
    father_name: input.father_name,
    father_phone: input.father_phone,
    father_phone_verified: true,
    mother_name: input.mother_name,
    mother_phone: input.mother_phone,
    mother_phone_verified: Boolean(input.mother_phone),
    guardian_name: input.guardian_name,
    guardian_phone: input.guardian_phone,
    guardian_phone_verified: Boolean(input.guardian_phone),
    points: input.welcome_points,
    streak: 1,
    attendance_rate: 100,
    custom_monthly_fee: input.monthly_fee,
    admission_start_month: month,
    course_end_month: '2027-03',
    fee_ledger: ledger,
    photo_initials: initialsOf(input.name) || 'ST',
    avatar_gradient: AVATAR_GRADIENTS[db.students.length % AVATAR_GRADIENTS.length],
  };
}

function enroll(db: TeacherPortalData, deck: DeckRef, student: Student) {
  db.students.push(student);
  deckStudentIds(db, deck)?.unshift(student.id);
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      db: freshSeed(),

      teacherId: DEFAULT_TEACHER_ID,
      setTeacher: (teacherId) => set({ teacherId }),

      themeMode: 'light',
      setThemeMode: (themeMode) => set({ themeMode }),

      createBatch: (input) => {
        const id = uid('pbatch');
        const gradeDigits = input.grade.replace(/\D/g, '') || '10';
        set((s) => ({
          db: edit(s.db, (db) => {
            db.private_batches.push({
              id,
              teacher_id: s.teacherId,
              join_code: `VLR-M${gradeDigits}-${Math.floor(1000 + Math.random() * 9000)}`,
              weekly_schedule: emptySchedule(),
              created_date: todayIso(),
              student_ids: [],
              ...input,
            });
          }),
        }));
        return id;
      },

      updateDeckSettings: (deck, patch) =>
        set((s) => ({
          db: edit(s.db, (db) => {
            if (deck.type === 'private_batch') {
              const batch = findBatch(db, deck.id);
              if (batch) Object.assign(batch, patch);
            } else {
              const sec = findSection(db, deck);
              if (sec) {
                sec.full_code = patch.name;
                sec.room = patch.room;
                sec.weekly_schedule = patch.weekly_schedule;
              }
            }
          }),
        })),

      createInstitute: (input) => {
        const code = input.code.trim().toUpperCase();
        if (get().db.coaching_institutes.some((i) => i.code === code)) {
          return { ok: false, message: `Code ${code} is already taken by another institute.` };
        }
        const id = uid('inst');
        const teacher = get().db.teachers.find((t) => t.id === get().teacherId);
        set((s) => ({
          db: edit(s.db, (db) => {
            db.coaching_institutes.push({
              id,
              name: input.name.trim(),
              tagline: input.tagline.trim() || 'Coaching Institute',
              code,
              logo_text: initialsOf(input.name) || input.name.slice(0, 2).toUpperCase(),
              theme_color: '#800020',
              address: input.address.trim(),
              phone: teacher?.phone ?? '',
              email: teacher?.email ?? '',
              established: new Date().getFullYear(),
              owner_teacher_id: s.teacherId,
              member_permissions: {
                can_manage_members: false,
                can_create_sections: false,
                can_manage_fees: true,
                can_issue_marksheets: false,
              },
              members: [
                {
                  teacher_id: s.teacherId,
                  role: `Director & Head of ${teacher?.primary_subject ?? 'Academics'}`,
                  permission_level: 'Owner / Full Admin',
                  assigned_subjects: [teacher?.primary_subject ?? 'General'],
                  joined_date: monthYear(),
                  assigned_sections: [],
                },
              ],
              notices: [],
              classes_sections: [],
            });
          }),
        }));
        return { ok: true, message: `Created ${input.name.trim()} · code ${code}`, id };
      },

      joinInstituteByCode: (raw) => {
        const code = raw.trim().toUpperCase();
        const inst = get().db.coaching_institutes.find((i) => i.code === code);
        if (!inst) return { ok: false, message: `No coaching institute found for code "${code}".` };
        const me = get().teacherId;
        if (inst.owner_teacher_id === me || inst.members.some((m) => m.teacher_id === me)) {
          return { ok: false, message: `You are already part of ${inst.name}.`, id: inst.id };
        }
        const teacher = get().db.teachers.find((t) => t.id === me);
        set((s) => ({
          db: edit(s.db, (db) => {
            db.coaching_institutes
              .find((i) => i.id === inst.id)
              ?.members.push({
                teacher_id: me,
                role: `Visiting Faculty - ${teacher?.primary_subject ?? 'Subject'}`,
                permission_level: 'Faculty / Subject Teacher',
                assigned_subjects: [teacher?.primary_subject ?? 'Subject'],
                joined_date: monthYear(),
                assigned_sections: [],
              });
          }),
        }));
        return { ok: true, message: `Joined ${inst.name} as visiting faculty.`, id: inst.id };
      },

      updateInstitute: (id, patch) =>
        set((s) => ({
          db: edit(s.db, (db) => {
            const inst = db.coaching_institutes.find((i) => i.id === id);
            if (inst) Object.assign(inst, patch);
          }),
        })),

      addSection: (instituteId, input) =>
        set((s) => ({
          db: edit(s.db, (db) => {
            const inst = db.coaching_institutes.find((i) => i.id === instituteId);
            if (!inst) return;
            const letter = input.section_name.replace(/^section\s*/i, '').trim() || 'A';
            const fullCode = `${input.class_name}-${letter}`;
            inst.classes_sections.push({
              id: uid('sec'),
              class_name: input.class_name,
              section_name: `Section ${letter}`,
              full_code: fullCode,
              board: input.board,
              room: input.room,
              capacity: input.capacity,
              subject_faculty_map: [
                { subject: input.subject, teacher_id: s.teacherId, lectures_per_week: 3, schedule: 'Mon, Wed, Fri • 05:00 PM' },
              ],
              student_ids: [],
            });
            const member = inst.members.find((m) => m.teacher_id === s.teacherId);
            member?.assigned_sections.push(fullCode);
          }),
        })),

      inviteMember: (instituteId, input) =>
        set((s) => ({
          db: edit(s.db, (db) => {
            const inst = db.coaching_institutes.find((i) => i.id === instituteId);
            if (!inst) return;
            const teacherId = uid('teacher');
            db.teachers.push({
              id: teacherId,
              name: input.name,
              qualification: 'Invited faculty',
              primary_subject: input.subjects[0] ?? 'Subject',
              phone: input.contact.includes('@') ? '' : input.contact,
              email: input.contact.includes('@') ? input.contact : '',
              photo_initials: initialsOf(input.name) || 'TF',
              avatar_bg: '#0284C7',
            });
            inst.members.push({
              teacher_id: teacherId,
              role: input.role,
              permission_level: /admin|director/i.test(input.role)
                ? 'Co-Admin'
                : /lab|assistant/i.test(input.role)
                  ? 'Lab Instructor'
                  : 'Faculty / Subject Teacher',
              assigned_subjects: input.subjects,
              joined_date: monthYear(),
              assigned_sections: [],
            });
          }),
        })),

      removeMember: (instituteId, teacherId) =>
        set((s) => ({
          db: edit(s.db, (db) => {
            const inst = db.coaching_institutes.find((i) => i.id === instituteId);
            if (!inst || inst.owner_teacher_id === teacherId) return;
            inst.members = inst.members.filter((m) => m.teacher_id !== teacherId);
            for (const sec of inst.classes_sections) {
              sec.subject_faculty_map = sec.subject_faculty_map.filter((f) => f.teacher_id !== teacherId);
            }
          }),
        })),

      postNotice: (instituteId, input) =>
        set((s) => ({
          db: edit(s.db, (db) => {
            const inst = db.coaching_institutes.find((i) => i.id === instituteId);
            const author = db.teachers.find((t) => t.id === s.teacherId)?.name ?? 'Faculty';
            inst?.notices.unshift({
              id: uid('not'),
              title: input.title,
              category: input.category,
              target: input.target || 'All Students & Faculty',
              date: todayIso(),
              author,
              body: input.body,
            });
          }),
        })),

      deleteNotice: (instituteId, noticeId) =>
        set((s) => ({
          db: edit(s.db, (db) => {
            const inst = db.coaching_institutes.find((i) => i.id === instituteId);
            if (inst) inst.notices = inst.notices.filter((n) => n.id !== noticeId);
          }),
        })),

      enrollNewStudent: (deck, input) => {
        let id = '';
        set((s) => ({
          db: edit(s.db, (db) => {
            const student = newStudent(db, input);
            id = student.id;
            enroll(db, deck, student);
          }),
        }));
        return id;
      },

      simulateInviteJoin: (deck) => {
        let joinedName = '';
        set((s) => ({
          db: edit(s.db, (db) => {
            const taken = new Set(db.students.map((st) => st.name.toLowerCase()));
            const n = Math.floor(Math.random() * 900) + 100;
            const c = inviteJoiners.find((j) => !taken.has(j.name.toLowerCase())) ?? {
              name: `New Scholar #${n}`,
              father: `Guardian ${n}`,
              fPhone: `+91 98399 ${n}11`,
              mother: `Parent ${n}`,
              mPhone: `+91 98399 ${n}22`,
            };
            const batch = deck.type === 'private_batch' ? findBatch(db, deck.id) : undefined;
            const sec = deck.type === 'coaching_section' ? findSection(db, deck) : undefined;
            joinedName = c.name;
            enroll(
              db,
              deck,
              newStudent(db, {
                name: c.name,
                roll: nextRollNumber(db.students),
                grade: batch?.grade ?? sec?.class_name ?? 'Class 10',
                board: batch?.board ?? sec?.board ?? 'CBSE',
                father_name: c.father,
                father_phone: c.fPhone,
                mother_name: c.mother,
                mother_phone: c.mPhone,
                guardian_name: '',
                guardian_phone: '',
                monthly_fee: batch?.monthly_fee ?? 2500,
                current_month_paid: false,
                welcome_points: 500,
              }),
            );
          }),
        }));
        return joinedName;
      },

      removeStudentFromDeck: (deck, studentId) =>
        set((s) => ({
          db: edit(s.db, (db) => {
            if (deck.type === 'private_batch') {
              const batch = findBatch(db, deck.id);
              if (batch) batch.student_ids = batch.student_ids.filter((id) => id !== studentId);
            } else {
              const sec = findSection(db, deck);
              if (sec) sec.student_ids = sec.student_ids.filter((id) => id !== studentId);
            }
          }),
        })),

      addExtraClass: (deckId, input) =>
        set((s) => ({
          db: edit(s.db, (db) => {
            // An extra class on a cancelled date simply reinstates it.
            db.class_exceptions = db.class_exceptions.filter(
              (x) => !(x.context_id === deckId && x.date === input.date && x.kind === 'cancelled'),
            );
            db.class_exceptions.push({ id: uid('cx'), context_id: deckId, kind: 'extra', ...input });
          }),
        })),

      cancelClass: (deckId, date, note) =>
        set((s) => ({
          db: edit(s.db, (db) => {
            const already = db.class_exceptions.some((x) => x.context_id === deckId && x.date === date && x.kind === 'cancelled');
            if (already) return;
            db.class_exceptions.push({ id: uid('cx'), context_id: deckId, date, kind: 'cancelled', start_time: null, end_time: null, note });
          }),
        })),

      removeClassException: (id) =>
        set((s) => ({
          db: edit(s.db, (db) => {
            db.class_exceptions = db.class_exceptions.filter((x) => x.id !== id);
          }),
        })),

      assignHomework: (deckId, input) => {
        const id = uid('hw');
        set((s) => ({
          db: edit(s.db, (db) => {
            db.homework.push({ id, context_id: deckId, checked_date: null, records: {}, ...input });
          }),
        }));
        return id;
      },

      checkHomework: (homeworkId, records, checkedDate) =>
        set((s) => ({
          db: edit(s.db, (db) => {
            const h = db.homework.find((x) => x.id === homeworkId);
            if (!h) return;
            h.records = records;
            h.checked_date = checkedDate;
          }),
        })),

      deleteHomework: (homeworkId) =>
        set((s) => ({
          db: edit(s.db, (db) => {
            db.homework = db.homework.filter((x) => x.id !== homeworkId);
          }),
        })),

      saveAttendance: (deckId, date, topic, records) =>
        set((s) => ({
          db: edit(s.db, (db) => {
            const existing = db.attendance_sessions.find((a) => a.context_id === deckId && a.date === date);
            if (existing) {
              existing.records = records;
              existing.topic_covered = topic;
            } else {
              db.attendance_sessions.push({
                id: `att-${deckId}-${date.replace(/-/g, '')}`,
                context_id: deckId,
                date,
                topic_covered: topic,
                records,
              });
            }
          }),
        })),

      awardPoints: (deck, deckTitle, studentId, points, category, citation) =>
        set((s) => ({
          db: edit(s.db, (db) => {
            const student = db.students.find((st) => st.id === studentId);
            const teacher = db.teachers.find((t) => t.id === s.teacherId);
            if (!student) return;
            student.points += points;
            db.points_dispatches.unshift({
              id: uid('disp'),
              date: todayIso(),
              context_type: deck.type,
              context_id: deck.id,
              context_title: deckTitle,
              teacher_id: s.teacherId,
              teacher_name: teacher?.name ?? 'Faculty',
              student_id: student.id,
              student_name: student.name,
              points,
              category,
              citation,
            });
          }),
        })),

      scheduleTest: (deckId, input) => {
        const id = uid('test');
        set((s) => ({
          db: edit(s.db, (db) => {
            const roster =
              db.private_batches.find((b) => b.id === deckId)?.student_ids ??
              db.coaching_institutes.flatMap((i) => i.classes_sections).find((sec) => sec.id === deckId)?.student_ids ??
              [];
            db.tests.unshift({
              id,
              context_id: deckId,
              title: input.title,
              subject: input.subject,
              max_marks: input.max_marks,
              conducted_date: input.date,
              submissions: roster.map((student_id) => ({ student_id, marks: null, status: 'pending', weak_topics: '' })),
            });
          }),
        }));
        return id;
      },

      saveScorecard: (testId, submissions) =>
        set((s) => ({
          db: edit(s.db, (db) => {
            const test = db.tests.find((t) => t.id === testId);
            if (test) test.submissions = submissions;
          }),
        })),

      deleteTest: (testId) =>
        set((s) => ({
          db: edit(s.db, (db) => {
            db.tests = db.tests.filter((t) => t.id !== testId);
          }),
        })),

      addTopic: (deckId, input) =>
        set((s) => ({
          db: edit(s.db, (db) => {
            db.syllabus_topics.push({
              id: uid('syl'),
              context_id: deckId,
              actual_completion_date: input.status === 'covered' ? todayIso() : null,
              revised_count: 0,
              ...input,
            });
          }),
        })),

      cycleTopicStatus: (topicId) => {
        const current = get().db.syllabus_topics.find((t) => t.id === topicId);
        if (!current) return null;
        // upcoming → in progress → covered → upcoming
        const next: SyllabusStatus =
          current.status === 'upcoming' ? 'in_progress' : current.status === 'in_progress' ? 'covered' : 'upcoming';
        set((s) => ({
          db: edit(s.db, (db) => {
            const t = db.syllabus_topics.find((x) => x.id === topicId);
            if (!t) return;
            t.status = next;
            t.actual_completion_date = next === 'covered' ? todayIso() : null;
          }),
        }));
        return next;
      },

      removeTopic: (topicId) =>
        set((s) => ({
          db: edit(s.db, (db) => {
            db.syllabus_topics = db.syllabus_topics.filter((t) => t.id !== topicId);
          }),
        })),

      recordPayment: (studentId, monthKey, entry) =>
        set((s) => ({
          db: edit(s.db, (db) => {
            const student = db.students.find((st) => st.id === studentId);
            if (student) student.fee_ledger[monthKey] = { status: 'paid', ...entry };
          }),
        })),

      configureStudentFee: (studentId, monthlyFee, startMonth, endMonth) =>
        set((s) => ({
          db: edit(s.db, (db) => {
            const student = db.students.find((st) => st.id === studentId);
            if (!student) return;
            student.custom_monthly_fee = monthlyFee;
            student.admission_start_month = startMonth;
            student.course_end_month = endMonth;
            // Unpaid months follow the new fee; settled months keep what was paid.
            for (const entry of Object.values(student.fee_ledger)) {
              if (entry.status !== 'paid') entry.amount = monthlyFee;
            }
          }),
        })),

      resetDemo: () => set({ db: freshSeed(), teacherId: DEFAULT_TEACHER_ID }),
    }),
    {
      name: 'vilarci_teacher_state_v1',
      storage: createJSONStorage(() => AsyncStorage),
      // v3: class calendar, homework and realistic weekly timetables. Older
      // demo data is reseeded; preferences and the signed-in teacher are kept.
      version: 3,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<AppState>;
        return (version < 3 ? { ...state, db: freshSeed() } : state) as AppState;
      },
      partialize: (s) => ({ db: s.db, teacherId: s.teacherId, themeMode: s.themeMode }),
    },
  ),
);
