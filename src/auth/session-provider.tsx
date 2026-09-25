import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError } from '@/api/client';
import { loginRequest, logoutRequest, meRequest, updateLocaleRequest } from '@/api/auth';
import { clearAuthToken, getAuthToken, setAuthToken } from '@/auth/secure-storage';
import { env } from '@/config/env';
import { initializeDatabase } from '@/database/db';
import { clearProfileCache, getProfileCache, saveProfileCache } from '@/database/repositories/profile';
import { getPendingOperationCount } from '@/sync/queue';
import { normalizeLocale, t, type FieldLocale } from '@/i18n';
import type { MobileProfile } from '@/types/api';

type SessionStatus = 'loading' | 'guest' | 'authenticated';

type SessionContextValue = {
  status: SessionStatus;
  profile: MobileProfile | null;
  offlineSession: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  invalidateSession: (message?: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateLocale: (locale: FieldLocale) => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function isOfflineCacheFresh(serverVerifiedAt: Date): boolean {
  const maxAgeMs = env.offlineAuthMaxHours * 60 * 60 * 1000;
  return Date.now() - serverVerifiedAt.getTime() <= maxAgeMs;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [offlineSession, setOfflineSession] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidateSession = useCallback(async (message?: string) => {
    await clearAuthToken();
    await clearProfileCache();
    setProfile(null);
    setOfflineSession(false);
    setError(message ?? null);
    setStatus('guest');
  }, []);

  const refreshProfile = useCallback(async () => {
    const freshProfile = await meRequest();
    await saveProfileCache(freshProfile);
    setProfile(freshProfile);
    setOfflineSession(false);
    setError(null);
    setStatus('authenticated');
  }, []);

  const updateLocale = useCallback(async (locale: FieldLocale) => {
    if (!profile) return;
    const result = await updateLocaleRequest(locale);
    const nextProfile: MobileProfile = {
      ...profile,
      user: {
        ...profile.user,
        locale: result.locale,
      },
    };

    await saveProfileCache(nextProfile);
    setProfile(nextProfile);
    setOfflineSession(false);
    setError(null);
  }, [profile]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      await initializeDatabase();
      const token = await getAuthToken();
      if (!token) {
        if (!cancelled) setStatus('guest');
        return;
      }

      try {
        const freshProfile = await meRequest();
        await saveProfileCache(freshProfile);
        if (!cancelled) {
          setProfile(freshProfile);
          setOfflineSession(false);
          setStatus('authenticated');
        }
      } catch (requestError) {
        if (requestError instanceof ApiError && requestError.status > 0) {
          await invalidateSession(requestError.message);
          return;
        }

        const cached = await getProfileCache();
        if (cached && isOfflineCacheFresh(cached.serverVerifiedAt)) {
          if (!cancelled) {
            setProfile(cached.profile);
            setOfflineSession(true);
            setError(t(normalizeLocale(cached.profile.user.locale), 'Offline mode: using the last server-verified device session.'));
            setStatus('authenticated');
          }
          return;
        }

        await invalidateSession(t(normalizeLocale(cached?.profile.user.locale), 'Offline session expired. Connect to the internet to sign in again.'));
      }
    }

    boot().catch((bootError) => {
      if (!cancelled) {
        setError(bootError instanceof Error ? bootError.message : t('id', 'Failed to prepare application.'));
        setStatus('guest');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [invalidateSession]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const result = await loginRequest(email, password);
    await setAuthToken(result.token);

    const nextProfile: MobileProfile = {
      user: result.user,
      company: result.company,
      permissions: result.permissions,
      workspaces: result.workspaces,
      device: result.device,
    };

    await saveProfileCache(nextProfile);
    setProfile(nextProfile);
    setOfflineSession(false);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    const pending = await getPendingOperationCount(profile);
    if (pending > 0) {
      throw new Error(t(normalizeLocale(profile?.user.locale), '{count} changes are still waiting to sync. Sync before logout.', { count: pending }));
    }

    try {
      await logoutRequest();
    } catch {
      // Local logout still removes the token. Server-side token can also be revoked from device management.
    }

    await invalidateSession();
  }, [invalidateSession, profile]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      profile,
      offlineSession,
      error,
      login,
      logout,
      invalidateSession,
      refreshProfile,
      updateLocale,
    }),
    [status, profile, offlineSession, error, login, logout, invalidateSession, refreshProfile, updateLocale],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}
