import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Alert, Linking } from 'react-native';

type Translator = (key: string, vars?: Record<string, string | number>) => string;

function confirm(title: string, message: string, cancelLabel: string, continueLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: continueLabel, onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

function showOpenSettings(title: string, message: string, t: Translator): void {
  Alert.alert(title, message, [
    { text: t('Not now'), style: 'cancel' },
    { text: t('Open Settings'), onPress: () => { Linking.openSettings().catch(() => undefined); } },
  ]);
}

export async function ensureCameraPermission(t: Translator): Promise<boolean> {
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) return true;

  if (!current.canAskAgain) {
    showOpenSettings(
      t('Camera access is off'),
      t('Allow camera access in device Settings to add field photos.'),
      t,
    );
    return false;
  }

  const proceed = await confirm(
    t('Camera access'),
    t('AlumiFlow Field uses the camera only when you choose to add a field photo.'),
    t('Not now'),
    t('Continue'),
  );
  if (!proceed) return false;

  const requested = await ImagePicker.requestCameraPermissionsAsync();
  if (requested.granted) return true;

  if (!requested.canAskAgain) {
    showOpenSettings(
      t('Camera access is off'),
      t('Allow camera access in device Settings to add field photos.'),
      t,
    );
  } else {
    Alert.alert(t('Camera permission denied'), t('No photo was taken. You can continue working and try again later.'));
  }
  return false;
}

export async function ensureLocationPermission(t: Translator): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;

  if (!current.canAskAgain) {
    showOpenSettings(
      t('Location access is off'),
      t('Location is recorded only as start/completion evidence, not for continuous tracking. Work can still continue without it.'),
      t,
    );
    return false;
  }

  const proceed = await confirm(
    t('Location evidence'),
    t('Your location is recorded only when starting or completing work. AlumiFlow Field does not continuously track you.'),
    t('Continue without location'),
    t('Allow location'),
  );
  if (!proceed) return false;

  const requested = await Location.requestForegroundPermissionsAsync();
  if (requested.granted) return true;

  Alert.alert(
    t('Location permission denied'),
    t('Work can still continue. The evidence will record that location permission was not available.'),
  );
  return false;
}

export async function getNotificationPermissionState(): Promise<Notifications.NotificationPermissionsStatus> {
  return Notifications.getPermissionsAsync();
}
