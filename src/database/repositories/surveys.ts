import { getDatabase } from '@/database/db';
import type { MobileProfile, MobileSurvey, MobileSurveyCustomer, MobileSurveyItem } from '@/types/api';
import { listSurveyPhotos, replaceServerSurveyPhotos } from '@/database/repositories/survey-photos';
import { listSurveyFieldEvents, replaceServerFieldEvents } from '@/database/repositories/field-events';

type SurveyRow = {
  id: number;
  public_id: string | null;
  survey_number: string;
  survey_date: string;
  scheduled_time: string | null;
  address: string | null;
  notes: string | null;
  status: string;
  version: number;
  started_at: string | null;
  completed_at: string | null;
  server_updated_at: string | null;
  customer_json: string | null;
};

type ItemRow = {
  local_uuid: string;
  server_id: number | null;
  survey_id: number;
  product_id: number;
  product_name: string;
  group_code: string | null;
  group_title: string | null;
  measurements_json: string;
  quantity: number;
  notes: string | null;
  sort_order: number;
  billing_unit: string | null;
  volume: number | null;
};

function parseCustomer(value: string | null): MobileSurveyCustomer | null {
  if (!value) return null;
  try { return JSON.parse(value) as MobileSurveyCustomer; } catch { return null; }
}

function rowToItem(row: ItemRow): MobileSurveyItem {
  return {
    id: row.server_id,
    mobile_uuid: row.local_uuid.startsWith('server:') ? null : row.local_uuid,
    product_id: row.product_id,
    product_name: row.product_name,
    group_code: row.group_code,
    group_title: row.group_title,
    measurements: JSON.parse(row.measurements_json) as Record<string, string | number>,
    quantity: row.quantity,
    notes: row.notes,
    sort_order: row.sort_order,
    billing_unit: row.billing_unit,
    volume: row.volume,
  };
}

async function rowToSurvey(row: SurveyRow): Promise<MobileSurvey> {
  const db = await getDatabase();
  const itemRows = await db.getAllAsync<ItemRow>(
    `SELECT local_uuid, server_id, survey_id, product_id, product_name,
            group_code, group_title, measurements_json, quantity, notes,
            sort_order, billing_unit, volume
       FROM survey_items
      WHERE survey_id = ?
      ORDER BY sort_order, local_uuid`,
    row.id,
  );
  const photos = await listSurveyPhotos(row.id);
  const fieldEvents = await listSurveyFieldEvents(row.id);

  return {
    id: row.id,
    public_id: row.public_id ?? '',
    survey_number: row.survey_number,
    survey_date: row.survey_date,
    scheduled_time: row.scheduled_time,
    address: row.address,
    notes: row.notes,
    status: row.status,
    version: row.version,
    started_at: row.started_at,
    completed_at: row.completed_at,
    updated_at: row.server_updated_at,
    customer: parseCustomer(row.customer_json),
    items: itemRows.map(rowToItem),
    photos,
    field_events: fieldEvents,
  };
}


async function evictConflictingSurveyCaches(profile: MobileProfile, surveys: MobileSurvey[]): Promise<void> {
  if (surveys.length === 0) return;

  const db = await getDatabase();
  const incomingIds = surveys.map((survey) => survey.id);
  const placeholders = incomingIds.map(() => '?').join(', ');
  const conflicts = await db.getAllAsync<{ id: number; user_id: number; company_id: number }>(
    `SELECT id, user_id, company_id
       FROM surveys
      WHERE id IN (${placeholders})
        AND NOT (company_id = ? AND user_id = ?)`,
    ...incomingIds,
    profile.company.id,
    profile.user.id,
  );

  for (const conflict of conflicts) {
    const queued = await db.getAllAsync<{ payload_json: string }>(
      `SELECT payload_json
         FROM sync_queue
        WHERE company_id = ?
          AND user_id = ?
          AND status IN ('pending', 'processing', 'failed')
          AND resource_type IN ('survey', 'survey_item', 'survey_photo', 'field_event')`,
      conflict.company_id,
      conflict.user_id,
    );

    const hasUnsyncedWork = queued.some((row) => {
      try {
        const payload = JSON.parse(row.payload_json) as { surveyId?: number };
        return Number(payload.surveyId) === conflict.id;
      } catch {
        // Unknown queued payloads must never be discarded implicitly.
        return true;
      }
    });

    if (hasUnsyncedWork) {
      throw new Error('Another cached user has unsynced survey changes on this device. Sign in as that user and sync before switching assignments.');
    }

    await db.runAsync(
      'DELETE FROM surveys WHERE id = ? AND company_id = ? AND user_id = ?',
      conflict.id,
      conflict.company_id,
      conflict.user_id,
    );
  }
}

