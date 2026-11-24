import { useCallback, useState } from 'react';
import { requestSync } from './engine';

/** Pull-to-refresh: a sync the person asked for (background syncs show no spinner). */
export function useRefresh(): { refreshing: boolean; refresh: () => void } {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(() => {
    setRefreshing(true);
    requestSync().finally(() => setRefreshing(false));
  }, []);
  return { refreshing, refresh };
}
