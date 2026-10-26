import type { DayKey, WeeklySchedule } from '../data/types';

export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

/** JS getDay() (0 = Sunday) to the schedule's day key. */
export function dayKeyOf(date: Date): DayKey {
  return (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[date.getDay()];
}

export function isClosed(value?: string | null): boolean {
  return !value || value.trim().toLowerCase() === 'closed';
}

/** '09:00 AM - 05:00 PM' -> { start: '09:00 AM', end: '05:00 PM' } */
export function parseRange(value?: string | null): { start: string; end: string } | null {
  if (isClosed(value)) return null;
  const parts = (value as string).split(/\s*[-–]\s*/);
  if (parts.length < 2) return { start: parts[0].trim(), end: '' };
  return { start: parts[0].trim(), end: parts[1].trim() };
}

/** '05:30 PM' -> minutes since midnight. Unparseable values sort last. */
export function clockMinutes(label: string): number {
  const m = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return 24 * 60;
  let h = Number(m[1]) % 12;
  if (m[3]?.toUpperCase() === 'PM') h += 12;
  if (!m[3] && Number(m[1]) === 12) h = 12;
  return h * 60 + Number(m[2]);
}

/** Loose check for an 'HH:MM AM' clock label typed by a teacher. */
export function isClockLabel(label: string): boolean {
  return /^(0?[1-9]|1[0-2]):[0-5]\d\s?(AM|PM)$/i.test(label.trim());
}

/**
 * Human summary grouped by identical hours:
 * "Mon, Wed, Fri · 9:00 AM – 5:00 PM  /  Sat · 9:00 AM – 2:00 PM"
 */
export function summarizeSchedule(schedule?: WeeklySchedule | null): string {
  if (!schedule) return 'Schedule not set';
  const groups = new Map<string, DayKey[]>();
  for (const d of DAY_KEYS) {
    const value = schedule[d];
    if (isClosed(value)) continue;
    const key = value.replace(/\s*[-–]\s*/, ' – ');
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  if (!groups.size) return 'No class days set';
  return [...groups.entries()].map(([time, days]) => `${days.map((d) => DAY_LABELS[d]).join(', ')} · ${time}`).join('  /  ');
}

export function activeDayCount(schedule?: WeeklySchedule | null): number {
  return schedule ? DAY_KEYS.filter((d) => !isClosed(schedule[d])).length : 0;
}

/**
 * Coaching faculty slots are free text: 'Mon, Wed, Fri • 07:30 AM',
 * 'Sat & Sun • 10:00 AM', 'Daily • 06:00 PM'. Daily means Mon–Sat.
 */
export function parseFacultySlot(text: string): { days: DayKey[]; time: string } {
  const [dayPart, timePart = ''] = text.split('•').map((p) => p.trim());
  if (/daily/i.test(dayPart)) return { days: DAY_KEYS.slice(0, 6), time: timePart };
  const days = (dayPart.match(/mon|tue|wed|thu|fri|sat|sun/gi) ?? []).map((d) => d.toLowerCase() as DayKey);
  return { days, time: timePart };
}

/** Minutes since midnight -> '07:30 PM'. */
export function clockLabel(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m % 60).padStart(2, '0')} ${period}`;
}

/** '07:00 PM' + 60 -> '08:00 PM' */
export function addMinutes(label: string, minutes: number): string {
  return clockLabel(clockMinutes(label) + minutes);
}
