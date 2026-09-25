import { ApiError } from '@/api/client';
import * as FileSystem from 'expo-file-system/legacy';
import {
  completeSurveyRequest,
  deleteSurveyItemRequest,
  startSurveyRequest,
  surveyDetailRequest,
  upsertSurveyItemRequest,
  uploadSurveyPhotoRequest,
  uploadSurveyFieldEventRequest,
} from '@/api/surveys';
import {
  listQueuedOperations,
  markOperationFailed,
  markOperationProcessing,
  rebaseQueuedOperation,
  removeOperation,
  resetOperationPending,
} from '@/sync/queue';
import type { QueuedOperationRow } from '@/sync/queue';
import type { MobileProfile } from '@/types/api';
import { getSurveyPhoto, markSurveyPhotoStatus, markSurveyPhotoUploaded } from '@/database/repositories/survey-photos';
import { deleteLocalPhotoFile } from '@/surveys/photos';
import { markFieldEventFailed, markFieldEventUploaded } from '@/database/repositories/field-events';

type QueuePayload = Record<string, unknown>;

export type QueueProcessResult = { notice: string | null };

const VERSIONED_SURVEY_ACTIONS = new Set([
  'survey.start',
  'survey.item.upsert',
  'survey.item.delete',
  'survey.complete',
]);

export async function processSurveyQueue(profile: MobileProfile): Promise<QueueProcessResult> {
  return processSurveyQueueInternal(profile, new Set<number>(), []);
}

