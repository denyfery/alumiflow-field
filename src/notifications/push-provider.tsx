import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { useSession } from '@/auth/session-provider';
import { getInstallationByPublicId } from '@/database/repositories/installations';
import { getSurveyByPublicId } from '@/database/repositories/surveys';
import { useConnectivity } from '@/hooks/use-connectivity';
import { useFieldI18n } from '@/i18n/use-field-i18n';
import { registerForAssignmentPushAsync, type PushRegistrationStatus } from '@/notifications/register';
import { useSync } from '@/sync/sync-provider';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type PushContextValue = {
  registrationStatus: PushRegistrationStatus | 'idle';
  registrationError: string | null;
  requestPermission: () => Promise<void>;
};

type AssignmentNotificationData = {
  type?: unknown;
  resource?: unknown;
  public_id?: unknown;
  screen?: unknown;
};

const PushContext = createContext<PushContextValue | null>(null);

export function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  const { status: sessionStatus, profile } = useSession();
  const { t } = useFieldI18n();
  const connectivity = useConnectivity();
  const { syncNow } = useSync();
  const [registrationStatus, setRegistrationStatus] = useState<PushContextValue['registrationStatus']>('idle');
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const registrationKeyRef = useRef<string | null>(null);
  const handledResponseRef = useRef<string | null>(null);

  const applyRegistrationResult = useCallback((result: Awaited<ReturnType<typeof registerForAssignmentPushAsync>>) => {
    setRegistrationStatus(result.status);
    setRegistrationError(result.message ?? null);
  }, []);

  const requestPermission = useCallback(async () => {
    const result = await registerForAssignmentPushAsync({ requestPermission: true });
    applyRegistrationResult(result);
  }, [applyRegistrationResult]);

  const openNotification = useCallback(async (response: Notifications.NotificationResponse) => {
    if (!profile) return;
    if (handledResponseRef.current === response.notification.request.identifier) return;

    const data = response.notification.request.content.data as AssignmentNotificationData;
    const resource = typeof data.resource === 'string' ? data.resource : '';
    const publicId = typeof data.public_id === 'string' ? data.public_id : '';
    if (!publicId || !['survey', 'installation'].includes(resource)) return;

    handledResponseRef.current = response.notification.request.identifier;
    await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    await syncNow().catch(() => undefined);

    if (resource === 'survey') {
      const survey = await getSurveyByPublicId(profile, publicId);
      if (survey) {
        router.push({ pathname: '/surveys/[id]', params: { id: String(survey.id) } });
      } else {
        router.push('/surveys');
      }
      return;
    }

    const installation = await getInstallationByPublicId(profile, publicId);
    if (installation) {
      router.push({ pathname: '/installations/[id]', params: { id: String(installation.id) } });
    } else {
      router.push('/installations');
    }
  }, [profile, syncNow]);

  useEffect(() => {
    if (sessionStatus !== 'authenticated' || !profile || connectivity !== 'online') return;

    const registrationKey = `${profile.user.id}:${profile.device?.device_uuid ?? 'unknown'}`;
    if (registrationKeyRef.current === registrationKey) return;
    registrationKeyRef.current = registrationKey;

    registerForAssignmentPushAsync()
      .then(async (result) => {
        applyRegistrationResult(result);
        if (result.status !== 'permission_required') return;

        const rationaleKey = `alumiflow.push.rationale.${profile.user.id}`;
        const alreadyShown = await SecureStore.getItemAsync(rationaleKey);
        if (alreadyShown) return;
        await SecureStore.setItemAsync(rationaleKey, '1');

        Alert.alert(
          t('Stay updated on field assignments'),
          t('Notifications are used for new assignments and schedule changes. You can keep using AlumiFlow Field if you choose not to enable them.'),
          [
            { text: t('Not now'), style: 'cancel' },
            { text: t('Enable notifications'), onPress: () => { requestPermission().catch(() => undefined); } },
          ],
        );
      })
      .catch((error) => {
        setRegistrationStatus('unavailable');
        setRegistrationError(error instanceof Error ? error.message : 'Push notification unavailable.');
      });
  }, [sessionStatus, profile, connectivity, applyRegistrationResult, requestPermission, t]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openNotification(response).catch(() => undefined);
    });

    return () => subscription.remove();
  }, [openNotification]);

  useEffect(() => {
    if (sessionStatus !== 'authenticated' || !profile) return;

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) return openNotification(response);
      })
      .catch(() => undefined);
  }, [sessionStatus, profile, openNotification]);

  const value = useMemo<PushContextValue>(
    () => ({ registrationStatus, registrationError, requestPermission }),
    [registrationStatus, registrationError, requestPermission],
  );

  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
}

export function usePushNotifications(): PushContextValue {
  const context = useContext(PushContext);
  if (!context) throw new Error('usePushNotifications must be used inside PushNotificationProvider');
  return context;
}
