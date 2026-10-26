// Single assembled relational seed — the mobile equivalent of
// window.TEACHER_PORTAL_DATA. Screens never import these tables directly; the
// store clones this seed and src/lib/api reads from the store, so a later
// Supabase swap only touches the query layer.
import { teachers, privateBatches } from './teachers';
import { coachingInstitutes } from './institutes';
import { students } from './students';
import { attendanceSessions, classExceptions, homework, pointsDispatches, syllabusTopics, tests } from './records';
import type { TeacherPortalData } from './types';

export const SEED: TeacherPortalData = {
  teachers,
  private_batches: privateBatches,
  coaching_institutes: coachingInstitutes,
  students,
  points_dispatches: pointsDispatches,
  syllabus_topics: syllabusTopics,
  tests,
  attendance_sessions: attendanceSessions,
  class_exceptions: classExceptions,
  homework,
};

/** A deep copy so in-app edits never mutate the seed module. */
export function freshSeed(): TeacherPortalData {
  return JSON.parse(JSON.stringify(SEED));
}

export { DEFAULT_TEACHER_ID, emptySchedule } from './teachers';
export { AVATAR_GRADIENTS, inviteJoiners } from './students';
export * from './types';
