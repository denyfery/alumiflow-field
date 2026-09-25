import * as Crypto from 'expo-crypto';
import type { MobileProfile } from '@/types/api';
import type { FieldLocationEvidence } from '@/surveys/location';
import { insertQueuedFieldEvent } from '@/database/repositories/field-events';
import { enqueueOperation } from '@/sync/queue';

export async function recordSurveyFieldEventLocal(
  profile: MobileProfile,
  surveyId: number,
  eventType: 'survey_started' | 'survey_completed',
  evidence: FieldLocationEvidence,
): Promise<string> {
  const mobileUuid = Crypto.randomUUID();

  await insertQueuedFieldEvent({
    localUuid: mobileUuid,
    surveyId,
    eventType,
    locationStatus: evidence.locationStatus,
    latitude: evidence.latitude,
    longitude: evidence.longitude,
    accuracy: evidence.accuracy,
    capturedAt: evidence.capturedAt,
  });

  await enqueueOperation(profile, {
    resourceType: 'field_event',
    resourceUuid: mobileUuid,
    action: 'survey.field_event',
    payload: {
      surveyId,
      mobileUuid,
      eventType,
      locationStatus: evidence.locationStatus,
      latitude: evidence.latitude,
      longitude: evidence.longitude,
      accuracy: evidence.accuracy,
      capturedAt: evidence.capturedAt,
    },
  });

  return mobileUuid;
}
