import { getDatabase } from '@/database/db';
import type { MobileInstallationPhoto } from '@/types/api';

export type LocalInstallationPhotoRow = {
  local_uuid: string;
  server_id: number | null;
  installation_id: number;
  issue_mobile_uuid: string | null;
  type: 'before' | 'after' | 'issue';
  original_name: string | null;
  caption: string | null;
  local_uri: string | null;
  remote_url: string | null;
  mime: string | null;
  sync_status: 'queued' | 'uploading' | 'uploaded' | 'failed';
  last_error: string | null;
  created_at: string | null;
  local_updated_at: string;
};

export async function insertQueuedInstallationPhoto(input: {
  localUuid: string;
  installationId: number;
  type: 'before' | 'after' | 'issue';
  originalName: string;
  localUri: string;
  mime: string;
  caption?: string | null;
  issueMobileUuid?: string | null;
}): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO installation_photos (
      local_uuid, server_id, installation_id, issue_mobile_uuid, type, original_name, caption,
      local_uri, remote_url, mime, sync_status, last_error, created_at, local_updated_at
    ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, NULL, ?, 'queued', NULL, ?, ?)`,
    input.localUuid,
    input.installationId,
    input.issueMobileUuid ?? null,
    input.type,
    input.originalName,
    input.caption ?? null,
    input.localUri,
    input.mime,
    now,
    now,
  );
}

export async function getInstallationPhoto(localUuid: string): Promise<LocalInstallationPhotoRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<LocalInstallationPhotoRow>(
    `SELECT local_uuid, server_id, installation_id, issue_mobile_uuid, type, original_name, caption,
            local_uri, remote_url, mime, sync_status, last_error, created_at, local_updated_at
       FROM installation_photos WHERE local_uuid = ?`,
    localUuid,
  );
}

export async function listInstallationPhotos(installationId: number): Promise<MobileInstallationPhoto[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LocalInstallationPhotoRow>(
    `SELECT local_uuid, server_id, installation_id, issue_mobile_uuid, type, original_name, caption,
            local_uri, remote_url, mime, sync_status, last_error, created_at, local_updated_at
       FROM installation_photos
      WHERE installation_id = ?
      ORDER BY COALESCE(created_at, local_updated_at), local_uuid`,
    installationId,
  );
  return rows.map((row) => ({
    id: row.server_id,
    mobile_uuid: row.local_uuid.startsWith('server:') ? null : row.local_uuid,
    type: row.type,
    issue_mobile_uuid: row.issue_mobile_uuid,
    original_name: row.original_name,
    caption: row.caption,
    url: row.remote_url,
    created_at: row.created_at,
    local_uri: row.local_uri,
    sync_status: row.sync_status,
    last_error: row.last_error,
    mime: row.mime,
  }));
}

export async function replaceServerInstallationPhotos(installationId: number, photos: MobileInstallationPhoto[]): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync('DELETE FROM installation_photos WHERE installation_id = ?', installationId);
  for (const photo of photos) {
    const localUuid = photo.mobile_uuid ?? `server:${photo.id ?? `${installationId}-${photo.created_at ?? now}`}`;
    await db.runAsync(
      `INSERT INTO installation_photos (
        local_uuid, server_id, installation_id, issue_mobile_uuid, type, original_name, caption,
        local_uri, remote_url, mime, sync_status, last_error, created_at, local_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, 'uploaded', NULL, ?, ?)`,
      localUuid,
      photo.id,
      installationId,
      photo.issue_mobile_uuid ?? null,
      photo.type,
      photo.original_name,
      photo.caption,
      photo.url,
      photo.created_at,
      now,
    );
  }
}

export async function markInstallationPhotoStatus(
  localUuid: string,
  status: 'queued' | 'uploading' | 'uploaded' | 'failed',
  error: string | null = null,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE installation_photos SET sync_status = ?, last_error = ?, local_updated_at = ? WHERE local_uuid = ?',
    status,
    error,
    new Date().toISOString(),
    localUuid,
  );
}

export async function markInstallationPhotoUploaded(input: { localUuid: string; serverId: number | null; remoteUrl: string | null }): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE installation_photos
        SET server_id = ?, remote_url = ?, local_uri = NULL,
            sync_status = 'uploaded', last_error = NULL, local_updated_at = ?
      WHERE local_uuid = ?`,
    input.serverId,
    input.remoteUrl,
    new Date().toISOString(),
    input.localUuid,
  );
}

export async function deleteInstallationPhotoLocal(localUuid: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM installation_photos WHERE local_uuid = ?', localUuid);
}
