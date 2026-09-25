import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/database/db';
import type { MobileProfile } from '@/types/api';

export async function getPendingOperationCount(profile?: MobileProfile | null): Promise<number> {
  const db = await getDatabase();
  const row = profile
    ? await db.getFirstAsync<{ total: number }>(
        `SELECT COUNT(*) AS total
           FROM sync_queue
          WHERE status IN ('pending', 'processing', 'failed') AND user_id = ? AND company_id = ?`,
        profile.user.id,
        profile.company.id,
      )
    : await db.getFirstAsync<{ total: number }>(
        `SELECT COUNT(*) AS total
           FROM sync_queue
          WHERE status IN ('pending', 'processing', 'failed')`,
      );
  return row?.total ?? 0;
}

/** Persist a local-first mutation with its own idempotency key for ordered replay. */
export async function enqueueOperation(
  profile: MobileProfile,
  input: {
    resourceType: string;
    resourceUuid?: string | null;
    action: string;
    payload: unknown;
  },
): Promise<string> {
  const db = await getDatabase();
  const operationUuid = Crypto.randomUUID();
  const idempotencyKey = Crypto.randomUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO sync_queue (
      operation_uuid, user_id, company_id, resource_type, resource_uuid,
      action, payload_json, idempotency_key, status, attempt_count,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
    operationUuid,
    profile.user.id,
    profile.company.id,
    input.resourceType,
    input.resourceUuid ?? null,
    input.action,
    JSON.stringify(input.payload),
    idempotencyKey,
    now,
    now,
  );

  return operationUuid;
}

export type QueuedOperationRow = {
  operation_uuid: string;
  user_id: number;
  company_id: number;
  resource_type: string;
  resource_uuid: string | null;
  action: string;
  payload_json: string;
  idempotency_key: string;
  status: 'pending' | 'processing' | 'failed';
  attempt_count: number;
  last_error: string | null;
  next_attempt_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function listQueuedOperations(profile: MobileProfile): Promise<QueuedOperationRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<QueuedOperationRow>(
    `SELECT operation_uuid, user_id, company_id, resource_type, resource_uuid,
            action, payload_json, idempotency_key, status, attempt_count,
            last_error, next_attempt_at, created_at, updated_at
       FROM sync_queue
      WHERE user_id = ? AND company_id = ? AND status IN ('pending', 'processing', 'failed')
      ORDER BY rowid`,
    profile.user.id,
    profile.company.id,
  );
}

export async function markOperationProcessing(operationUuid: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sync_queue
        SET status = 'processing', attempt_count = attempt_count + 1,
            last_error = NULL, updated_at = ?
      WHERE operation_uuid = ?`,
    new Date().toISOString(),
    operationUuid,
  );
}

export async function markOperationFailed(operationUuid: string, message: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sync_queue
        SET status = 'failed', last_error = ?, updated_at = ?
      WHERE operation_uuid = ?`,
    message,
    new Date().toISOString(),
    operationUuid,
  );
}

export async function resetOperationPending(operationUuid: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sync_queue SET status = 'pending', updated_at = ? WHERE operation_uuid = ?`,
    new Date().toISOString(),
    operationUuid,
  );
}


export async function rebaseQueuedOperation(operationUuid: string, payload: unknown): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE sync_queue
        SET payload_json = ?, idempotency_key = ?, status = 'pending',
            attempt_count = 0, last_error = NULL, next_attempt_at = NULL, updated_at = ?
      WHERE operation_uuid = ?`,
    JSON.stringify(payload),
    Crypto.randomUUID(),
    now,
    operationUuid,
  );
}

export async function removeOperation(operationUuid: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM sync_queue WHERE operation_uuid = ?', operationUuid);
}


export async function removeQueuedOperationsForResource(resourceType: string, resourceUuid: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'DELETE FROM sync_queue WHERE resource_type = ? AND resource_uuid = ?',
    resourceType,
    resourceUuid,
  );
}
