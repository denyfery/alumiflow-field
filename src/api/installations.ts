import { apiRequest } from '@/api/client';
import type { InstallationSnapshotResponse, MobileInstallation, MobileInstallationHandover, MobileInstallationIssue } from '@/types/api';

export async function installationSnapshotRequest(): Promise<InstallationSnapshotResponse> {
  return apiRequest<InstallationSnapshotResponse>('/installations');
}

export async function installationDetailRequest(id: number): Promise<MobileInstallation> {
  return apiRequest<MobileInstallation>(`/installations/${id}`);
}

export async function startInstallationRequest(id: number, version: number, idempotencyKey: string): Promise<MobileInstallation> {
  return apiRequest<MobileInstallation>(`/installations/${id}/start`, {
    method: 'POST',
    idempotencyKey,
    body: JSON.stringify({ version }),
  });
}

export async function completeInstallationRequest(
  id: number,
  version: number,
  handover: Omit<MobileInstallationHandover, 'id' | 'signature_sha256' | 'completed_by_name' | 'received_at'>,
  idempotencyKey: string,
): Promise<MobileInstallation> {
  return apiRequest<MobileInstallation>(`/installations/${id}/complete`, {
    method: 'POST',
    idempotencyKey,
    body: JSON.stringify({ version, handover }),
  });
}

export async function uploadInstallationPhotoRequest(input: {
  installationId: number;
  mobileUuid: string;
  idempotencyKey: string;
  contentBase64: string;
  originalName: string;
  mime: string;
  type: 'before' | 'after' | 'issue';
  caption?: string | null;
  issueMobileUuid?: string | null;
}): Promise<MobileInstallation> {
  return apiRequest<MobileInstallation>(`/installations/${input.installationId}/photos/${input.mobileUuid}`, {
    method: 'PUT',
    idempotencyKey: input.idempotencyKey,
    body: JSON.stringify({
      content_base64: input.contentBase64,
      original_name: input.originalName,
      mime: input.mime,
      type: input.type,
      caption: input.caption ?? null,
      issue_mobile_uuid: input.issueMobileUuid ?? null,
    }),
  });
}

export async function upsertInstallationIssueRequest(input: {
  installationId: number;
  mobileUuid: string;
  idempotencyKey: string;
  category: MobileInstallationIssue['category'];
  title: string;
  description: string | null;
  severity: MobileInstallationIssue['severity'];
  canWorkContinue: boolean;
  customerInformed: boolean;
  reportedAt: string;
}): Promise<MobileInstallation> {
  return apiRequest<MobileInstallation>(`/installations/${input.installationId}/issues/${input.mobileUuid}`, {
    method: 'PUT',
    idempotencyKey: input.idempotencyKey,
    body: JSON.stringify({
      category: input.category,
      title: input.title,
      description: input.description,
      severity: input.severity,
      can_work_continue: input.canWorkContinue,
      customer_informed: input.customerInformed,
      reported_at: input.reportedAt,
    }),
  });
}

export async function uploadInstallationFieldEventRequest(input: {
  installationId: number;
  mobileUuid: string;
  idempotencyKey: string;
  eventType: 'installation_started' | 'installation_completed';
  locationStatus: 'captured' | 'permission_denied' | 'unavailable' | 'timeout';
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  capturedAt: string;
}): Promise<MobileInstallation> {
  return apiRequest<MobileInstallation>(`/installations/${input.installationId}/events/${input.mobileUuid}`, {
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
