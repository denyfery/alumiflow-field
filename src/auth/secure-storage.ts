import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'alumiflow.auth.token';
const DEVICE_UUID_KEY = 'alumiflow.device.uuid';

export async function getAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearAuthToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getStoredDeviceUuid(): Promise<string | null> {
  return SecureStore.getItemAsync(DEVICE_UUID_KEY);
}

export async function setStoredDeviceUuid(deviceUuid: string): Promise<void> {
  await SecureStore.setItemAsync(DEVICE_UUID_KEY, deviceUuid, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
