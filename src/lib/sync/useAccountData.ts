import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { deleteLocalDb, openLocalDb } from '../local/db';
import { onBackOnline } from '../network';
import { loadLocalStore, resetLocalStore, useLocalStore } from '../local/store';
import { loadClock, requestSync, stopSync } from './engine';

/**
 * Ties the phone's copy to the signed-in account: opens it (screens show it
 * at once), syncs on start, when the app comes back to the front and when the
 * internet comes back, and deletes it when that account logs out.
 */
export function useAccountData(userId: string | undefined): void {
  const previous = useRef<string | undefined>(undefined);

  useEffect(() => {
    const before = previous.current;
    previous.current = userId;
    if (before && before !== userId) {
      stopSync();
      resetLocalStore();
      deleteLocalDb(before);
    }
    if (!userId) return;

    let live = true;
    openLocalDb(userId)
      .then(async (db) => {
        if (!live) return;
        await loadClock();
        await loadLocalStore(db);
        requestSync();
      })
      .catch((err) => {
        if (live) {
          const why = String((err as Error)?.message ?? err);
          useLocalStore.setState({ ready: true, syncError: `This device couldn’t open its saved copy (${why}). Reload the app.` });
        }
      });
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') requestSync({ ifOlderThanMs: 60_000 });
    });
    const offOnline = onBackOnline(() => requestSync());
    return () => {
      live = false;
      sub.remove();
      offOnline();
    };
  }, [userId]);
}
