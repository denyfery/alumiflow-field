import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getStoredDeviceUuid, setStoredDeviceUuid } from '@/auth/secure-storage';

const APP_VERSION = '0.1.0';

export async function getOrCreateDeviceUuid(): Promise<string> {
  const existing = await getStoredDeviceUuid();
  if (existing) return existing;

  const created = Crypto.randomUUID();
  await setStoredDeviceUuid(created);
  return created;
}

export async function getDeviceDescriptor() {
  const deviceUuid = await getOrCreateDeviceUuid();
  const platform: 'android' | 'ios' = Platform.OS === 'ios' ? 'ios' : 'android';
  const fallbackName = platform === 'ios' ? 'iPhone' : 'Android Device';

  return {
    device_uuid: deviceUuid,
    device_name: Device.modelName || Device.deviceName || fallbackName,
    platform,
    app_version: APP_VERSION,
  } as const;
}
