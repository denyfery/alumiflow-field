import { apiRequest } from '@/api/client';
import type { MobileSurvey, SurveySnapshotResponse } from '@/types/api';

export async function surveySnapshotRequest(): Promise<SurveySnapshotResponse> {
  return apiRequest<SurveySnapshotResponse>('/surveys');
}

export async function surveyDetailRequest(id: number): Promise<MobileSurvey> {
  return apiRequest<MobileSurvey>(`/surveys/${id}`);
}

export async function startSurveyRequest(id: number, version: number, idempotencyKey: string): Promise<MobileSurvey> {
  return apiRequest<MobileSurvey>(`/surveys/${id}/start`, {
    method: 'POST',
    idempotencyKey,
    body: JSON.stringify({ version }),
  });
}

export async function upsertSurveyItemRequest(input: {
  surveyId: number;
  mobileUuid: string;
  version: number;
  idempotencyKey: string;
  productId: number;
  groupCode?: string | null;
  groupTitle?: string | null;
  measurements: Record<string, string | number>;
  quantity: number;
  notes?: string | null;
}): Promise<MobileSurvey> {
  return apiRequest<MobileSurvey>(`/surveys/${input.surveyId}/items/${input.mobileUuid}`, {
    method: 'PUT',
    idempotencyKey: input.idempotencyKey,
    body: JSON.stringify({
      version: input.version,
      product_id: input.productId,
      group_code: input.groupCode ?? null,
      group_title: input.groupTitle ?? null,
      measurements: input.measurements,
      quantity: input.quantity,
      notes: input.notes ?? null,
    }),
  });
}

export async function deleteSurveyItemRequest(input: {
  surveyId: number;
  mobileUuid: string;
  version: number;
  idempotencyKey: string;
}): Promise<MobileSurvey> {
  return apiRequest<MobileSurvey>(`/surveys/${input.surveyId}/items/${input.mobileUuid}`, {
    method: 'DELETE',
    idempotencyKey: input.idempotencyKey,
    body: JSON.stringify({ version: input.version }),
  });
}

export async function completeSurveyRequest(id: number, version: number, idempotencyKey: string): Promise<MobileSurvey> {
  return apiRequest<MobileSurvey>(`/surveys/${id}/complete`, {
    method: 'POST',
    idempotencyKey,
    body: JSON.stringify({ version }),
  });
}


export async function uploadSurveyPhotoRequest(input: {
  surveyId: number;
  mobileUuid: string;
  idempotencyKey: string;
  contentBase64: string;
  originalName: string;
  mime: string;
  category?: string | null;
  caption?: string | null;
}): Promise<MobileSurvey> {
  return apiRequest<MobileSurvey>(`/surveys/${input.surveyId}/photos/${input.mobileUuid}`, {
    method: 'PUT',
    idempotencyKey: input.idempotencyKey,
    body: JSON.stringify({
      content_base64: input.contentBase64,
      original_name: input.originalName,
      mime: input.mime,
      category: input.category ?? 'location',
      caption: input.caption ?? null,
    }),
  });
}

export async function uploadSurveyFieldEventRequest(input: {
  surveyId: number;
  mobileUuid: string;
  idempotencyKey: string;
  eventType: 'survey_started' | 'survey_completed';
  locationStatus: 'captured' | 'permission_denied' | 'unavailable' | 'timeout';
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  capturedAt: string;
}): Promise<MobileSurvey> {
  return apiRequest<MobileSurvey>(`/surveys/${input.surveyId}/events/${input.mobileUuid}`, {
    method: 'PUT',
    idempotencyKey: input.idempotencyKey,
    body: JSON.stringify({
      event_type: input.eventType,
      location_status: input.locationStatus,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      captured_at: input.capturedAt,
    }),
  });
}