async function processSurveyQueueInternal(
  profile: MobileProfile,
  rebasedSurveyIds: Set<number>,
  notices: string[],
): Promise<QueueProcessResult> {
  const operations = await listQueuedOperations(profile);

  for (const operation of operations) {
    let payload: QueuePayload;
    try {
      payload = JSON.parse(operation.payload_json) as QueuePayload;
    } catch {
      await markOperationFailed(operation.operation_uuid, 'Payload queue tidak valid.');
      throw new Error('Ada queue lokal yang rusak.');
    }

    await markOperationProcessing(operation.operation_uuid);

    try {
      switch (operation.action) {
        case 'survey.start':
          await startSurveyRequest(
            Number(payload.surveyId),
            Number(payload.version),
            operation.idempotency_key,
          );
          break;
        case 'survey.item.upsert':
          await upsertSurveyItemRequest({
            surveyId: Number(payload.surveyId),
            mobileUuid: String(payload.mobileUuid),
            version: Number(payload.version),
            idempotencyKey: operation.idempotency_key,
            productId: Number(payload.productId),
            groupCode: nullableString(payload.groupCode),
            groupTitle: nullableString(payload.groupTitle),
            measurements: (payload.measurements ?? {}) as Record<string, string | number>,
            quantity: Number(payload.quantity),
            notes: nullableString(payload.notes),
          });
          break;
        case 'survey.item.delete':
          await deleteSurveyItemRequest({
            surveyId: Number(payload.surveyId),
            mobileUuid: String(payload.mobileUuid),
            version: Number(payload.version),
            idempotencyKey: operation.idempotency_key,
          });
          break;
        case 'survey.photo.upload': {
          const mobileUuid = String(payload.mobileUuid);
          const photo = await getSurveyPhoto(mobileUuid);
          if (!photo) {
            await removeOperation(operation.operation_uuid);
            continue;
          }
          if (!photo.local_uri) {
            if (photo.sync_status === 'uploaded') {
              await removeOperation(operation.operation_uuid);
              continue;
            }
            throw new Error('File foto lokal tidak ditemukan.');
          }

          await markSurveyPhotoStatus(mobileUuid, 'uploading');
          const contentBase64 = await FileSystem.readAsStringAsync(photo.local_uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const serverSurvey = await uploadSurveyPhotoRequest({
            surveyId: Number(payload.surveyId),
            mobileUuid,
            idempotencyKey: operation.idempotency_key,
            contentBase64,
            originalName: photo.original_name ?? `survey-${photo.survey_id}-${mobileUuid}.jpg`,
            mime: photo.mime ?? 'image/jpeg',
            category: photo.category,
            caption: photo.caption,
          });
          const serverPhoto = serverSurvey.photos.find((item) => item.mobile_uuid === mobileUuid);
          await deleteLocalPhotoFile(photo.local_uri);
          await markSurveyPhotoUploaded({
            localUuid: mobileUuid,
            serverId: serverPhoto?.id ?? null,
            remoteUrl: serverPhoto?.url ?? null,
          });
          break;
        }
        case 'survey.field_event': {
          const mobileUuid = String(payload.mobileUuid);
          const serverSurvey = await uploadSurveyFieldEventRequest({
            surveyId: Number(payload.surveyId),
            mobileUuid,
            idempotencyKey: operation.idempotency_key,
            eventType: String(payload.eventType) as 'survey_started' | 'survey_completed',
            locationStatus: String(payload.locationStatus) as 'captured' | 'permission_denied' | 'unavailable' | 'timeout',
            latitude: nullableNumber(payload.latitude),
            longitude: nullableNumber(payload.longitude),
            accuracy: nullableNumber(payload.accuracy),
            capturedAt: String(payload.capturedAt),
          });
          const serverEvent = serverSurvey.field_events.find((event) => event.mobile_uuid === mobileUuid);
          await markFieldEventUploaded(mobileUuid, serverEvent);
          break;
        }
        case 'survey.complete':
          await completeSurveyRequest(
            Number(payload.surveyId),
            Number(payload.version),
            operation.idempotency_key,
          );
          break;
        default:
          await resetOperationPending(operation.operation_uuid);
          continue;
      }

      await removeOperation(operation.operation_uuid);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Operasi survey gagal disinkronkan.';
      if (operation.action === 'survey.photo.upload' && operation.resource_uuid) {
        await markSurveyPhotoStatus(
          operation.resource_uuid,
          error instanceof ApiError && error.status === 0 ? 'queued' : 'failed',
          error instanceof ApiError && error.status === 0 ? null : message,
        );
      }

      if (operation.action === 'survey.field_event' && operation.resource_uuid && !(error instanceof ApiError && error.status === 0)) {
        await markFieldEventFailed(operation.resource_uuid, message);
      }

      if (error instanceof ApiError && error.status === 0) {
        await resetOperationPending(operation.operation_uuid);
        throw error;
      }

      if (error instanceof ApiError && error.status === 409 && operation.action === 'survey.start') {
        const surveyId = Number(payload.surveyId);
        const staleVersion = Number(payload.version);
        if (!rebasedSurveyIds.has(surveyId)) {
          const notice = await rebaseSurveyStartConflict(operations, surveyId, staleVersion);
          if (notice) {
            rebasedSurveyIds.add(surveyId);
            notices.push(notice);
            return processSurveyQueueInternal(profile, rebasedSurveyIds, notices);
          }
        }
      }

      await markOperationFailed(operation.operation_uuid, message);
      throw error;
    }
  }

  return { notice: notices.length > 0 ? notices.join(' ') : null };
}

async function rebaseSurveyStartConflict(
  operations: QueuedOperationRow[],
  surveyId: number,
  staleStartVersion: number,
): Promise<string | null> {
  if (!Number.isFinite(surveyId) || !Number.isFinite(staleStartVersion)) return null;

  const serverSurvey = await surveyDetailRequest(surveyId);
  if (!['scheduled', 'draft'].includes(serverSurvey.status)) return null;
  if (serverSurvey.version <= staleStartVersion) return null;

  const versionDelta = serverSurvey.version - staleStartVersion;
  const rebases: Array<{ operation: QueuedOperationRow; payload: QueuePayload }> = [];

  for (const operation of operations) {
    if (!VERSIONED_SURVEY_ACTIONS.has(operation.action)) continue;

    let payload: QueuePayload;
    try {
      payload = JSON.parse(operation.payload_json) as QueuePayload;
    } catch {
      return null;
    }

    if (Number(payload.surveyId) !== surveyId) continue;
    const currentVersion = Number(payload.version);
    if (!Number.isFinite(currentVersion)) return null;

    rebases.push({
      operation,
      payload: { ...payload, version: currentVersion + versionDelta },
    });
  }

  if (!rebases.some(({ operation }) => operation.action === 'survey.start')) return null;

  for (const { operation, payload } of rebases) {
    // Payload berubah, jadi Idempotency-Key juga wajib diganti agar middleware
    // backend tidak menolak fingerprint baru sebagai idempotency_key_conflict.
    await rebaseQueuedOperation(operation.operation_uuid, payload);
  }

  return 'Survey berubah di server saat pekerjaan masih tersimpan lokal. Versi antrean sudah disesuaikan dan pekerjaan lokal disinkronkan ulang dengan data server terbaru.';
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined || value === '' ? null : String(value);
}
