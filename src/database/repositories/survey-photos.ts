import { getDatabase } from '@/database/db';
import type { MobileSurveyPhoto } from '@/types/api';

export type LocalSurveyPhotoRow = {
  local_uuid: string;
  server_id: number | null;
  survey_id: number;
  category: string;
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

export async function insertQueuedSurveyPhoto(input: {
  localUuid: string;
  surveyId: number;
  category: string;
  originalName: string;
  localUri: string;
  mime: string;
  caption?: string | null;
}): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO survey_photos (
      local_uuid, server_id, survey_id, category, original_name, caption,
      local_uri, remote_url, mime, sync_status, last_error, created_at, local_updated_at
    ) VALUES (?, NULL, ?, ?, ?, ?, ?, NULL, ?, 'queued', NULL, ?, ?)`,
    input.localUuid,
    input.surveyId,
    input.category,
    input.originalName,
    input.caption ?? null,
    input.localUri,
    input.mime,
    now,
    now,
  );
}

export async function getSurveyPhoto(localUuid: string): Promise<LocalSurveyPhotoRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<LocalSurveyPhotoRow>(
    `SELECT local_uuid, server_id, survey_id, category, original_name, caption,
            local_uri, remote_url, mime, sync_status, last_error, created_at, local_updated_at
       FROM survey_photos
      WHERE local_uuid = ?`,
    localUuid,
  );
}

export async function listSurveyPhotos(surveyId: number): Promise<MobileSurveyPhoto[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LocalSurveyPhotoRow>(
    `SELECT local_uuid, server_id, survey_id, category, original_name, caption,
            local_uri, remote_url, mime, sync_status, last_error, created_at, local_updated_at
       FROM survey_photos
      WHERE survey_id = ?
      ORDER BY COALESCE(created_at, local_updated_at), local_uuid`,
    surveyId,
  );
  return rows.map((row) => ({
    id: row.server_id,
    mobile_uuid: row.local_uuid.startsWith('server:') ? null : row.local_uuid,
    category: row.category,
    original_name: row.original_name,
    caption: row.caption,
    url: row.remote_url,
    created_at: row.created_at,
    local_uri: row.local_uri,
    sync_status: row.sync_status,
    last_error: row.last_error,
  }));
}

export async function replaceServerSurveyPhotos(surveyId: number, photos: MobileSurveyPhoto[]): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync('DELETE FROM survey_photos WHERE survey_id = ?', surveyId);
  for (const photo of photos) {
    const localUuid = photo.mobile_uuid ?? `server:${photo.id ?? `${surveyId}-${photo.created_at ?? now}`}`;
    await db.runAsync(
      `INSERT INTO survey_photos (
        local_uuid, server_id, survey_id, category, original_name, caption,
        local_uri, remote_url, mime, sync_status, last_error, created_at, local_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL, 'uploaded', NULL, ?, ?)`,
      localUuid,
      photo.id,
      surveyId,
      photo.category,
      photo.original_name,
      photo.caption,
      photo.url,
      photo.created_at,
      now,
    );
  }
}

export async function markSurveyPhotoStatus(
  localUuid: string,
  status: 'queued' | 'uploading' | 'uploaded' | 'failed',
  error: string | null = null,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE survey_photos SET sync_status = ?, last_error = ?, local_updated_at = ? WHERE local_uuid = ?`,
    status,
    error,
    new Date().toISOString(),
    localUuid,
  );
}

export async function markSurveyPhotoUploaded(input: {
  localUuid: string;
  serverId: number | null;
  remoteUrl: string | null;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE survey_photos
        SET server_id = ?, remote_url = ?, local_uri = NULL,
            sync_status = 'uploaded', last_error = NULL, local_updated_at = ?
      WHERE local_uuid = ?`,
    input.serverId,
    input.remoteUrl,
    new Date().toISOString(),
    input.localUuid,
  );
}


export async function deleteSurveyPhotoLocal(localUuid: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM survey_photos WHERE local_uuid = ?', localUuid);
}
