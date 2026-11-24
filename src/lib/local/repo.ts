// Reads and writes on the phone's copy (db.ts). The sync engine writes the
// server's rows; screens add edits to the outbox and read everything through
// the in-memory store (store.ts), which lays the outbox over the rows.
import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  AccountSnapshot,
  Batch,
  BatchMonth,
  BatchNotice,
  BatchPage,
  BatchTest,
  Change,
  Enrolment,
  EnrolmentMonth,
} from './types';

export async function readKv(db: SQLiteDatabase, k: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ v: string }>('SELECT v FROM kv WHERE k = ?', [k]);
  return row?.v ?? null;
}

export async function writeKv(db: SQLiteDatabase, k: string, v: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', [k, v]);
}

export async function readAccount(db: SQLiteDatabase): Promise<AccountSnapshot | null> {
  const v = await readKv(db, 'account');
  return v ? (JSON.parse(v) as AccountSnapshot) : null;
}

export async function readCursors(db: SQLiteDatabase): Promise<Map<string, number>> {
  const rows = await db.getAllAsync<{ batch_id: string; seq: number }>('SELECT batch_id, seq FROM cursors');
  return new Map(rows.map((r) => [r.batch_id, r.seq]));
}

export async function setCursor(db: SQLiteDatabase, batchId: string, seq: number): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO cursors (batch_id, seq, synced_at) VALUES (?, ?, ?)', [batchId, seq, Date.now()]);
}

export async function dropCursor(db: SQLiteDatabase, batchId: string): Promise<void> {
  await db.runAsync('DELETE FROM cursors WHERE batch_id = ?', [batchId]);
}

const BATCH_TABLES = [
  ['batches', 'id'],
  ['batch_months', 'batch_id'],
  ['batch_tests', 'batch_id'],
  ['batch_notices', 'batch_id'],
  ['enrolments', 'batch_id'],
  ['enrolment_months', 'batch_id'],
] as const;

/** Forget everything about one batch (before a full download). */
export async function clearBatch(db: SQLiteDatabase, batchId: string): Promise<void> {
  for (const [table, col] of BATCH_TABLES) {
    await db.runAsync(`DELETE FROM ${table} WHERE ${col} = ?`, [batchId]);
  }
}

/** Forget batches this account doesn't teach any more, with their unsent edits. */
export async function purgeBatchesExcept(db: SQLiteDatabase, keep: Set<string>): Promise<void> {
  const ids = [...keep];
  const notIn = ids.length ? `NOT IN (${ids.map(() => '?').join(', ')})` : 'IS NOT NULL';
  for (const [table, col] of BATCH_TABLES) {
    await db.runAsync(`DELETE FROM ${table} WHERE ${col} ${notIn}`, ids);
  }
  await db.runAsync(`DELETE FROM cursors WHERE batch_id ${notIn}`, ids);
  await db.runAsync(`DELETE FROM outbox WHERE batch_id ${notIn}`, ids);
}

async function withStatement(db: SQLiteDatabase, sql: string, rows: unknown[][]): Promise<void> {
  if (!rows.length) return;
  const stmt = await db.prepareAsync(sql);
  try {
    for (const params of rows) await stmt.executeAsync(params as never);
  } finally {
    await stmt.finalizeAsync();
  }
}

/** One batch's downloaded rows (the teacher gets the whole batch). Deleted tests and notices are removed. */
export async function applyPage(db: SQLiteDatabase, batchId: string, page: BatchPage): Promise<void> {
  if (page.batch) {
    await db.runAsync('INSERT OR REPLACE INTO batches (id, seq, data) VALUES (?, ?, ?)', [
      batchId,
      page.batch.seq,
      JSON.stringify(page.batch),
    ]);
  }
  await withStatement(
    db,
    'INSERT OR REPLACE INTO batch_months (batch_id, month, seq, data) VALUES (?, ?, ?, ?)',
    page.batch_months.map((r) => [batchId, r.month, r.seq, JSON.stringify(r)]),
  );
  for (const [table, list] of [
    ['batch_tests', page.batch_tests],
    ['batch_notices', page.batch_notices],
  ] as const) {
    await withStatement(
      db,
      `DELETE FROM ${table} WHERE batch_id = ? AND id = ?`,
      list.filter((r) => r.deleted_at != null).map((r) => [batchId, r.id]),
    );
    await withStatement(
      db,
      `INSERT OR REPLACE INTO ${table} (batch_id, id, seq, data) VALUES (?, ?, ?, ?)`,
      list.filter((r) => r.deleted_at == null).map((r) => [batchId, r.id, r.seq, JSON.stringify(r)]),
    );
  }
  await withStatement(
    db,
    'INSERT OR REPLACE INTO enrolments (id, batch_id, seq, data) VALUES (?, ?, ?, ?)',
    page.enrolments.map((r) => [r.id, batchId, r.seq, JSON.stringify(r)]),
  );
  await withStatement(
    db,
    'INSERT OR REPLACE INTO enrolment_months (enrolment_id, month, batch_id, seq, data) VALUES (?, ?, ?, ?, ?)',
    page.enrolment_months.map((r) => [r.enrolment_id, r.month, batchId, r.seq, JSON.stringify(r)]),
  );
}

