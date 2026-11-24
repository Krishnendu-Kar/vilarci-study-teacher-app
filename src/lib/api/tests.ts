// Tests and marks for the teacher, from the phone's copy. Everything is saved
// on the phone and uploaded by sync (works with no signal):
// - the test:   batch_tests row (title, subject, held_on, max_marks, summary) — whole row, latest edit wins
// - each mark:  enrolment_months.score[testId] = number | "AB" | null (cleared)
// The outbox sends tests before marks (the server only takes marks for a test
// it has). Every mark change also re-saves the test's summary (count,
// average, highest, lowest, absent) — the only class figures parents see.
import * as Crypto from 'expo-crypto';
import { useLocalStore } from '../local/store';
import type { BatchTest, Enrolment, EnrolmentMonth, TestFields } from '../local/types';
import { saveEdits } from '../sync/engine';
import {
  MAX_MARKS_LIMIT,
  round2,
  Score,
  scoreMonthOf,
  scoreOf,
  summarize,
  TEST_SUBJECT_MAX,
  TEST_TITLE_MAX,
  TestSummary,
} from '../utils/tests';
import { studentName } from './privateBatches';

const NONE: BatchTest[] = [];

/** A batch's tests, newest first (with this phone's unsent changes). */
export function useBatchTests(batchId: string | undefined): BatchTest[] {
  return useLocalStore((s) => (batchId ? s.tests[batchId] ?? NONE : NONE));
}

export interface TestInput {
  title: string;
  subject: string | null;
  held_on: string;
  max_marks: number;
}

/** Why a test can't be saved, or null. `highest` = the top mark already given (max can't go below it). */
export function testProblem(input: TestInput, highest?: number | null): string | null {
  const title = input.title.trim();
  if (!title) return 'Give the test a name.';
  if (title.length > TEST_TITLE_MAX) return `Keep the name to ${TEST_TITLE_MAX} characters.`;
  if ((input.subject ?? '').trim().length > TEST_SUBJECT_MAX) return `Keep the subject to ${TEST_SUBJECT_MAX} characters.`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.held_on)) return 'Choose the date.';
  const m = input.max_marks;
  if (!Number.isFinite(m) || m <= 0 || m > MAX_MARKS_LIMIT) return `Max marks: above 0, up to ${MAX_MARKS_LIMIT}.`;
  if (round2(m) !== m) return 'Max marks: up to 2 decimals.';
  if (highest != null && m < highest) return `A student already has ${highest}. Max marks can’t be lower.`;
  return null;
}

function fieldsOf(t: TestInput, summary: TestSummary | Record<string, unknown> | null): TestFields {
  return {
    title: t.title.trim(),
    subject: t.subject?.trim() || null,
    held_on: t.held_on,
    max_marks: t.max_marks,
    summary: summary as Record<string, unknown> | null,
  };
}

/**
 * Students on a test's mark sheet: everyone in the batch now, plus anyone who
 * left later but already has a mark for it. Sorted by name.
 */
export function rosterForTest(
  roster: Enrolment[],
  months: Record<string, Record<string, EnrolmentMonth>>,
  testId: string,
): Enrolment[] {
  return roster
    .filter((r) => (r.status === 'approved' && r.joined_month != null) || scoreOf(months[r.id], testId) != null)
    .sort((a, b) => studentName(a).localeCompare(studentName(b)));
}

/** Make a test (its id is made here, so it works offline). Returns the id. */
export async function createTest(batchId: string, input: TestInput): Promise<string> {
  const problem = testProblem(input);
  if (problem) throw new Error(problem);
  const id = Crypto.randomUUID();
  await saveEdits([{ t: 'batch_tests', b: batchId, id, data: fieldsOf(input, null) }]);
  return id;
}

/** Change a test's name, subject, date or max marks (the summary stays). */
export function updateTest(test: BatchTest, input: TestInput, highest: number | null): Promise<void> {
  const problem = testProblem(input, highest);
  if (problem) return Promise.reject(new Error(problem));
  return saveEdits([{ t: 'batch_tests', b: test.batch_id, id: test.id, data: fieldsOf(input, test.summary) }]);
}

/**
 * Save one student's mark (number, "AB" or null to clear) and the class
 * summary in one go. `classScores` = every mark on the sheet, this one included.
 */
export function saveScore(
  test: BatchTest,
  enrolmentId: string,
  value: Score | null,
  studentMonths: Record<string, EnrolmentMonth> | undefined,
  classScores: (Score | null)[],
): Promise<void> {
  const month = scoreMonthOf(studentMonths, test.id, test.held_on);
  return saveEdits([
    { t: 'enrolment_months', b: test.batch_id, e: enrolmentId, m: month, patch: { score: { [test.id]: value } } },
    { t: 'batch_tests', b: test.batch_id, id: test.id, data: fieldsOf(test, summarize(classScores)) },
  ]);
}

/** Delete a test and clear its marks (so no unsent mark points at a test that's gone). */
export function deleteTest(
  test: BatchTest,
  roster: Enrolment[],
  months: Record<string, Record<string, EnrolmentMonth>>,
): Promise<void> {
  const clears = roster
    .filter((r) => scoreOf(months[r.id], test.id) != null)
    .map((r) => ({
      t: 'enrolment_months' as const,
      b: test.batch_id,
      e: r.id,
      m: scoreMonthOf(months[r.id], test.id, test.held_on),
      patch: { score: { [test.id]: null } },
    }));
  return saveEdits([{ t: 'batch_tests', b: test.batch_id, id: test.id, deleted: true }, ...clears]);
}

export function describeTestError(err: unknown): string {
  return String((err as Error)?.message ?? '') || 'Couldn’t save. Please try again.';
}
