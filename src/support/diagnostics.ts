import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { env } from '@/config/env';
import type { MobileProfile } from '@/types/api';

export function maskDeviceId(value: string | null | undefined): string {
  if (!value) return '-';
  const suffix = value.replace(/-/g, '').slice(-5);
  return `••••${suffix}`;
}

export function appVersionLabel(): string {
  const version = Constants.expoConfig?.version ?? '0.4.0';
  const build = Platform.OS === 'android'
    ? Constants.expoConfig?.android?.versionCode
    : Constants.expoConfig?.ios?.buildNumber;
  return build ? `${version} (${build})` : version;
}

export function diagnosticsText(input: {
  profile: MobileProfile;
  connectivity: string;
  lastSyncAt: string | null;
  pendingCount: number;
  syncStatus: string;
  syncError: string | null;
  offlineSession: boolean;
  locale: string;
}): string {
  return [
    'AlumiFlow Field Diagnostics',
    `App: ${appVersionLabel()}`,
    `Platform: ${Platform.OS}`,
    `Environment: ${env.appEnvironment}`,
    `Company: ${input.profile.company.display_name}`,
    `User: ${input.profile.user.name}`,
    `Role: ${input.profile.user.role}`,
    `Appearance: ${input.profile.company.appearance?.source ?? 'default'} ${input.profile.company.appearance?.primary_color ?? '-'}`,
    `Locale: ${input.locale}`,
    `Session: ${input.offlineSession ? 'offline_cached' : 'server_verified'}`,
    `Connection: ${input.connectivity}`,
    `Sync status: ${input.syncStatus}`,
    `Last sync: ${input.lastSyncAt ?? '-'}`,
    `Pending changes: ${input.pendingCount}`,
    `Last sync error: ${input.syncError ?? '-'}`,
    `Server: ${env.apiBaseUrl}`,
    `Device: ${maskDeviceId(input.profile.device?.device_uuid)}`,
  ].join('\n');
}
