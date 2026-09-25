import { getDatabase } from '@/database/db';
import type { MobileFieldEvent } from '@/types/api';

type FieldEventRow = {
  local_uuid: string;
  server_id: number | null;
  survey_id: number;
  event_type: string;
  location_status: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  captured_at: string;
  received_at: string | null;
  metadata_json: string | null;
  sync_status: 'queued' | 'uploaded' | 'failed';
  last_error: string | null;
};

function rowToEvent(row: FieldEventRow): MobileFieldEvent {
  return {
    id: row.server_id,
    mobile_uuid: row.local_uuid,
    event_type: row.event_type,
    location_status: row.location_status,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy,
    captured_at: row.captured_at,
    received_at: row.received_at,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) as Record<string, unknown> : {},
    sync_status: row.sync_status,
    last_error: row.last_error,
  };
}

export async function listSurveyFieldEvents(surveyId: number): Promise<MobileFieldEvent[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<FieldEventRow>(
    `SELECT local_uuid, server_id, survey_id, event_type, location_status,
            latitude, longitude, accuracy, captured_at, received_at,
            metadata_json, sync_status, last_error
       FROM field_events
      WHERE survey_id = ?
      ORDER BY captured_at, local_uuid`,
    surveyId,
  );
  return rows.map(rowToEvent);
}

export async function insertQueuedFieldEvent(input: {
  localUuid: string;
  surveyId: number;
  eventType: 'survey_started' | 'survey_completed';
  locationStatus: 'captured' | 'permission_denied' | 'unavailable' | 'timeout';
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  capturedAt: string;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO field_events (
      local_uuid, server_id, survey_id, event_type, location_status,
      latitude, longitude, accuracy, captured_at, received_at,
      metadata_json, sync_status, last_error, local_updated_at
    ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'queued', NULL, ?)`,
    input.localUuid,
    input.surveyId,
    input.eventType,
    input.locationStatus,
    input.latitude ?? null,
    input.longitude ?? null,
    input.accuracy ?? null,
    input.capturedAt,
    new Date().toISOString(),
  );
}

export async function markFieldEventUploaded(localUuid: string, serverEvent: MobileFieldEvent | undefined): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE field_events
        SET server_id = ?, received_at = ?, metadata_json = ?,
            sync_status = 'uploaded', last_error = NULL, local_updated_at = ?
      WHERE local_uuid = ?`,
    serverEvent?.id ?? null,
    serverEvent?.received_at ?? null,
    serverEvent?.metadata ? JSON.stringify(serverEvent.metadata) : null,
    new Date().toISOString(),
    localUuid,
  );
}

export async function markFieldEventFailed(localUuid: string, message: string | null): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE field_events SET sync_status = 'failed', last_error = ?, local_updated_at = ? WHERE local_uuid = ?`,
    message,
    new Date().toISOString(),
    localUuid,
  );
}

export async function replaceServerFieldEvents(surveyId: number, events: MobileFieldEvent[]): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  for (const event of events) {
    await db.runAsync(
      `INSERT INTO field_events (
        local_uuid, server_id, survey_id, event_type, location_status,
        latitude, longitude, accuracy, captured_at, received_at,
        metadata_json, sync_status, last_error, local_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', NULL, ?)
      ON CONFLICT(local_uuid) DO UPDATE SET
        server_id = excluded.server_id,
        event_type = excluded.event_type,
        location_status = excluded.location_status,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        accuracy = excluded.accuracy,
        captured_at = excluded.captured_at,
        received_at = excluded.received_at,
        metadata_json = excluded.metadata_json,
        sync_status = 'uploaded',
        last_error = NULL,
        local_updated_at = excluded.local_updated_at`,
      event.mobile_uuid,
      event.id,
      surveyId,
      event.event_type,
      event.location_status,
      event.latitude,
      event.longitude,
      event.accuracy,
      event.captured_at,
      event.received_at,
      JSON.stringify(event.metadata ?? {}),
      now,
    );
  }
}