export async function replaceSurveySnapshot(profile: MobileProfile, surveys: MobileSurvey[]): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await evictConflictingSurveyCaches(profile, surveys);

    await db.runAsync(
      'DELETE FROM surveys WHERE company_id = ? AND user_id = ?',
      profile.company.id,
      profile.user.id,
    );

    for (const survey of surveys) {
      await db.runAsync(
        `INSERT INTO surveys (
          id, public_id, user_id, company_id, survey_number, survey_date, scheduled_time,
          address, notes, status, version, started_at, completed_at,
          server_updated_at, customer_json, local_updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        survey.id,
        survey.public_id,
        profile.user.id,
        profile.company.id,
        survey.survey_number,
        survey.survey_date,
        survey.scheduled_time,
        survey.address,
        survey.notes,
        survey.status,
        survey.version,
        survey.started_at,
        survey.completed_at,
        survey.updated_at,
        survey.customer ? JSON.stringify(survey.customer) : null,
        now,
      );

      for (const item of survey.items) {
        const localUuid = item.mobile_uuid ?? `server:${item.id ?? cryptoSafeFallback(survey.id, item.sort_order)}`;
        await db.runAsync(
          `INSERT INTO survey_items (
            local_uuid, server_id, survey_id, product_id, product_name,
            group_code, group_title, measurements_json, quantity, notes,
            sort_order, billing_unit, volume, local_updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          localUuid,
          item.id,
          survey.id,
          item.product_id,
          item.product_name,
          item.group_code,
          item.group_title,
          JSON.stringify(item.measurements ?? {}),
          item.quantity,
          item.notes,
          item.sort_order,
          item.billing_unit,
          item.volume,
          now,
        );
      }

      await replaceServerSurveyPhotos(survey.id, survey.photos ?? []);
      await replaceServerFieldEvents(survey.id, survey.field_events ?? []);
    }
  });
}

function cryptoSafeFallback(surveyId: number, sortOrder: number): string {
  return `${surveyId}-${sortOrder}`;
}

export async function listSurveys(profile: MobileProfile): Promise<MobileSurvey[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SurveyRow>(
    `SELECT id, public_id, survey_number, survey_date, scheduled_time, address, notes,
            status, version, started_at, completed_at, server_updated_at, customer_json
       FROM surveys
      WHERE company_id = ? AND user_id = ?
      ORDER BY survey_date, COALESCE(scheduled_time, '23:59'), id`,
    profile.company.id,
    profile.user.id,
  );
  return Promise.all(rows.map(rowToSurvey));
}

export async function getSurvey(profile: MobileProfile, surveyId: number): Promise<MobileSurvey | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SurveyRow>(
    `SELECT id, public_id, survey_number, survey_date, scheduled_time, address, notes,
            status, version, started_at, completed_at, server_updated_at, customer_json
       FROM surveys
      WHERE company_id = ? AND user_id = ? AND id = ?`,
    profile.company.id,
    profile.user.id,
    surveyId,
  );
  return row ? rowToSurvey(row) : null;
}


export async function getSurveyByPublicId(profile: MobileProfile, publicId: string): Promise<MobileSurvey | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SurveyRow>(
    `SELECT id, public_id, survey_number, survey_date, scheduled_time, address, notes,
            status, version, started_at, completed_at, server_updated_at, customer_json
       FROM surveys
      WHERE company_id = ? AND user_id = ? AND public_id = ?`,
    profile.company.id,
    profile.user.id,
    publicId,
  );
  return row ? rowToSurvey(row) : null;
}

export async function updateSurveyLocal(input: {
  surveyId: number;
  status?: string;
  version?: number;
  startedAt?: string | null;
  completedAt?: string | null;
}): Promise<void> {
  const db = await getDatabase();
  const current = await db.getFirstAsync<SurveyRow>('SELECT * FROM surveys WHERE id = ?', input.surveyId);
  if (!current) throw new Error('Survey lokal tidak ditemukan.');

  await db.runAsync(
    `UPDATE surveys
        SET status = ?, version = ?, started_at = ?, completed_at = ?, local_updated_at = ?
      WHERE id = ?`,
    input.status ?? current.status,
    input.version ?? current.version,
    input.startedAt === undefined ? current.started_at : input.startedAt,
    input.completedAt === undefined ? current.completed_at : input.completedAt,
    new Date().toISOString(),
    input.surveyId,
  );
}

export async function upsertSurveyItemLocal(input: {
  surveyId: number;
  localUuid: string;
  serverId?: number | null;
  productId: number;
  productName: string;
  groupCode?: string | null;
  groupTitle?: string | null;
  measurements: Record<string, string | number>;
  quantity: number;
  notes?: string | null;
  sortOrder?: number;
  billingUnit?: string | null;
  volume?: number | null;
}): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const current = await db.getFirstAsync<{ sort_order: number }>(
    'SELECT sort_order FROM survey_items WHERE local_uuid = ?',
    input.localUuid,
  );
  let sortOrder = input.sortOrder ?? current?.sort_order;
  if (sortOrder === undefined) {
    const maxRow = await db.getFirstAsync<{ max_sort: number | null }>(
      'SELECT MAX(sort_order) AS max_sort FROM survey_items WHERE survey_id = ?',
      input.surveyId,
    );
    sortOrder = (maxRow?.max_sort ?? -1) + 1;
  }

  await db.runAsync(
    `INSERT INTO survey_items (
      local_uuid, server_id, survey_id, product_id, product_name, group_code,
      group_title, measurements_json, quantity, notes, sort_order,
      billing_unit, volume, local_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(local_uuid) DO UPDATE SET
      server_id = excluded.server_id,
      product_id = excluded.product_id,
      product_name = excluded.product_name,
      group_code = excluded.group_code,
      group_title = excluded.group_title,
      measurements_json = excluded.measurements_json,
      quantity = excluded.quantity,
      notes = excluded.notes,
      sort_order = excluded.sort_order,
      billing_unit = excluded.billing_unit,
      volume = excluded.volume,
      local_updated_at = excluded.local_updated_at`,
    input.localUuid,
    input.serverId ?? null,
    input.surveyId,
    input.productId,
    input.productName,
    input.groupCode ?? null,
    input.groupTitle ?? null,
    JSON.stringify(input.measurements),
    input.quantity,
    input.notes ?? null,
    sortOrder,
    input.billingUnit ?? null,
    input.volume ?? null,
    now,
  );
}

export async function deleteSurveyItemLocal(localUuid: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM survey_items WHERE local_uuid = ?', localUuid);
}
