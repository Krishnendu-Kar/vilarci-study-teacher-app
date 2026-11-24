// A batch's notices for the teacher, from the phone's copy. Posting, editing,
// pinning and deleting are saved on the phone and uploaded by sync, so they
// work offline; parents get them on their next refresh. A notice is sent whole
// (body + pinned) with an id made here, and the latest edit wins.
import * as Crypto from 'expo-crypto';
import { useLocalStore } from '../local/store';
import type { BatchNotice } from '../local/types';
import { saveEdits } from '../sync/engine';
import { noticeProblem } from '../utils/notices';

const NONE: BatchNotice[] = [];

/** Pinned first, then newest (with this phone's unsent changes). */
export function useBatchNotices(batchId: string | undefined): BatchNotice[] {
  return useLocalStore((s) => (batchId ? s.notices[batchId] ?? NONE : NONE));
}

function check(body: string): string {
  const problem = noticeProblem(body);
  if (problem) throw new Error(problem);
  return body.trim();
}

export function postNotice(batchId: string, body: string, pinned: boolean): Promise<void> {
  return saveEdits([{ t: 'batch_notices', b: batchId, id: Crypto.randomUUID(), data: { body: check(body), pinned } }]);
}

export function editNotice(n: BatchNotice, body: string, pinned: boolean): Promise<void> {
  return saveEdits([{ t: 'batch_notices', b: n.batch_id, id: n.id, data: { body: check(body), pinned } }]);
}

export function setNoticePinned(n: BatchNotice, pinned: boolean): Promise<void> {
  return saveEdits([{ t: 'batch_notices', b: n.batch_id, id: n.id, data: { body: n.body, pinned } }]);
}

export function deleteNotice(n: BatchNotice): Promise<void> {
  return saveEdits([{ t: 'batch_notices', b: n.batch_id, id: n.id, deleted: true }]);
}

export function describeNoticeError(err: unknown): string {
  return String((err as Error)?.message ?? '') || 'Couldn’t save the notice. Please try again.';
}
