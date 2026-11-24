// Notices: the teacher posts, parents read (new-db-plan.md §7). This file is
// the same in the student and teacher apps — keep the two copies in step.
// A notice is one whole row (body + pinned); the latest edit wins.
import type { BatchNotice } from '../local/types';

/** The server takes 1 to 1000 characters (after trimming). */
export const NOTICE_MAX = 1000;

/** Why a notice can't be posted, or null. */
export function noticeProblem(body: string): string | null {
  const n = body.trim().length;
  if (!n) return 'Write the notice first.';
  if (n > NOTICE_MAX) return `Keep it to ${NOTICE_MAX} characters.`;
  return null;
}

/** Pinned first, then newest first. */
export function sortNotices<T extends Pick<BatchNotice, 'pinned' | 'created_at'>>(list: T[]): T[] {
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at - a.created_at);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function clock(d: Date): string {
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Today, 5:10 PM" · "Yesterday, 9:02 AM" · "24 Nov, 5:10 PM" · "24 Nov 2025" */
export function noticeTime(ms: number, now = new Date()): string {
  const d = new Date(ms);
  if (sameDay(d, now)) return `Today, ${clock(d)}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(d, yesterday)) return `Yesterday, ${clock(d)}`;
  if (d.getFullYear() === now.getFullYear()) return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${clock(d)}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
