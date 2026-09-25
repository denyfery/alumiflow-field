export type AppEnvironment = 'development' | 'pilot' | 'production';

const DEVELOPMENT_API_BASE_URL = 'http://10.0.2.2:8000/api/mobile/v1';
const PRODUCTION_API_BASE_URL = 'https://app.alumiflow.com/api/mobile/v1';
const DEFAULT_OFFLINE_AUTH_MAX_HOURS = 24;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function resolveEnvironment(value: string | undefined): AppEnvironment {
  if (value === 'pilot' || value === 'production' || value === 'development') {
    return value;
  }

  return __DEV__ ? 'development' : 'production';
}

const appEnvironment = resolveEnvironment(process.env.EXPO_PUBLIC_APP_ENV);
const defaultApiBaseUrl = appEnvironment === 'development'
  ? DEVELOPMENT_API_BASE_URL
  : PRODUCTION_API_BASE_URL;
const configuredHours = Number(process.env.EXPO_PUBLIC_OFFLINE_AUTH_MAX_HOURS ?? DEFAULT_OFFLINE_AUTH_MAX_HOURS);

export const env = {
  appEnvironment,
  apiBaseUrl: trimTrailingSlash(process.env.EXPO_PUBLIC_API_BASE_URL ?? defaultApiBaseUrl),
  offlineAuthMaxHours:
    Number.isFinite(configuredHours) && configuredHours > 0
      ? configuredHours
      : DEFAULT_OFFLINE_AUTH_MAX_HOURS,
} as const;
