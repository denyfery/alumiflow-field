import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerPushTokenRequest } from '@/api/devices';

export type PushRegistrationStatus =
  | 'registered'
  | 'permission_required'
  | 'permission_denied'
  | 'project_not_configured'
  | 'unavailable';

export type PushRegistrationResult = {
  status: PushRegistrationStatus;
  token?: string;
  message?: string;
};

export async function registerForAssignmentPushAsync(options: { requestPermission?: boolean } = {}): Promise<PushRegistrationResult> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('assignments', {
        name: 'Assignments',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    let permission = await Notifications.getPermissionsAsync();
    let status = permission.status;

    if (status !== 'granted' && options.requestPermission && permission.canAskAgain) {
      await Notifications.requestPermissionsAsync();
      permission = await Notifications.getPermissionsAsync();
      status = permission.status;
    }

    if (status !== 'granted') {
      return { status: permission.canAskAgain ? 'permission_required' : 'permission_denied' };
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      return {
        status: 'project_not_configured',
        message: 'Expo projectId belum tersedia. Jalankan eas init / development build setup.',
      };
    }

    const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await registerPushTokenRequest(pushToken);

    return { status: 'registered', token: pushToken };
  } catch (error) {
    return {
      status: 'unavailable',
      message: error instanceof Error ? error.message : 'Push notification unavailable.',
    };
  }
}
