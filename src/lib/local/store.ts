// What the screens read: the phone's copy (SQLite) held in memory, indexed
// for the screens, with the teacher's unsent edits (the outbox) laid on top so
// they show at once, online or not. Filled from SQLite when an account opens,
// after every local edit and after every sync; screens never wait for the network.
import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';
import { OutboxLine, readAll } from './repo';
import { sortNotices } from '../utils/notices';
import { sortTests } from '../utils/tests';
import type {
  AccountSnapshot,
  Batch,
  BatchMonth,
  BatchNotice,
  BatchTest,
  Enrolment,
  EnrolmentMonth,
  MonthPatch,
} from './types';

export interface LocalState {
  /** The phone's copy has been read (it may still be empty on a new phone). */
  ready: boolean;
  account: AccountSnapshot | null;
  batches: Record<string, Batch>;
  /** batch id → month → row */
  batchMonths: Record<string, Record<string, BatchMonth>>;
  tests: Record<string, BatchTest[]>;
  notices: Record<string, BatchNotice[]>;
  /** batch id → its students and requests */
  enrolments: Record<string, Enrolment[]>;
  /** enrolment id → month → row */
  months: Record<string, Record<string, EnrolmentMonth>>;
  /** Edits on this phone the server doesn't have yet. */
  pending: number;
  syncing: boolean;
  lastSyncedAt: number | null;
  /** Why the last sync failed, or null. */
  syncError: string | null;
  /** An edit the server turned down (shown once, then cleared). */
  refused: string | null;
}

const EMPTY: LocalState = {
  ready: false,
  account: null,
  batches: {},
  batchMonths: {},
  tests: {},
  notices: {},
  enrolments: {},
  months: {},
  pending: 0,
  syncing: false,
  lastSyncedAt: null,
  syncError: null,
  refused: null,
};

export const useLocalStore = create<LocalState>(() => EMPTY);

/** Signed out: nothing in memory. */
export function resetLocalStore(): void {
  useLocalStore.setState(EMPTY, true);
}

function group<T, K extends string>(rows: T[], key: (r: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const r of rows) (out[key(r)] ??= []).push(r);
  return out;
}

function index<T>(rows: T[], outer: (r: T) => string, inner: (r: T) => string): Record<string, Record<string, T>> {
  const out: Record<string, Record<string, T>> = {};
  for (const r of rows) (out[outer(r)] ??= {})[inner(r)] = r;
  return out;
}

/** A map with a patch applied: null removes a key. */
function patchMap<V>(base: Record<string, V>, patch: Record<string, V | null> | undefined): Record<string, V> {
  if (!patch) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = v;
  }
  return out;
}

function patchMonth(row: EnrolmentMonth, p: MonthPatch): EnrolmentMonth {
  return {
    ...row,
    att: patchMap(row.att, p.att),
    score: patchMap(row.score, p.score),
    fee: 'fee' in p ? p.fee ?? null : row.fee,
    remark: 'remark' in p ? p.remark ?? null : row.remark,
  };
}

/** Unsent whole-row edits (tests, notices) over the server's rows; `pending` marks them. */
function overlayRows<T extends { batch_id: string; id: string; pending?: boolean }>(
  list: T[],
  c: { b: string; id: string; at: number } & ({ deleted: true } | { data: object }),
  fresh: (c: { b: string; id: string; at: number }) => T,
): T[] {
  const at = list.findIndex((r) => r.batch_id === c.b && r.id === c.id);
  if ('deleted' in c) return at >= 0 ? list.filter((_, i) => i !== at) : list;
  const next = { ...(at >= 0 ? list[at] : fresh(c)), ...c.data, pending: true } as T;
  return at >= 0 ? list.map((r, i) => (i === at ? next : r)) : [...list, next];
}

/**
 * The outbox over the server's rows, so the teacher sees their edits straight
 * away. Returns the notices and tests with unsent posts, edits and deletes applied.
 */
function overlay(
  batches: Record<string, Batch>,
  batchMonths: Record<string, Record<string, BatchMonth>>,
  months: Record<string, Record<string, EnrolmentMonth>>,
  notices: BatchNotice[],
  tests: BatchTest[],
  outbox: OutboxLine[],
): { notices: BatchNotice[]; tests: BatchTest[] } {
  let list = notices;
  let testList = tests;
  for (const { change: c } of outbox) {
    if (c.t === 'batch_tests') {
      testList = overlayRows(testList, c, (x) => ({
        batch_id: x.b,
        id: x.id,
        title: '',
        subject: null,
        held_on: '',
        max_marks: 0,
        summary: null,
        created_at: x.at,
        deleted_at: null,
        seq: 0,
      }));
      continue;
    }
    if (c.t === 'batches') {
      const b = batches[c.b];
      if (b) batches[c.b] = { ...b, ...c.data };
    } else if (c.t === 'batch_months') {
      const byMonth = (batchMonths[c.b] ??= {});
      const row = byMonth[c.m] ?? { batch_id: c.b, month: c.m, sessions: {}, seq: 0 };
      byMonth[c.m] = { ...row, sessions: patchMap(row.sessions, c.patch.sessions) };
    } else if (c.t === 'batch_notices') {
      list = overlayRows(list, c, (x) => ({
        batch_id: x.b,
        id: x.id,
        body: '',
        pinned: false,
        created_at: x.at,
        deleted_at: null,
        seq: 0,
      }));
    } else {
      const byMonth = (months[c.e] ??= {});
      const row = byMonth[c.m] ?? { enrolment_id: c.e, month: c.m, batch_id: c.b, att: {}, fee: null, score: {}, remark: null, seq: 0 };
      byMonth[c.m] = patchMonth(row, c.patch);
    }
  }
  return { notices: list, tests: testList };
}

/** Re-read the phone's copy into memory. */
export async function loadLocalStore(db: SQLiteDatabase): Promise<void> {
  const rows = await readAll(db);
  const batches = Object.fromEntries(rows.batches.map((b) => [b.id, b]));
  const batchMonths = index(rows.batchMonths, (r) => r.batch_id, (r) => r.month);
  const months = index(rows.months, (r) => r.enrolment_id, (r) => r.month);
  const { notices, tests } = overlay(batches, batchMonths, months, rows.notices, rows.tests, rows.outbox);
  useLocalStore.setState({
    ready: true,
    account: rows.account,
    lastSyncedAt: rows.syncedAt,
    batches,
    batchMonths,
    tests: group(sortTests(tests), (r) => r.batch_id),
    notices: group(sortNotices(notices), (r) => r.batch_id),
    enrolments: group(
      rows.enrolments.sort((a, b) => a.requested_at - b.requested_at),
      (r) => r.batch_id,
    ),
    months,
    pending: rows.outbox.length,
  });
}
