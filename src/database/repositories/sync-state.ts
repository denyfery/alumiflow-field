import { getDatabase } from '@/database/db';

export async function getSyncState(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM sync_state WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function setSyncState(key: string, value: string | null): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO sync_state (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    key,
    value,
    now,
  );
}
