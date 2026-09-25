import * as Crypto from 'expo-crypto';
import { insertQueuedInstallationEvent } from '@/database/repositories/installation-events';
import { insertQueuedInstallationIssue } from '@/database/repositories/installation-issues';
import { updateInstallationLocal } from '@/database/repositories/installations';
import { enqueueOperation } from '@/sync/queue';
import type { MobileInstallation, MobileInstallationHandover, MobileInstallationIssue, MobileProfile, SignatureStroke } from '@/types/api';
import type { FieldLocationEvidence } from '@/surveys/location';

async function queueEvidence(
  profile: MobileProfile,
  installationId: number,
  eventType: 'installation_started' | 'installation_completed',
  evidence: FieldLocationEvidence,
): Promise<void> {
  const mobileUuid = Crypto.randomUUID();
  await insertQueuedInstallationEvent({
    localUuid: mobileUuid,
    installationId,
    eventType,
    locationStatus: evidence.locationStatus,
    latitude: evidence.latitude,
    longitude: evidence.longitude,
    accuracy: evidence.accuracy,
    capturedAt: evidence.capturedAt,
  });
  await enqueueOperation(profile, {
    resourceType: 'installation_event',
    resourceUuid: mobileUuid,
    action: 'installation.field_event',
    payload: {
      installationId,
      mobileUuid,
      eventType,
      locationStatus: evidence.locationStatus,
      latitude: evidence.latitude,
      longitude: evidence.longitude,
      accuracy: evidence.accuracy,
      capturedAt: evidence.capturedAt,
    },
  });
}

export async function startInstallationLocal(
  profile: MobileProfile,
  installation: MobileInstallation,
  evidence: FieldLocationEvidence,
): Promise<void> {
  if (installation.status !== 'scheduled') throw new Error('Installation is not scheduled.');
  const version = installation.version;
  const startedAt = new Date().toISOString();

  await updateInstallationLocal({
    installationId: installation.id,
    status: 'in_progress',
    version: version + 1,
    startedAt,
  });
  await enqueueOperation(profile, {
    resourceType: 'installation',
    resourceUuid: String(installation.id),
    action: 'installation.start',
    payload: { installationId: installation.id, version },
  });
  await queueEvidence(profile, installation.id, 'installation_started', evidence);
}


export type InstallationIssueDraft = {
  category: MobileInstallationIssue['category'];
  title: string;
  description: string | null;
  severity: MobileInstallationIssue['severity'];
  canWorkContinue: boolean;
  customerInformed: boolean;
};

export async function reportInstallationIssueLocal(
  profile: MobileProfile,
  installation: MobileInstallation,
  draft: InstallationIssueDraft,
): Promise<string> {
  if (installation.status !== 'in_progress') throw new Error('Installation must be in progress before reporting an issue.');
  const mobileUuid = Crypto.randomUUID();
  const reportedAt = new Date().toISOString();
  await insertQueuedInstallationIssue({
    localUuid: mobileUuid,
    installationId: installation.id,
    category: draft.category,
    title: draft.title,
    description: draft.description,
    severity: draft.severity,
    canWorkContinue: draft.canWorkContinue,
    customerInformed: draft.customerInformed,
    reportedAt,
  });
  await enqueueOperation(profile, {
    resourceType: 'installation_issue',
    resourceUuid: mobileUuid,
    action: 'installation.issue.upsert',
    payload: {
      installationId: installation.id,
      mobileUuid,
      category: draft.category,
      title: draft.title,
      description: draft.description,
      severity: draft.severity,
      canWorkContinue: draft.canWorkContinue,
      customerInformed: draft.customerInformed,
      reportedAt,
    },
  });
  return mobileUuid;
}

export type InstallationHandoverDraft = {
  receivedByName: string;
  notes: string | null;
  signatureStatus: 'signed' | 'unavailable';
  signatureStrokes: SignatureStroke[];
  signatureUnavailableReason: string | null;
};

export async function completeInstallationLocal(
  profile: MobileProfile,
  installation: MobileInstallation,
  evidence: FieldLocationEvidence,
  handoverDraft: InstallationHandoverDraft,
): Promise<void> {
  if (installation.status !== 'in_progress') throw new Error('Installation must be in progress before completion.');
  if (installation.issues.some((issue) => issue.status === 'open' && issue.blocks_completion)) {
    throw new Error('Resolve blocking installation issues before completion.');
  }
  const version = installation.version;
  const signedAt = new Date().toISOString();
  const mobileUuid = Crypto.randomUUID();
  const handover: MobileInstallationHandover = {
    id: null,
    mobile_uuid: mobileUuid,
    received_by_name: handoverDraft.receivedByName.trim(),
    notes: handoverDraft.notes?.trim() || null,
    signature_status: handoverDraft.signatureStatus,
    signature_strokes: handoverDraft.signatureStatus === 'signed' ? handoverDraft.signatureStrokes : [],
    signature_unavailable_reason: handoverDraft.signatureStatus === 'unavailable' ? handoverDraft.signatureUnavailableReason?.trim() || null : null,
    signature_sha256: null,
    signed_at: signedAt,
    completed_by_name: profile.user.name,
    received_at: null,
  };

  const handoverRequest = {
    mobile_uuid: handover.mobile_uuid,
    received_by_name: handover.received_by_name,
    notes: handover.notes,
    signature_status: handover.signature_status,
    signature_strokes: handover.signature_strokes,
    signature_unavailable_reason: handover.signature_unavailable_reason,
    signed_at: handover.signed_at,
  };

  await updateInstallationLocal({
    installationId: installation.id,
    status: 'completed',
    version: version + 1,
    completedAt: signedAt,
    handover,
  });
  await enqueueOperation(profile, {
    resourceType: 'installation',
    resourceUuid: String(installation.id),
    action: 'installation.complete',
    payload: { installationId: installation.id, version, handover: handoverRequest },
  });
  await queueEvidence(profile, installation.id, 'installation_completed', evidence);
}
