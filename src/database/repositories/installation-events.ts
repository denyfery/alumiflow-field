import { getDatabase } from '@/database/db';
import type { MobileInstallationFieldEvent } from '@/types/api';

type EventRow = {
  local_uuid: string;
  server_id: number | null;
  installation_id: number;
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

function rowToEvent(row: EventRow): MobileInstallationFieldEvent {
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

export async function listInstallationEvents(installationId: number): Promise<MobileInstallationFieldEvent[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<EventRow>(
    `SELECT local_uuid, server_id, installation_id, event_type, location_status,
            latitude, longitude, accuracy, captured_at, received_at,
            metadata_json, sync_status, last_error
       FROM installation_events
      WHERE installation_id = ?
      ORDER BY captured_at, local_uuid`,
    installationId,
  );
  return rows.map(rowToEvent);
}

export async function insertQueuedInstallationEvent(input: {
  localUuid: string;
  installationId: number;
  eventType: 'installation_started' | 'installation_completed';
  locationStatus: 'captured' | 'permission_denied' | 'unavailable' | 'timeout';
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  capturedAt: string;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO installation_events (
      local_uuid, server_id, installation_id, event_type, location_status,
      latitude, longitude, accuracy, captured_at, received_at,
      metadata_json, sync_status, last_error, local_updated_at
    ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'queued', NULL, ?)`,
    input.localUuid,
    input.installationId,
    input.eventType,
    input.locationStatus,
    input.latitude ?? null,
    input.longitude ?? null,
    input.accuracy ?? null,
    input.capturedAt,
    new Date().toISOString(),
  );
}

export async function markInstallationEventUploaded(localUuid: string, serverEvent?: MobileInstallationFieldEvent): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE installation_events
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

export async function markInstallationEventFailed(localUuid: string, message: string | null): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE installation_events SET sync_status = \'failed\', last_error = ?, local_updated_at = ? WHERE local_uuid = ?',
    message,
    new Date().toISOString(),
    localUuid,
  );
}

export async function replaceServerInstallationEvents(installationId: number, events: MobileInstallationFieldEvent[]): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync('DELETE FROM installation_events WHERE installation_id = ?', installationId);
  for (const event of events) {
    await db.runAsync(
      `INSERT INTO installation_events (
        local_uuid, server_id, installation_id, event_type, location_status,
        latitude, longitude, accuracy, captured_at, received_at,
        metadata_json, sync_status, last_error, local_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', NULL, ?)`,
      event.mobile_uuid,
      event.id,
      installationId,
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
