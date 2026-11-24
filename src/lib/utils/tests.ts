// Tests and marks, worked out on the phone (new-db-plan.md §6–§7). This file
// is the same in the student and teacher apps — keep the two copies in step.
//
// A test is one row (batch_tests: title, subject, held_on, max_marks and a
// small `summary` the teacher's phone works out). A student's mark lives in
// their month row (enrolment_months.score[testId] = number | "AB"), normally
// the month the test was held. Parents only receive their own child's marks,
// so the class average and highest come from the summary — never names.
import type { BatchTest, EnrolmentMonth } from '../local/types';

export type Score = number | 'AB';

/** What the teacher's phone saves on the test for everyone to see. */
export interface TestSummary {
  /** Students with marks (not absent). */
  n: number;
  /** Marked absent. */
  ab: number;
  avg: number | null;
  high: number | null;
  low: number | null;
}

export const TEST_TITLE_MAX = 60;
export const TEST_SUBJECT_MAX = 40;
export const MAX_MARKS_LIMIT = 1000;
export const MAX_MARKS_PRESETS = [10, 20, 25, 50, 100];

/** Rounded to 2 decimals (what the server keeps). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 42 → "42", 42.5 → "42.5", 42.25 → "42.25" */
export function formatMarks(n: number): string {
  return String(round2(n));
}

/** "42" → 42, "ab" → "AB", "" → null; or an error to show. */
export function parseScore(text: string, max: number): { value: Score | null } | { error: string } {
  const t = text.trim();
  if (!t) return { value: null };
  if (/^ab$/i.test(t)) return { value: 'AB' };
  const n = Number(t.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return { error: 'Enter marks or AB' };
  if (n > max) return { error: `Out of ${formatMarks(max)}` };
  if (round2(n) !== n) return { error: 'Up to 2 decimals' };
  return { value: n };
}

/** A student's mark for a test: searched in every month (a test whose date moved still works). */
export function scoreOf(months: Record<string, EnrolmentMonth> | undefined, testId: string): Score | null {
  if (!months) return null;
  for (const row of Object.values(months)) {
    const v = row.score?.[testId];
    if (v === 'AB' || typeof v === 'number') return v;
  }
  return null;
}

/** Which month row holds (or should hold) a student's mark for a test. */
export function scoreMonthOf(months: Record<string, EnrolmentMonth> | undefined, testId: string, heldOn: string): string {
  for (const [month, row] of Object.entries(months ?? {})) {
    if (row.score && testId in row.score) return month;
  }
  return heldOn.slice(0, 7);
}

/** Count, average, highest and lowest of the marks given (AB counted apart). */
export function summarize(scores: (Score | null)[]): TestSummary {
  const marks = scores.filter((s): s is number => typeof s === 'number');
  const ab = scores.filter((s) => s === 'AB').length;
  if (!marks.length) return { n: 0, ab, avg: null, high: null, low: null };
  return {
    n: marks.length,
    ab,
    avg: round2(marks.reduce((a, b) => a + b, 0) / marks.length),
    high: Math.max(...marks),
    low: Math.min(...marks),
  };
}

/** The summary saved on a test, if it looks like one. */
export function summaryOf(test: Pick<BatchTest, 'summary'>): TestSummary | null {
  const s = test.summary as Partial<TestSummary> | null;
  return s && typeof s.n === 'number' ? (s as TestSummary) : null;
}

/** 42 of 50 → 84 (whole %); null when there's no number. */
export function scorePercent(score: Score | null, max: number): number | null {
  return typeof score === 'number' && max > 0 ? Math.round((score / max) * 100) : null;
}

/** Newest test first (by date, then by when it was made). */
export function sortTests<T extends Pick<BatchTest, 'held_on'> & { created_at?: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => b.held_on.localeCompare(a.held_on) || (b.created_at ?? 0) - (a.created_at ?? 0));
}

/** A student's average percentage over the tests they have marks in (absences left out). */
export function averagePercent(entries: { score: Score | null; max: number }[]): number | null {
  const pcts = entries.map((e) => scorePercent(e.score, e.max)).filter((p): p is number => p != null);
  return pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
}
