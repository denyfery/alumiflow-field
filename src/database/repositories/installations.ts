import { getDatabase } from '@/database/db';
import { listInstallationEvents, replaceServerInstallationEvents } from '@/database/repositories/installation-events';
import { listInstallationIssues, replaceServerInstallationIssues } from '@/database/repositories/installation-issues';
import { listInstallationPhotos, replaceServerInstallationPhotos } from '@/database/repositories/installation-photos';
import type {
  MobileInstallation,
  MobileInstallationCustomer,
  MobileInstallationItem,
  MobileInstallationWorker,
  MobileProfile,
} from '@/types/api';

type InstallationRow = {
  id: number;
  public_id: string | null;
  job_id: number;
  job_number: string | null;
  job_title: string | null;
  scheduled_date: string;
  estimated_end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  version: number;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  server_updated_at: string | null;
  customer_json: string | null;
  workers_json: string;
  handover_json: string | null;
};

type ItemRow = {
  server_id: number;
  installation_id: number;
  product_id: number | null;
  product_name: string;
  description: string | null;
  group_code: string | null;
  group_title: string | null;
  measurements_json: string;
  volume: number | null;
  billing_unit: string | null;
  width_mm: number | null;
  height_mm: number | null;
  quantity: number;
  notes: string | null;
  sort_order: number;
};

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function rowToItem(row: ItemRow): MobileInstallationItem {
  return {
    id: row.server_id,
    product_id: row.product_id,
    product_name: row.product_name,
    description: row.description,
    group_code: row.group_code,
    group_title: row.group_title,
    measurements: parseJson(row.measurements_json, {} as Record<string, string | number>),
    volume: row.volume,
    billing_unit: row.billing_unit,
    width_mm: row.width_mm,
    height_mm: row.height_mm,
    quantity: row.quantity,
    notes: row.notes,
    sort_order: row.sort_order,
  };
}

async function rowToInstallation(row: InstallationRow): Promise<MobileInstallation> {
  const db = await getDatabase();
  const itemRows = await db.getAllAsync<ItemRow>(
    `SELECT server_id, installation_id, product_id, product_name, description,
            group_code, group_title, measurements_json, volume, billing_unit,
            width_mm, height_mm, quantity, notes, sort_order
       FROM installation_items
      WHERE installation_id = ?
      ORDER BY sort_order, server_id`,
    row.id,
  );

  return {
    id: row.id,
    public_id: row.public_id ?? '',
    job_id: row.job_id,
    job_number: row.job_number,
    job_title: row.job_title,
    scheduled_date: row.scheduled_date,
    estimated_end_date: row.estimated_end_date,
    start_time: row.start_time,
    end_time: row.end_time,
    status: row.status,
    version: row.version,
    notes: row.notes,
    started_at: row.started_at,
    completed_at: row.completed_at,
    updated_at: row.server_updated_at,
    customer: parseJson<MobileInstallationCustomer | null>(row.customer_json, null),
    workers: parseJson<MobileInstallationWorker[]>(row.workers_json, []),
    items: itemRows.map(rowToItem),
    photos: await listInstallationPhotos(row.id),
    issues: await listInstallationIssues(row.id),
    field_events: await listInstallationEvents(row.id),
    handover: parseJson(row.handover_json, null),
  };
}


async function evictConflictingInstallationCaches(
  profile: MobileProfile,
  installations: MobileInstallation[],
): Promise<void> {
  if (installations.length === 0) return;

  const db = await getDatabase();
  const incomingIds = installations.map((installation) => installation.id);
  const placeholders = incomingIds.map(() => '?').join(', ');
  const conflicts = await db.getAllAsync<{ id: number; user_id: number; company_id: number }>(
    `SELECT id, user_id, company_id
       FROM installations
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
          AND resource_type IN ('installation', 'installation_event', 'installation_issue', 'installation_photo')`,
      conflict.company_id,
      conflict.user_id,
    );

    const hasUnsyncedWork = queued.some((row) => {
      try {
        const payload = JSON.parse(row.payload_json) as { installationId?: number };
        return Number(payload.installationId) === conflict.id;
      } catch {
        // Unknown queued payloads must never be discarded implicitly.
        return true;
      }
    });

    if (hasUnsyncedWork) {
      throw new Error('Another cached user has unsynced installation changes on this device. Sign in as that user and sync before switching assignments.');
    }

    await db.runAsync(
      'DELETE FROM installations WHERE id = ? AND company_id = ? AND user_id = ?',
      conflict.id,
      conflict.company_id,
      conflict.user_id,
    );
  }
}

