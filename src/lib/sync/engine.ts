// Keeps the phone's copy up to date and uploads the teacher's edits (same
// engine as the student app, plus an outbox). One sync call per round sends
// the unsent edits, the bookmarks (a change number per batch) and the account
// snapshot's number, and gets back what the server did with each edit and
// only the rows that changed. Rounds repeat while the server has more, then
// the screens re-read the copy.
import { AppState } from 'react-native';
import { supabase } from '../supabase';
import { currentDb } from '../local/db';
import * as repo from '../local/repo';
import { loadLocalStore, useLocalStore } from '../local/store';
import type { AccountSnapshot, Change, ChangeResult, SyncResponse } from '../local/types';

const MAX_ROUNDS = 10;
const PAGE_ROWS = 1000;
/** The server takes up to 500 edits per call. */
const MAX_CHANGES = 500;
/** An edit uploads this long after the last one, so a burst goes in one call. */
const EDIT_DELAY_MS = 2_000;
const RETRY_MS = [2_000, 5_000, 15_000, 60_000, 300_000];

let running: Promise<void> | null = null;
let again = false;
let lastStarted = 0;
let failures = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let editTimer: ReturnType<typeof setTimeout> | null = null;
/** Server clock minus phone clock, from the last sync. */
let clockOffset = 0;

/** The batches to keep in sync: every one this account teaches that isn't deleted. */
export function wantedBatches(account: AccountSnapshot | null): Set<string> {
  return new Set((account?.teaching ?? []).filter((t) => t.deleted_at == null).map((t) => t.batch_id));
}

/** Now, on the server's clock (edit times are compared across phones). */
export function serverNow(): number {
  return Date.now() + clockOffset;
}

/** Called when an account's copy opens. */
export async function loadClock(): Promise<void> {
  const open = currentDb();
  const v = open ? await repo.readKv(open.db, 'clock_offset') : null;
  clockOffset = v ? Number(v) || 0 : 0;
}

type Edit = Change extends infer C ? (C extends Change ? Omit<C, 'at'> : never) : never;

/** Saves run one after another, so quick taps never race on the same outbox line. */
let saving: Promise<void> = Promise.resolve();

/**
 * Save edits on the phone: they show at once, and upload shortly after (or
 * when the internet is back). Several edits (a whole class's attendance) go in
 * together and the screens re-read the copy once.
 */
export function saveEdits(edits: Edit[]): Promise<void> {
  const run = saving.then(async () => {
    const open = currentDb();
    if (!open) throw new Error('Please log in again.');
    if (!edits.length) return;
    const at = serverNow();
    for (const edit of edits) await repo.queueChange(open.db, { ...edit, at } as Change);
    await loadLocalStore(open.db);
    if (editTimer) clearTimeout(editTimer);
    editTimer = setTimeout(() => {
      editTimer = null;
      requestSync();
    }, EDIT_DELAY_MS);
  });
  saving = run.catch(() => {});
  return run;
}

export function saveEdit(edit: Edit): Promise<void> {
  return saveEdits([edit]);
}

/**
 * Sync now, or join the sync already running. With ifOlderThanMs, skip when
 * the last one started more recently (coming back to the app).
 */
export function requestSync(opts: { ifOlderThanMs?: number } = {}): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  if (opts.ifOlderThanMs && Date.now() - lastStarted < opts.ifOlderThanMs) return Promise.resolve();
  clearRetry();
  running = (async () => {
    useLocalStore.setState({ syncing: true });
    try {
      do {
        again = false;
        lastStarted = Date.now();
        await syncOnce();
      } while (again);
      failures = 0;
      useLocalStore.setState({ syncError: null });
    } catch (err) {
      failures += 1;
      useLocalStore.setState({ syncError: describeSyncError(err) });
      scheduleRetry();
    } finally {
      // Show what was saved, even when a later round failed.
      const open = currentDb();
      if (open) await loadLocalStore(open.db).catch(() => {});
      useLocalStore.setState({ syncing: false });
      running = null;
    }
  })();
  return running;
}

/** Signed out: no more retries or pending uploads. */
export function stopSync(): void {
  clearRetry();
  if (editTimer) clearTimeout(editTimer);
  editTimer = null;
  failures = 0;
  clockOffset = 0;
}

