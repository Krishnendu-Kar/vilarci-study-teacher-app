// One watch on the connection for the whole app (same as Vilarci E-Split):
// NetInfo says "no internet"; how long our own server calls take says "slow"
// (a phone can't measure its speed by itself, and a test download would cost
// the user data). Coming back online starts a sync.
import { useSyncExternalStore } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export type Connection = 'ok' | 'slow' | 'offline';

/** A server answer (or a wait) this long means a slow connection. */
const SLOW_MS = 5_000;
/** An answer this quick means it's fine again. */
const QUICK_MS = 2_000;
/** "Slow" stays up this long after the last slow answer, unless a quick one comes first. */
const SLOW_FOR_MS = 60_000;

let net: NetInfoState | null = null;
let slowUntil = 0;
let current: Connection = 'ok';
let slowTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const onlineAgain = new Set<() => void>();

/** No network, or one that can't reach the internet: offline. Slow answers lately or 2G: slow. */
function connectionOf(s: NetInfoState | null, slow: boolean): Connection {
  if (s && (s.isConnected === false || s.isInternetReachable === false)) return 'offline';
  if (slow) return 'slow';
  const generation = (s?.details as { cellularGeneration?: string | null } | null)?.cellularGeneration;
  if (s?.type === 'cellular' && generation === '2g') return 'slow';
  return 'ok';
}

function update() {
  const next = connectionOf(net, Date.now() < slowUntil);
  if (next === current) return;
  const wasOffline = current === 'offline';
  current = next;
  listeners.forEach((l) => l());
  if (wasOffline) onlineAgain.forEach((l) => l());
}

function markSlow() {
  slowUntil = Date.now() + SLOW_FOR_MS;
  if (slowTimer) clearTimeout(slowTimer);
  slowTimer = setTimeout(update, SLOW_FOR_MS + 50);
  update();
}

let started = false;
function start() {
  if (started) return;
  started = true;
  NetInfo.addEventListener((s) => {
    net = s;
    update();
  });
}

/**
 * fetch, timed: an answer (or a wait) over 5 s shows "Slow internet" for a
 * minute; a quick answer clears it. Used by the Supabase client.
 */
export const timedFetch: typeof fetch = (input, init) => {
  const began = Date.now();
  const waiting = setTimeout(markSlow, SLOW_MS);
  return fetch(input, init).then(
    (res) => {
      clearTimeout(waiting);
      const took = Date.now() - began;
      if (took >= SLOW_MS) markSlow();
      else if (took < QUICK_MS && slowUntil) {
        slowUntil = 0;
        update();
      }
      return res;
    },
    (e: unknown) => {
      clearTimeout(waiting);
      throw e;
    },
  );
};

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** ok, slow or offline, kept up to date. */
export function useConnection(): Connection {
  return useSyncExternalStore(subscribe, () => current);
}

/** Runs whenever the phone comes back online. Returns the unsubscribe. */
export function onBackOnline(listener: () => void): () => void {
  start();
  onlineAgain.add(listener);
  return () => {
    onlineAgain.delete(listener);
  };
}
