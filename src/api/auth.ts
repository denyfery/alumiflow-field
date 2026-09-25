import { apiRequest } from '@/api/client';
import { getDeviceDescriptor } from '@/device/identity';
import type { FieldLocale } from '@/i18n';
import type { LoginResponse, MobileProfile, UserProfile } from '@/types/api';

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  const device = await getDeviceDescriptor();

  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    authenticated: false,
    body: JSON.stringify({
      email: email.trim(),
      password,
      ...device,
    }),
  });
}

export async function meRequest(): Promise<MobileProfile> {
  return apiRequest<MobileProfile>('/me');
}

export async function logoutRequest(): Promise<{ logged_out: boolean }> {
  return apiRequest<{ logged_out: boolean }>('/auth/logout', { method: 'POST' });
}

export async function updateLocaleRequest(locale: FieldLocale): Promise<{ locale: FieldLocale }> {
  return apiRequest<{ locale: FieldLocale }>('/me/locale', {
    method: 'PUT',
    body: JSON.stringify({ locale }),
  });
}

export async function updateProfileRequest(input: { name: string; phone: string | null }): Promise<{ user: UserProfile }> {
  return apiRequest<{ user: UserProfile }>('/me/profile', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}
