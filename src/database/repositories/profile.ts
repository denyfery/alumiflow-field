import { getDatabase } from '@/database/db';
import type { MobileProfile } from '@/types/api';

type CachedProfileRow = {
  profile_json: string;
  server_verified_at: string;
};

export async function saveProfileCache(profile: MobileProfile, verifiedAt = new Date()): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO profile_cache (
      id, user_id, company_id, profile_json, server_verified_at, updated_at
    ) VALUES (1, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      company_id = excluded.company_id,
      profile_json = excluded.profile_json,
      server_verified_at = excluded.server_verified_at,
      updated_at = excluded.updated_at`,
    profile.user.id,
    profile.company.id,
    JSON.stringify(profile),
    verifiedAt.toISOString(),
    now,
  );
}

export async function getProfileCache(): Promise<{
  profile: MobileProfile;
  serverVerifiedAt: Date;
} | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<CachedProfileRow>(
    'SELECT profile_json, server_verified_at FROM profile_cache WHERE id = 1',
  );

  if (!row) return null;

  try {
    return {
      profile: JSON.parse(row.profile_json) as MobileProfile,
      serverVerifiedAt: new Date(row.server_verified_at),
    };
  } catch {
    await clearProfileCache();
    return null;
  }
}

export async function clearProfileCache(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM profile_cache WHERE id = 1');
}
