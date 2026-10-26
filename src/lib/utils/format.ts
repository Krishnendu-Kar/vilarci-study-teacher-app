const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAYS_LONG = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

/** Indian rupee, grouped lakh-style: 1,24,500 */
export function rupees(amount: number, withSymbol = true): string {
  const whole = Math.round(Math.abs(amount)).toString();
  let grouped: string;
  if (whole.length <= 3) {
    grouped = whole;
  } else {
    const last3 = whole.slice(-3);
    const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    grouped = `${rest},${last3}`;
  }
  const sign = amount < 0 ? '-' : '';
  return `${sign}${withSymbol ? '₹' : ''}${grouped}`;
}

export function compactNumber(n: number): string {
  return n.toLocaleString('en-IN');
}

/** '2025-10-14' -> '14 Oct 2025' */
export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/** '2025-10-14' -> '14 Oct' */
export function formatDateShort(iso?: string | null): string {
  if (!iso) return '—';
  const [, m, d] = iso.split('-').map(Number);
  if (!m || !d) return iso;
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

/** '2025-10-14' -> 'Tue, 14 October 2025' */
export function formatDateLong(iso?: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${weekday}, ${d} ${MONTHS_LONG[m - 1]} ${y}`;
}

/** '16:00' -> '4:00 PM' */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m ?? 0).padStart(2, '0')} ${period}`;
}

/** Minutes between two 'HH:MM' strings. */
export function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function percent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

/** Relative day label used across the timeline cards. */
export function relativeDay(iso: string, now = new Date()): string {
  const [y, m, d] = iso.split('-').map(Number);
  const then = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((then.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  return `in ${diff} days`;
}

export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function monthLabel(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function gradeFor(percentage: number): string {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  return 'D';
}

// ─── Billing months (YYYY-MM) ─────────────────────────────────────────────────

/** '2026-10' -> 'October 2026' */
export function monthKeyLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

/** '2026-10' -> 'Oct 26' */
export function monthKeyShort(key: string): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`;
}

/** 'Oct 2026' for audit trails such as a member's joining month. */
export function monthYear(now = new Date()): string {
  return `${MONTHS_SHORT[now.getMonth()]} ${now.getFullYear()}`;
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Inclusive list of month keys from start to end. */
export function monthRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let k = start; k <= end && out.length < 36; k = shiftMonth(k, 1)) out.push(k);
  return out;
}

/** Whole days from a to b (b - a), both ISO dates. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86400000);
}

export function shiftDate(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return todayIso(new Date(y, m - 1, d + delta));
}

/** 'Er. Alok Sharma' -> 'Alok' — greetings drop titles. */
export function firstNameOf(name: string): string {
  const parts = name.replace(/^(er|dr|prof|mrs|mr|ms|smt|shri)\.?\s+/i, '').split(/\s+/);
  return parts[0] ?? name;
}
