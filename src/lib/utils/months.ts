// Month arithmetic for course durations and fee ledgers. A month is stored and
// passed around as its first day, "YYYY-MM-01".

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthKey(year: number, monthIndex: number): string {
  const d = new Date(year, monthIndex, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function currentMonth(now = new Date()): string {
  return monthKey(now.getFullYear(), now.getMonth());
}

export function addMonths(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  return monthKey(y, m - 1 + delta);
}

/** "2026-04-01" → "Apr 2026" */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${SHORT[m - 1]} ${y}`;
}

/** Inclusive list of months from start to end. */
export function monthsBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let k = start; k <= end && out.length < 60; k = addMonths(k, 1)) out.push(k);
  return out;
}

/** "Apr 2026 – Mar 2027 · 12 months" */
export function courseLabel(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const n = monthsBetween(start, end).length;
  return `${monthLabel(start)} – ${monthLabel(end)} · ${n} month${n === 1 ? '' : 's'}`;
}
