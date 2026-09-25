import * as FileSystem from 'expo-file-system/legacy';
import { ApiError } from '@/api/client';
import {
  completeInstallationRequest,
  installationDetailRequest,
  startInstallationRequest,
  uploadInstallationFieldEventRequest,
  uploadInstallationPhotoRequest,
  upsertInstallationIssueRequest,
} from '@/api/installations';
import { markInstallationEventFailed, markInstallationEventUploaded } from '@/database/repositories/installation-events';
import { markInstallationIssueFailed, markInstallationIssueUploaded } from '@/database/repositories/installation-issues';
import {
  getInstallationPhoto,
  markInstallationPhotoStatus,
  markInstallationPhotoUploaded,
} from '@/database/repositories/installation-photos';
import { deleteInstallationLocalPhotoFile } from '@/installations/photos';
import {
  listQueuedOperations,
  markOperationFailed,
  markOperationProcessing,
  rebaseQueuedOperation,
  removeOperation,
  resetOperationPending,
} from '@/sync/queue';
import type { QueuedOperationRow } from '@/sync/queue';
import type { MobileInstallationHandover, MobileProfile } from '@/types/api';

type QueuePayload = Record<string, unknown>;

const VERSIONED_INSTALLATION_ACTIONS = new Set([
  'installation.start',
  'installation.complete',
]);

export async function processInstallationQueue(profile: MobileProfile): Promise<{ notice: string | null }> {
  return processInstallationQueueInternal(profile, new Set<number>(), []);
}

async function processInstallationQueueInternal(
  profile: MobileProfile,
  rebasedInstallationIds: Set<number>,
  notices: string[],
): Promise<{ notice: string | null }> {
  const operations = await listQueuedOperations(profile);

  for (const operation of operations) {
    if (!operation.action.startsWith('installation.')) continue;

    let payload: QueuePayload;
    try {
      payload = JSON.parse(operation.payload_json) as QueuePayload;
    } catch {
      await markOperationFailed(operation.operation_uuid, 'Invalid local queue payload.');
      throw new Error('A local installation queue item is corrupted.');
    }

    await markOperationProcessing(operation.operation_uuid);

    try {
      switch (operation.action) {
        case 'installation.start':
          await startInstallationRequest(Number(payload.installationId), Number(payload.version), operation.idempotency_key);
          break;
        case 'installation.complete':
          await completeInstallationRequest(
            Number(payload.installationId),
            Number(payload.version),
            payload.handover as Omit<MobileInstallationHandover, 'id' | 'signature_sha256' | 'completed_by_name' | 'received_at'>,
            operation.idempotency_key,
          );
          break;
        case 'installation.issue.upsert': {
          const mobileUuid = String(payload.mobileUuid);
          const serverInstallation = await upsertInstallationIssueRequest({
            installationId: Number(payload.installationId),
            mobileUuid,
            idempotencyKey: operation.idempotency_key,
            category: String(payload.category) as 'measurement' | 'material' | 'damage' | 'site_condition' | 'customer_request' | 'installation' | 'other',
            title: String(payload.title),
            description: payload.description == null ? null : String(payload.description),
            severity: String(payload.severity) as 'low' | 'medium' | 'high',
            canWorkContinue: Boolean(payload.canWorkContinue),
            customerInformed: Boolean(payload.customerInformed),
            reportedAt: String(payload.reportedAt),
          });
          const serverIssue = serverInstallation.issues.find((issue) => issue.mobile_uuid === mobileUuid);
          await markInstallationIssueUploaded(mobileUuid, serverIssue);
          break;
        }
        case 'installation.photo.upload': {
          const mobileUuid = String(payload.mobileUuid);
          const photo = await getInstallationPhoto(mobileUuid);
          if (!photo) {
            await removeOperation(operation.operation_uuid);
            continue;
          }
          if (!photo.local_uri) {
            if (photo.sync_status === 'uploaded') {
              await removeOperation(operation.operation_uuid);
              continue;
            }
            throw new Error('Local photo file was not found.');
          }

          await markInstallationPhotoStatus(mobileUuid, 'uploading');
          const contentBase64 = await FileSystem.readAsStringAsync(photo.local_uri, { encoding: FileSystem.EncodingType.Base64 });
          const serverInstallation = await uploadInstallationPhotoRequest({
            installationId: Number(payload.installationId),
            mobileUuid,
            idempotencyKey: operation.idempotency_key,
            contentBase64,
            originalName: photo.original_name ?? `installation-${photo.installation_id}-${mobileUuid}.jpg`,
            mime: photo.mime ?? 'image/jpeg',
            type: photo.type,
            caption: photo.caption,
            issueMobileUuid: photo.issue_mobile_uuid,
          });
          const serverPhoto = serverInstallation.photos.find((item) => item.mobile_uuid === mobileUuid);
          await deleteInstallationLocalPhotoFile(photo.local_uri);
          await markInstallationPhotoUploaded({ localUuid: mobileUuid, serverId: serverPhoto?.id ?? null, remoteUrl: serverPhoto?.url ?? null });
          break;
        }
        case 'installation.field_event': {
          const mobileUuid = String(payload.mobileUuid);
          const serverInstallation = await uploadInstallationFieldEventRequest({
            installationId: Number(payload.installationId),
            mobileUuid,
            idempotencyKey: operation.idempotency_key,
            eventType: String(payload.eventType) as 'installation_started' | 'installation_completed',
            locationStatus: String(payload.locationStatus) as 'captured' | 'permission_denied' | 'unavailable' | 'timeout',
            latitude: nullableNumber(payload.latitude),
            longitude: nullableNumber(payload.longitude),
            accuracy: nullableNumber(payload.accuracy),
            capturedAt: String(payload.capturedAt),
          });
          const serverEvent = serverInstallation.field_events.find((event) => event.mobile_uuid === mobileUuid);
          await markInstallationEventUploaded(mobileUuid, serverEvent);
          break;
        }
        default:
          await resetOperationPending(operation.operation_uuid);
          continue;
      }

      await removeOperation(operation.operation_uuid);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Installation sync operation failed.';
      if (operation.action === 'installation.photo.upload' && operation.resource_uuid) {
        await markInstallationPhotoStatus(
          operation.resource_uuid,
          error instanceof ApiError && error.status === 0 ? 'queued' : 'failed',
          error instanceof ApiError && error.status === 0 ? null : message,
        );
      }
      if (operation.action === 'installation.field_event' && operation.resource_uuid && !(error instanceof ApiError && error.status === 0)) {
        await markInstallationEventFailed(operation.resource_uuid, message);
      }
      if (operation.action === 'installation.issue.upsert' && operation.resource_uuid && !(error instanceof ApiError && error.status === 0)) {
        await markInstallationIssueFailed(operation.resource_uuid, message);
      }
      if (error instanceof ApiError && error.status === 0) {
        await resetOperationPending(operation.operation_uuid);
        throw error;
      }
      if (error instanceof ApiError && error.status === 409 && operation.action === 'installation.start') {
        const installationId = Number(payload.installationId);
        const staleVersion = Number(payload.version);
        if (!rebasedInstallationIds.has(installationId)) {
          const notice = await rebaseInstallationStartConflict(operations, installationId, staleVersion);
          if (notice) {
            rebasedInstallationIds.add(installationId);
            notices.push(notice);
            return processInstallationQueueInternal(profile, rebasedInstallationIds, notices);
          }
        }
      }
      await markOperationFailed(operation.operation_uuid, message);
      throw error;
    }
  }

  return { notice: notices.length > 0 ? notices.join(' ') : null };
}