function scheduleRetry(): void {
  if (AppState.currentState !== 'active') return;
  const wait = RETRY_MS[Math.min(failures, RETRY_MS.length) - 1];
  retryTimer = setTimeout(() => {
    retryTimer = null;
    requestSync();
  }, wait);
}

function clearRetry(): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}

function describeSyncError(err: unknown): string {
  const msg = String((err as Error)?.message ?? err ?? '');
  if (/network|fetch|timed? ?out/i.test(msg)) return 'No connection. Showing what’s saved on this phone.';
  return msg || 'Couldn’t refresh. Showing what’s saved on this phone.';
}

/** Why the server turned an edit down, in the teacher's words. */
function describeRefusal(r: ChangeResult): string {
  switch (r.reason) {
    case 'invalid':
      return `A change wasn’t saved: ${r.detail ?? 'something in it isn’t allowed'}.`;
    case 'older':
      return 'A newer change from another device was kept instead of one made here.';
    case 'not_allowed':
      return 'A change wasn’t saved: only the batch’s teacher can do that.';
    case 'not_member':
      return 'A change wasn’t saved: that student isn’t in the batch any more.';
    case 'deleted':
    case 'no_batch':
      return 'A change wasn’t saved: that batch was deleted.';
    default:
      return 'A change wasn’t saved.';
  }
}

async function syncOnce(): Promise<void> {
  const open = currentDb();
  if (!open) return;
  const { userId, db } = open;
  let uploadFailed = false;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const account = await repo.readAccount(db);
    const cursors = await repo.readCursors(db);
    const want = wantedBatches(account);
    const bookmarks: Record<string, number> = {};
    for (const batchId of want) bookmarks[batchId] = cursors.get(batchId) ?? 0;
    // Edits go up on the first round; one the server couldn't take waits for the next sync.
    const sent = round === 0 ? (await repo.readOutbox(db)).slice(0, MAX_CHANGES) : [];

    const sentAt = Date.now();
    const { data, error } = await supabase.rpc('sync', {
      p_changes: sent.map((l) => l.change),
      p_cursors: bookmarks,
      p_account_rev: account?.rev ?? null,
      p_max: PAGE_ROWS,
    });
    if (error) throw error;
    // Signed out or switched account while waiting: this answer isn't theirs.
    if (currentDb()?.userId !== userId) return;
    const res = data as SyncResponse;
    // The server's clock against the middle of the round trip.
    clockOffset = res.server_now - Math.round((sentAt + Date.now()) / 2);
    let more = false;
    const refusals: string[] = [];

    await db.withTransactionAsync(async () => {
      for (const r of res.results) {
        const line = sent[r.i];
        if (!line) continue;
        if (r.status === 'rejected' && r.reason === 'error') {
          uploadFailed = true;
          continue;
        }
        // Taken, or turned down for good: the server's row comes down with the batch.
        if (r.status === 'rejected') refusals.push(describeRefusal(r));
        await repo.dropOutboxLine(db, line.key, line.ver);
      }
      for (const [batchId, answer] of Object.entries(res.batches)) {
        if ('gone' in answer) {
          await repo.dropCursor(db, batchId);
          continue;
        }
        if ('later' in answer) {
          more = true;
          continue;
        }
        if (answer.full) await repo.clearBatch(db, batchId);
        await repo.applyPage(db, batchId, answer);
        await repo.setCursor(db, batchId, answer.upto);
        if (answer.more) more = true;
      }
      if (res.account) {
        await repo.writeKv(db, 'account', JSON.stringify(res.account));
        // Batches this account no longer teaches go, deleted ones stay readable.
        await repo.purgeBatchesExcept(db, new Set(res.account.teaching.map((t) => t.batch_id)));
        // New batches are fetched next round.
        for (const batchId of wantedBatches(res.account)) if (!want.has(batchId)) more = true;
      }
      await repo.writeKv(db, 'clock_offset', String(clockOffset));
      await repo.writeKv(db, 'synced_at', String(Date.now()));
    });
    if (refusals.length) useLocalStore.setState({ refused: refusals[refusals.length - 1] });
    // More edits than one call takes: the rest go in the next pass.
    if (sent.length === MAX_CHANGES) again = true;
    if (!more) break;
  }
  if (uploadFailed) throw new Error('Some changes are still waiting to upload. Trying again soon.');
}