// ── the outbox ────────────────────────────────────────────────────────────

export interface OutboxLine {
  key: string;
  batch_id: string;
  ver: number;
  change: Change;
}

/** The row a change edits; two edits of one row share a line. */
function outboxKey(c: Change): string {
  if (c.t === 'batches') return `b:${c.b}`;
  if (c.t === 'batch_months') return `bm:${c.b}:${c.m}`;
  // Notices and tests are sent whole, so a later edit (or the delete) simply replaces the unsent one.
  if (c.t === 'batch_notices') return `bn:${c.b}:${c.id}`;
  if (c.t === 'batch_tests') return `bt:${c.b}:${c.id}`;
  return `em:${c.e}:${c.m}`;
}

/** A later edit on top of an earlier, unsent one: newer fields win, maps merge key by key. */
function mergeChange(old: Change, next: Change): Change {
  const at = Math.max(old.at, next.at);
  if (old.t === 'batches' && next.t === 'batches') return { ...next, at, data: { ...old.data, ...next.data } };
  if (old.t === 'batch_months' && next.t === 'batch_months') {
    return { ...next, at, patch: { sessions: { ...old.patch.sessions, ...next.patch.sessions } } };
  }
  if (old.t === 'enrolment_months' && next.t === 'enrolment_months') {
    const patch = { ...old.patch, ...next.patch };
    if (old.patch.att && next.patch.att) patch.att = { ...old.patch.att, ...next.patch.att };
    if (old.patch.score && next.patch.score) patch.score = { ...old.patch.score, ...next.patch.score };
    return { ...next, at, patch };
  }
  return next;
}

export async function queueChange(db: SQLiteDatabase, change: Change): Promise<void> {
  const key = outboxKey(change);
  await db.withTransactionAsync(async () => {
    const old = await db.getFirstAsync<{ ver: number; change: string }>('SELECT ver, change FROM outbox WHERE key = ?', [key]);
    if (old) {
      const merged = mergeChange(JSON.parse(old.change) as Change, change);
      await db.runAsync('UPDATE outbox SET ver = ?, change = ? WHERE key = ?', [old.ver + 1, JSON.stringify(merged), key]);
    } else {
      const last = await db.getFirstAsync<{ ord: number | null }>('SELECT MAX(ord) AS ord FROM outbox');
      await db.runAsync('INSERT INTO outbox (key, batch_id, ord, ver, change) VALUES (?, ?, ?, 1, ?)', [
        key,
        change.b,
        (last?.ord ?? 0) + 1,
        JSON.stringify(change),
      ]);
    }
  });
}

/**
 * Unsent edits in the order the server needs them: batch info first (a fee can
 * depend on the course months), then tests (marks are only accepted for a test
 * the server already has), then everything else as it was made.
 */
export async function readOutbox(db: SQLiteDatabase): Promise<OutboxLine[]> {
  const rows = await db.getAllAsync<{ key: string; batch_id: string; ver: number; change: string }>(
    `SELECT key, batch_id, ver, change FROM outbox
      ORDER BY CASE WHEN key LIKE 'b:%' THEN 0 WHEN key LIKE 'bt:%' THEN 1 ELSE 2 END, ord`,
  );
  return rows.map((r) => ({ key: r.key, batch_id: r.batch_id, ver: r.ver, change: JSON.parse(r.change) as Change }));
}

/** The server has this line (unless it was edited again since it was sent). */
export async function dropOutboxLine(db: SQLiteDatabase, key: string, ver: number): Promise<void> {
  await db.runAsync('DELETE FROM outbox WHERE key = ? AND ver = ?', [key, ver]);
}

// ── reading everything ────────────────────────────────────────────────────

export interface LocalRows {
  account: AccountSnapshot | null;
  syncedAt: number | null;
  batches: Batch[];
  batchMonths: BatchMonth[];
  tests: BatchTest[];
  notices: BatchNotice[];
  enrolments: Enrolment[];
  months: EnrolmentMonth[];
  outbox: OutboxLine[];
}

async function readData<T>(db: SQLiteDatabase, table: string): Promise<T[]> {
  const rows = await db.getAllAsync<{ data: string }>(`SELECT data FROM ${table}`);
  return rows.map((r) => JSON.parse(r.data) as T);
}

export async function readAll(db: SQLiteDatabase): Promise<LocalRows> {
  const syncedAt = await readKv(db, 'synced_at');
  return {
    account: await readAccount(db),
    syncedAt: syncedAt ? Number(syncedAt) : null,
    batches: await readData<Batch>(db, 'batches'),
    batchMonths: await readData<BatchMonth>(db, 'batch_months'),
    tests: await readData<BatchTest>(db, 'batch_tests'),
    notices: await readData<BatchNotice>(db, 'batch_notices'),
    enrolments: await readData<Enrolment>(db, 'enrolments'),
    months: await readData<EnrolmentMonth>(db, 'enrolment_months'),
    outbox: await readOutbox(db),
  };
}