async function rebaseInstallationStartConflict(
  operations: QueuedOperationRow[],
  installationId: number,
  staleStartVersion: number,
): Promise<string | null> {
  if (!Number.isFinite(installationId) || !Number.isFinite(staleStartVersion)) return null;

  const serverInstallation = await installationDetailRequest(installationId);
  if (serverInstallation.status !== 'scheduled') return null;
  if (serverInstallation.version <= staleStartVersion) return null;

  const versionDelta = serverInstallation.version - staleStartVersion;
  const rebases: Array<{ operation: QueuedOperationRow; payload: QueuePayload }> = [];

  for (const operation of operations) {
    if (!VERSIONED_INSTALLATION_ACTIONS.has(operation.action)) continue;

    let payload: QueuePayload;
    try {
      payload = JSON.parse(operation.payload_json) as QueuePayload;
    } catch {
      return null;
    }

    if (Number(payload.installationId) !== installationId) continue;
    const currentVersion = Number(payload.version);
    if (!Number.isFinite(currentVersion)) return null;

    rebases.push({
      operation,
      payload: { ...payload, version: currentVersion + versionDelta },
    });
  }

  if (!rebases.some(({ operation }) => operation.action === 'installation.start')) return null;

  for (const { operation, payload } of rebases) {
    await rebaseQueuedOperation(operation.operation_uuid, payload);
  }

  return 'Instalasi berubah di server saat pekerjaan masih tersimpan lokal. Versi antrean sudah disesuaikan dan pekerjaan lokal disinkronkan ulang dengan data server terbaru.';
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
