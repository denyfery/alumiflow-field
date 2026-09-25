import { getDatabase } from '@/database/db';
import type { MobileInstallationIssue } from '@/types/api';

type IssueRow = {
  local_uuid: string;
  server_id: number | null;
  public_id: string | null;
  installation_id: number;
  category: string;
  title: string;
  description: string | null;
  severity: 'low' | 'medium' | 'high';
  blocks_completion: number;
  status: 'open' | 'resolved';
  customer_informed_at: string | null;
  reported_at: string;
  received_at: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  reported_by_json: string | null;
  resolved_by_json: string | null;
  sync_status: 'queued' | 'uploaded' | 'failed';
  last_error: string | null;
};

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function toIssue(row: IssueRow): MobileInstallationIssue {
  return {
    id: row.server_id,
    public_id: row.public_id,
    mobile_uuid: row.local_uuid,
    category: row.category as MobileInstallationIssue['category'],
    title: row.title,
    description: row.description,
    severity: row.severity,
    can_work_continue: row.blocks_completion === 0,
    blocks_completion: row.blocks_completion === 1,
    status: row.status,
    customer_informed_at: row.customer_informed_at,
    reported_at: row.reported_at,
    received_at: row.received_at,
    resolved_at: row.resolved_at,
    resolution_notes: row.resolution_notes,
    reported_by: parseJson(row.reported_by_json, null),
    resolved_by: parseJson(row.resolved_by_json, null),
    sync_status: row.sync_status,
    last_error: row.last_error,
  };
}

const SELECT = `SELECT local_uuid, server_id, public_id, installation_id, category, title,
  description, severity, blocks_completion, status, customer_informed_at, reported_at,
  received_at, resolved_at, resolution_notes, reported_by_json, resolved_by_json,
  sync_status, last_error
  FROM installation_issues`;

export async function listInstallationIssues(installationId: number): Promise<MobileInstallationIssue[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<IssueRow>(`${SELECT} WHERE installation_id = ? ORDER BY reported_at DESC, local_uuid DESC`, installationId);
  return rows.map(toIssue);
}

export async function getInstallationIssue(localUuid: string): Promise<MobileInstallationIssue | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<IssueRow>(`${SELECT} WHERE local_uuid = ?`, localUuid);
  return row ? toIssue(row) : null;
}

export async function insertQueuedInstallationIssue(input: {
  localUuid: string;
  installationId: number;
  category: MobileInstallationIssue['category'];
  title: string;
  description: string | null;
  severity: MobileInstallationIssue['severity'];
  canWorkContinue: boolean;
  customerInformed: boolean;
  reportedAt: string;
}): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO installation_issues (
      local_uuid, server_id, public_id, installation_id, category, title, description,
      severity, blocks_completion, status, customer_informed_at, reported_at, received_at,
      resolved_at, resolution_notes, reported_by_json, resolved_by_json, sync_status, last_error, local_updated_at
    ) VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?, 'open', ?, ?, NULL, NULL, NULL, NULL, NULL, 'queued', NULL, ?)`,
    input.localUuid,
    input.installationId,
    input.category,
    input.title.trim(),
    input.description?.trim() || null,
    input.severity,
    input.canWorkContinue ? 0 : 1,
    input.customerInformed ? now : null,
    input.reportedAt,
    now,
  );
}

export async function replaceServerInstallationIssues(installationId: number, issues: MobileInstallationIssue[]): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const pending = await db.getAllAsync<IssueRow>(`${SELECT} WHERE installation_id = ? AND sync_status != 'uploaded'`, installationId);

  await db.runAsync('DELETE FROM installation_issues WHERE installation_id = ?', installationId);
  for (const issue of issues) {
    await db.runAsync(
      `INSERT INTO installation_issues (
        local_uuid, server_id, public_id, installation_id, category, title, description,
        severity, blocks_completion, status, customer_informed_at, reported_at, received_at,
        resolved_at, resolution_notes, reported_by_json, resolved_by_json, sync_status, last_error, local_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', NULL, ?)`,
      issue.mobile_uuid,
      issue.id,
      issue.public_id,
      installationId,
      issue.category,
      issue.title,
      issue.description,
      issue.severity,
      issue.blocks_completion ? 1 : 0,
      issue.status,
      issue.customer_informed_at,
      issue.reported_at,
      issue.received_at,
      issue.resolved_at,
      issue.resolution_notes,
      issue.reported_by ? JSON.stringify(issue.reported_by) : null,
      issue.resolved_by ? JSON.stringify(issue.resolved_by) : null,
      now,
    );
  }

  const serverUuids = new Set(issues.map((issue) => issue.mobile_uuid));
  for (const row of pending) {
    if (serverUuids.has(row.local_uuid)) continue;
    await db.runAsync(
      `INSERT OR REPLACE INTO installation_issues (
        local_uuid, server_id, public_id, installation_id, category, title, description,
        severity, blocks_completion, status, customer_informed_at, reported_at, received_at,
        resolved_at, resolution_notes, reported_by_json, resolved_by_json, sync_status, last_error, local_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.local_uuid, row.server_id, row.public_id, row.installation_id, row.category, row.title,
      row.description, row.severity, row.blocks_completion, row.status, row.customer_informed_at,
      row.reported_at, row.received_at, row.resolved_at, row.resolution_notes, row.reported_by_json,
      row.resolved_by_json, row.sync_status, row.last_error, now,
    );
  }
}

export async function markInstallationIssueUploaded(localUuid: string, server: MobileInstallationIssue | undefined): Promise<void> {
  const db = await getDatabase();
  if (!server) {
    await db.runAsync(`UPDATE installation_issues SET sync_status='uploaded', last_error=NULL, local_updated_at=? WHERE local_uuid=?`, new Date().toISOString(), localUuid);
    return;
  }
  await db.runAsync(
    `UPDATE installation_issues SET server_id=?, public_id=?, status=?, customer_informed_at=?, received_at=?, resolved_at=?, resolution_notes=?, reported_by_json=?, resolved_by_json=?, sync_status='uploaded', last_error=NULL, local_updated_at=? WHERE local_uuid=?`,
    server.id, server.public_id, server.status, server.customer_informed_at, server.received_at,
    server.resolved_at, server.resolution_notes, server.reported_by ? JSON.stringify(server.reported_by) : null,
    server.resolved_by ? JSON.stringify(server.resolved_by) : null, new Date().toISOString(), localUuid,
  );
}

export async function markInstallationIssueFailed(localUuid: string, message: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE installation_issues SET sync_status='failed', last_error=?, local_updated_at=? WHERE local_uuid=?`, message, new Date().toISOString(), localUuid);
}
