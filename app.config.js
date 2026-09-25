const VERSION = '0.4.0';
const BUILD_NUMBER = 10;
const PILOT_API = 'https://pilot.alumiflow.com/api/mobile/v1';
const PRODUCTION_API = 'https://app.alumiflow.com/api/mobile/v1';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '10.0.2.2', '::1']);

function normalizeVariant(value) {
  if (value === 'pilot' || value === 'production') return value;
  return 'development';
}

function validateReleaseApi(variant, rawApiBaseUrl) {
  if (variant === 'development') return;

  if (!rawApiBaseUrl) {
    throw new Error(`[AlumiFlow Field] ${variant} build requires EXPO_PUBLIC_API_BASE_URL.`);
  }

  let parsed;
  try {
    parsed = new URL(rawApiBaseUrl);
  } catch {
    throw new Error(`[AlumiFlow Field] Invalid EXPO_PUBLIC_API_BASE_URL: ${rawApiBaseUrl}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`[AlumiFlow Field] ${variant} build requires an HTTPS API URL.`);
  }

  if (LOCAL_HOSTS.has(parsed.hostname)) {
    throw new Error(`[AlumiFlow Field] Refusing ${variant} build with local API host: ${parsed.hostname}`);
  }

  const normalized = rawApiBaseUrl.replace(/\/+$/, '');

  if (variant === 'pilot' && normalized !== PILOT_API) {
    throw new Error(
      `[AlumiFlow Field] Pilot API must be ${PILOT_API}. Received: ${normalized}`,
    );
  }

  if (variant === 'production' && normalized !== PRODUCTION_API) {
    throw new Error(
      `[AlumiFlow Field] Production API must be ${PRODUCTION_API}. Received: ${normalized}`,
    );
  }
}

module.exports = ({ config }) => {
  const variant = normalizeVariant(process.env.APP_VARIANT);
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  validateReleaseApi(variant, apiBaseUrl);

  const development = variant === 'development';

  return {
    ...config,
    name: development ? 'AlumiFlow Field Dev' : 'AlumiFlow Field',
    icon: development ? './assets/branding/icon-dev.png' : config.icon,
    version: VERSION,
    android: {
      ...config.android,
      versionCode: BUILD_NUMBER,
      adaptiveIcon: {
        ...config.android?.adaptiveIcon,
        foregroundImage: development
          ? './assets/branding/adaptive-icon-dev.png'
          : config.android?.adaptiveIcon?.foregroundImage,
      },
    },
    ios: {
      ...config.ios,
      buildNumber: String(BUILD_NUMBER),
    },
    extra: {
      ...config.extra,
      appEnvironment: process.env.EXPO_PUBLIC_APP_ENV ?? variant,
    },
  };
};
