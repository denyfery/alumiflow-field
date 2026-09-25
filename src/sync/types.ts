export type SyncQueueStatus = 'pending' | 'processing' | 'failed';

export type SyncOperation = {
  operationUuid: string;
  userId: number;
  companyId: number;
  resourceType: string;
  resourceUuid?: string | null;
  action: string;
  payload: unknown;
  idempotencyKey: string;
  status: SyncQueueStatus;
  attemptCount: number;
  lastError?: string | null;
  nextAttemptAt?: string | null;
  createdAt: string;
  updatedAt: string;
};
