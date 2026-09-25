import * as Crypto from 'expo-crypto';
import { apiRequest } from '@/api/client';
import type { SyncBootstrapResponse, SyncCheckpointResponse } from '@/types/api';

export async function syncBootstrapRequest(): Promise<SyncBootstrapResponse> {
  return apiRequest<SyncBootstrapResponse>('/sync/bootstrap');
}

export async function syncCheckpointRequest(input: {
  clientId: string;
  lastSyncedAt: string | null;
  pendingOperationsCount: number;
}): Promise<SyncCheckpointResponse> {
  return apiRequest<SyncCheckpointResponse>('/sync/checkpoint', {
    method: 'POST',
    idempotencyKey: Crypto.randomUUID(),
    body: JSON.stringify({
      client_id: input.clientId,
      last_synced_at: input.lastSyncedAt,
      pending_operations_count: input.pendingOperationsCount,
    }),
  });
}
