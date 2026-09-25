import { AppState } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { getSyncState } from '@/database/repositories/sync-state';
import { useSession } from '@/auth/session-provider';
import { getCurrentConnectivityState, useConnectivity, type ConnectivityState } from '@/hooks/use-connectivity';
import { runFieldSync } from '@/sync/engine';
import { getPendingOperationCount } from '@/sync/queue';

type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

type SyncContextValue = {
  status: SyncStatus;
  connectivity: ConnectivityState;
  lastSyncAt: string | null;
  pendingCount: number;
  error: string | null;
  syncNow: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { status: sessionStatus, profile, invalidateSession, refreshProfile } = useSession();
  const connectivity = useConnectivity();
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const refreshLocalState = useCallback(async () => {
    setLastSyncAt(await getSyncState('last_sync_at'));
    setPendingCount(await getPendingOperationCount(profile));
  }, [profile]);

  const syncNow = useCallback(async () => {
    if (sessionStatus !== 'authenticated') return;
    if (syncingRef.current) return;

    if (connectivity !== 'online') {
      const currentConnectivity = await getCurrentConnectivityState();
      if (currentConnectivity === 'offline') {
        setStatus('offline');
        await refreshLocalState();
        return;
      }
    }

    syncingRef.current = true;
    setStatus('syncing');
    setError(null);

    try {
      if (!profile) return;
      const result = await runFieldSync(profile);
      setLastSyncAt(result.serverTime);
      setPendingCount(result.pendingCount);
      if (result.profileChanged) {
        await refreshProfile();
      }
      setError(result.notice);
      setStatus('idle');
    } catch (syncError) {
      if (syncError instanceof ApiError && [401, 402, 403].includes(syncError.status)) {
        await invalidateSession(syncError.message);
        setStatus('error');
        setError(syncError.message);
      } else if (syncError instanceof ApiError && syncError.status === 0) {
        setStatus('offline');
        setError(null);
      } else {
        setStatus('error');
        setError(syncError instanceof Error ? syncError.message : 'Sinkronisasi gagal.');
      }
      await refreshLocalState();
    } finally {
      syncingRef.current = false;
    }
  }, [sessionStatus, profile, connectivity, invalidateSession, refreshProfile, refreshLocalState]);

  const syncNowRef = useRef(syncNow);

  useEffect(() => {
    syncNowRef.current = syncNow;
  }, [syncNow]);

  useEffect(() => {
    refreshLocalState().catch(() => undefined);
  }, [refreshLocalState]);

  useEffect(() => {
    if (sessionStatus === 'authenticated' && connectivity === 'online') {
      syncNowRef.current().catch(() => undefined);
    } else if (connectivity === 'offline') {
      setStatus('offline');
    }
  }, [sessionStatus, connectivity]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && sessionStatus === 'authenticated') {
        syncNowRef.current().catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [sessionStatus]);

  const value = useMemo<SyncContextValue>(
    () => ({ status, connectivity, lastSyncAt, pendingCount, error, syncNow }),
    [status, connectivity, lastSyncAt, pendingCount, error, syncNow],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used inside SyncProvider');
  return context;
}
