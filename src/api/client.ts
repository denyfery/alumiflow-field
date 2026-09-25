import { getAuthToken } from '@/auth/secure-storage';
import { env } from '@/config/env';
import type { ApiErrorBody, ApiSuccess } from '@/types/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = RequestInit & {
  authenticated?: boolean;
  idempotencyKey?: string;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.authenticated !== false) {
    const token = await getAuthToken();
    if (!token) {
      throw new ApiError(401, 'local_unauthenticated', 'Sesi login tidak tersedia di perangkat.');
    }
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.idempotencyKey) {
    headers.set('Idempotency-Key', options.idempotencyKey);
  }

  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new ApiError(0, 'network_unavailable', 'Tidak dapat terhubung ke server.', error);
  }

  let payload: ApiSuccess<T> | ApiErrorBody;
  try {
    payload = (await response.json()) as ApiSuccess<T> | ApiErrorBody;
  } catch (error) {
    throw new ApiError(
      response.status,
      'invalid_server_response',
      'Server mengembalikan response yang tidak dikenali.',
      error,
      response.headers.get('X-Request-ID') ?? undefined,
    );
  }

  if (!response.ok || !payload.ok) {
    const errorPayload = payload as ApiErrorBody;
    throw new ApiError(
      response.status,
      errorPayload.error?.code ?? 'request_failed',
      errorPayload.error?.message ?? 'Request gagal.',
      errorPayload.error?.details,
      errorPayload.meta?.request_id,
    );
  }

  return payload.data;
}
