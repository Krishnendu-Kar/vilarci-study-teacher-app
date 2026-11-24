// What the screens read: the phone's copy (SQLite) held in memory, indexed
// for the screens, with the teacher's unsent edits (the outbox) laid on top so
// they show at once, online or not. Filled from SQLite when an account opens,
// after every local edit and after every sync; screens never wait for the network.
import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';
import { OutboxLine, readAll } from './repo';
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

/** The outbox over the server's rows, so the teacher sees their edits straight away. */
function overlay(
  batches: Record<string, Batch>,
  months: Record<string, Record<string, EnrolmentMonth>>,
  outbox: OutboxLine[],
): void {
  for (const { change: c } of outbox) {
    if (c.t === 'batches') {
      const b = batches[c.b];
      if (b) batches[c.b] = { ...b, ...c.data };
    } else {
      const byMonth = (months[c.e] ??= {});
      const row = byMonth[c.m] ?? { enrolment_id: c.e, month: c.m, batch_id: c.b, att: {}, fee: null, score: {}, remark: null, seq: 0 };
      byMonth[c.m] = patchMonth(row, c.patch);
    }
  }
}

/** Re-read the phone's copy into memory. */
export async function loadLocalStore(db: SQLiteDatabase): Promise<void> {
  const rows = await readAll(db);
  const batches = Object.fromEntries(rows.batches.map((b) => [b.id, b]));
  const months = index(rows.months, (r) => r.enrolment_id, (r) => r.month);
  overlay(batches, months, rows.outbox);
  useLocalStore.setState({
    ready: true,
    account: rows.account,
    lastSyncedAt: rows.syncedAt,
    batches,
    batchMonths: index(rows.batchMonths, (r) => r.batch_id, (r) => r.month),
    tests: group(rows.tests, (r) => r.batch_id),
    notices: group(
      rows.notices.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at - a.created_at),
      (r) => r.batch_id,
    ),
    enrolments: group(
      rows.enrolments.sort((a, b) => a.requested_at - b.requested_at),
      (r) => r.batch_id,
    ),
    months,
    pending: rows.outbox.length,
  });
}
