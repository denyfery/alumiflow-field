import { env } from '@/config/env';

export function resolveServerAssetUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;

  try {
    const base = new URL(env.apiBaseUrl);
    return `${base.protocol}//${base.host}${value.startsWith('/') ? '' : '/'}${value}`;
  } catch {
    return value;
  }
}
