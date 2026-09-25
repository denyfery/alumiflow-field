import { apiRequest } from '@/api/client';

export type PushRegistrationResponse = {
  registered: boolean;
  device_uuid: string;
  provider?: 'expo';
};

export async function registerPushTokenRequest(pushToken: string): Promise<PushRegistrationResponse> {
  return apiRequest<PushRegistrationResponse>('/devices/current/push-token', {
    method: 'PUT',
    body: JSON.stringify({
      provider: 'expo',
      push_token: pushToken,
    }),
  });
}

export async function unregisterPushTokenRequest(): Promise<PushRegistrationResponse> {
  return apiRequest<PushRegistrationResponse>('/devices/current/push-token', {
    method: 'DELETE',
  });
}