export async function replaceInstallationSnapshot(profile: MobileProfile, installations: MobileInstallation[]): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await evictConflictingInstallationCaches(profile, installations);

    await db.runAsync(
      'DELETE FROM installations WHERE company_id = ? AND user_id = ?',
      profile.company.id,
      profile.user.id,
    );

    for (const installation of installations) {
      await db.runAsync(
        `INSERT INTO installations (
          id, public_id, user_id, company_id, job_id, job_number, job_title,
          scheduled_date, estimated_end_date, start_time, end_time,
          status, version, notes, started_at, completed_at,
          server_updated_at, customer_json, workers_json, handover_json, local_updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        installation.id,
        installation.public_id,
        profile.user.id,
        profile.company.id,
        installation.job_id,
        installation.job_number,
        installation.job_title,
        installation.scheduled_date,
        installation.estimated_end_date,
        installation.start_time,
        installation.end_time,
        installation.status,
        installation.version,
        installation.notes,
        installation.started_at,
        installation.completed_at,
        installation.updated_at,
        installation.customer ? JSON.stringify(installation.customer) : null,
        JSON.stringify(installation.workers ?? []),
        installation.handover ? JSON.stringify(installation.handover) : null,
        now,
      );

      for (const item of installation.items) {
        await db.runAsync(
          `INSERT INTO installation_items (
            server_id, installation_id, product_id, product_name, description,
            group_code, group_title, measurements_json, volume, billing_unit,
            width_mm, height_mm, quantity, notes, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          item.id,
          installation.id,
          item.product_id,
          item.product_name,
          item.description,
          item.group_code,
          item.group_title,
          JSON.stringify(item.measurements ?? {}),
          item.volume,
          item.billing_unit,
          item.width_mm,
          item.height_mm,
          item.quantity,
          item.notes,
          item.sort_order,
        );
      }

      await replaceServerInstallationIssues(installation.id, installation.issues ?? []);
      await replaceServerInstallationPhotos(installation.id, installation.photos ?? []);
      await replaceServerInstallationEvents(installation.id, installation.field_events ?? []);
    }
  });
}

export async function listInstallations(profile: MobileProfile): Promise<MobileInstallation[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<InstallationRow>(
    `SELECT id, public_id, job_id, job_number, job_title, scheduled_date, estimated_end_date,
            start_time, end_time, status, version, notes, started_at, completed_at,
            server_updated_at, customer_json, workers_json, handover_json
       FROM installations
      WHERE company_id = ? AND user_id = ?
      ORDER BY scheduled_date, COALESCE(start_time, '23:59'), id`,
    profile.company.id,
    profile.user.id,
  );
  return Promise.all(rows.map(rowToInstallation));
}

export async function getInstallation(profile: MobileProfile, installationId: number): Promise<MobileInstallation | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<InstallationRow>(
    `SELECT id, public_id, job_id, job_number, job_title, scheduled_date, estimated_end_date,
            start_time, end_time, status, version, notes, started_at, completed_at,
            server_updated_at, customer_json, workers_json, handover_json
       FROM installations
      WHERE company_id = ? AND user_id = ? AND id = ?`,
    profile.company.id,
    profile.user.id,
    installationId,
  );
  return row ? rowToInstallation(row) : null;
}


export async function getInstallationByPublicId(profile: MobileProfile, publicId: string): Promise<MobileInstallation | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<InstallationRow>(
    `SELECT id, public_id, job_id, job_number, job_title, scheduled_date, estimated_end_date,
            start_time, end_time, status, version, notes, started_at, completed_at,
            server_updated_at, customer_json, workers_json, handover_json
       FROM installations
      WHERE company_id = ? AND user_id = ? AND public_id = ?`,
    profile.company.id,
    profile.user.id,
    publicId,
  );
  return row ? rowToInstallation(row) : null;
}

export async function updateInstallationLocal(input: {
  installationId: number;
  status?: string;
  version?: number;
  startedAt?: string | null;
  completedAt?: string | null;
  handover?: MobileInstallation['handover'];
}): Promise<void> {
  const db = await getDatabase();
  const current = await db.getFirstAsync<InstallationRow>('SELECT * FROM installations WHERE id = ?', input.installationId);
  if (!current) throw new Error('Local installation not found.');

  await db.runAsync(
    `UPDATE installations
        SET status = ?, version = ?, started_at = ?, completed_at = ?, handover_json = ?, local_updated_at = ?
      WHERE id = ?`,
    input.status ?? current.status,
    input.version ?? current.version,
    input.startedAt === undefined ? current.started_at : input.startedAt,
    input.completedAt === undefined ? current.completed_at : input.completedAt,
    input.handover === undefined ? current.handover_json : (input.handover ? JSON.stringify(input.handover) : null),
    new Date().toISOString(),
    input.installationId,
  );
}
