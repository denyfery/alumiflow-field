import * as Crypto from 'expo-crypto';
import type { MobileProduct, MobileProfile, MobileSurvey, MobileSurveyItem } from '@/types/api';
import { enqueueOperation } from '@/sync/queue';
import type { FieldLocationEvidence } from '@/surveys/location';
import { recordSurveyFieldEventLocal } from '@/surveys/field-events';
import {
  deleteSurveyItemLocal,
  getSurvey,
  updateSurveyLocal,
  upsertSurveyItemLocal,
} from '@/database/repositories/surveys';

export async function startSurveyLocal(profile: MobileProfile, survey: MobileSurvey, evidence: FieldLocationEvidence): Promise<void> {
  if (!['scheduled', 'draft'].includes(survey.status)) throw new Error('Survey tidak dapat dimulai dari status saat ini.');

  await enqueueOperation(profile, {
    resourceType: 'survey',
    resourceUuid: String(survey.id),
    action: 'survey.start',
    payload: { surveyId: survey.id, version: survey.version },
  });
  await updateSurveyLocal({
    surveyId: survey.id,
    status: 'in_progress',
    version: survey.version + 1,
    startedAt: evidence.capturedAt,
  });
  await recordSurveyFieldEventLocal(profile, survey.id, 'survey_started', evidence);
}

export async function saveSurveyItemLocal(
  profile: MobileProfile,
  survey: MobileSurvey,
  product: MobileProduct,
  input: {
    localUuid?: string | null;
    measurements: Record<string, string | number>;
    quantity: number;
    notes?: string | null;
    groupCode?: string | null;
    groupTitle?: string | null;
  },
): Promise<string> {
  if (survey.status !== 'in_progress') throw new Error('Survey harus dimulai sebelum mengisi pengukuran.');

  const localUuid = input.localUuid ?? Crypto.randomUUID();
  await enqueueOperation(profile, {
    resourceType: 'survey_item',
    resourceUuid: localUuid,
    action: 'survey.item.upsert',
    payload: {
      surveyId: survey.id,
      mobileUuid: localUuid,
      version: survey.version,
      productId: product.id,
      groupCode: input.groupCode ?? null,
      groupTitle: input.groupTitle ?? null,
      measurements: input.measurements,
      quantity: input.quantity,
      notes: input.notes ?? null,
    },
  });

  await upsertSurveyItemLocal({
    surveyId: survey.id,
    localUuid,
    productId: product.id,
    productName: product.name,
    groupCode: input.groupCode,
    groupTitle: input.groupTitle,
    measurements: input.measurements,
    quantity: input.quantity,
    notes: input.notes,
    billingUnit: product.billing_unit,
  });
  await updateSurveyLocal({ surveyId: survey.id, version: survey.version + 1 });

  return localUuid;
}

export async function removeSurveyItemLocal(
  profile: MobileProfile,
  survey: MobileSurvey,
  item: MobileSurveyItem,
): Promise<void> {
  if (survey.status !== 'in_progress') throw new Error('Item hanya dapat dihapus saat survey berjalan.');
  if (!item.mobile_uuid) throw new Error('Item lama dari server belum dapat dihapus dari Field.');

  await enqueueOperation(profile, {
    resourceType: 'survey_item',
    resourceUuid: item.mobile_uuid,
    action: 'survey.item.delete',
    payload: { surveyId: survey.id, mobileUuid: item.mobile_uuid, version: survey.version },
  });
  await deleteSurveyItemLocal(item.mobile_uuid);
  await updateSurveyLocal({ surveyId: survey.id, version: survey.version + 1 });
}

export async function completeSurveyLocal(profile: MobileProfile, surveyId: number, evidence: FieldLocationEvidence): Promise<void> {
  const survey = await getSurvey(profile, surveyId);
  if (!survey) throw new Error('Survey lokal tidak ditemukan.');
  if (survey.status !== 'in_progress') throw new Error('Survey harus berstatus in progress.');
  if (survey.items.length === 0) throw new Error('Tambahkan minimal satu item pengukuran.');

  await enqueueOperation(profile, {
    resourceType: 'survey',
    resourceUuid: String(survey.id),
    action: 'survey.complete',
    payload: { surveyId: survey.id, version: survey.version },
  });
  await updateSurveyLocal({
    surveyId: survey.id,
    status: 'completed',
    version: survey.version + 1,
    completedAt: evidence.capturedAt,
  });
  await recordSurveyFieldEventLocal(profile, survey.id, 'survey_completed', evidence);
}
