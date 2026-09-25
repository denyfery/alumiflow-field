import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('alumiflow-field.db');
  }
  return dbPromise;

}

export async function initializeDatabase(): Promise<void> {
  const db = await getDatabase();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const row = await db.getFirstAsync<{ version: number | null }>(
    'SELECT MAX(version) AS version FROM schema_migrations',
  );
  const currentVersion = row?.version ?? 0;

  if (currentVersion < 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS profile_cache (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          user_id INTEGER NOT NULL,
          company_id INTEGER NOT NULL,
          profile_json TEXT NOT NULL,
          server_verified_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sync_state (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sync_queue (
          operation_uuid TEXT PRIMARY KEY NOT NULL,
          user_id INTEGER NOT NULL,
          company_id INTEGER NOT NULL,
          resource_type TEXT NOT NULL,
          resource_uuid TEXT,
          action TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          idempotency_key TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'failed')),
          attempt_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          next_attempt_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS sync_queue_status_idx
          ON sync_queue (status, next_attempt_at, created_at);

        CREATE INDEX IF NOT EXISTS sync_queue_tenant_idx
          ON sync_queue (company_id, user_id, status);
      `);

      await db.runAsync(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        1,
        new Date().toISOString(),
      );
    });
  }


  if (currentVersion < 2) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY NOT NULL,
          company_id INTEGER NOT NULL,
          code TEXT,
          name TEXT NOT NULL,
          category TEXT,
          billing_unit TEXT NOT NULL,
          calculation_type TEXT NOT NULL,
          measurement_schema_json TEXT NOT NULL,
          updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS surveys (
          id INTEGER PRIMARY KEY NOT NULL,
          user_id INTEGER NOT NULL,
          company_id INTEGER NOT NULL,
          survey_number TEXT NOT NULL,
          survey_date TEXT NOT NULL,
          scheduled_time TEXT,
          address TEXT,
          notes TEXT,
          status TEXT NOT NULL,
          version INTEGER NOT NULL,
          started_at TEXT,
          completed_at TEXT,
          server_updated_at TEXT,
          customer_json TEXT,
          local_updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS survey_items (
          local_uuid TEXT PRIMARY KEY NOT NULL,
          server_id INTEGER,
          survey_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          product_name TEXT NOT NULL,
          group_code TEXT,
          group_title TEXT,
          measurements_json TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          notes TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0,
          billing_unit TEXT,
          volume REAL,
          local_updated_at TEXT NOT NULL,
          FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS surveys_assignment_idx
          ON surveys (company_id, user_id, survey_date, status);
        CREATE INDEX IF NOT EXISTS survey_items_survey_idx
          ON survey_items (survey_id, sort_order);
        CREATE INDEX IF NOT EXISTS products_company_name_idx
          ON products (company_id, name);
      `);

      await db.runAsync(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        2,
        new Date().toISOString(),
      );
    });
  }

  if (currentVersion < 3) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS survey_photos (
          local_uuid TEXT PRIMARY KEY NOT NULL,
          server_id INTEGER,
          survey_id INTEGER NOT NULL,
          category TEXT NOT NULL DEFAULT 'location',
          original_name TEXT,
          caption TEXT,
          local_uri TEXT,
          remote_url TEXT,
          mime TEXT,
          sync_status TEXT NOT NULL CHECK (sync_status IN ('queued', 'uploading', 'uploaded', 'failed')),
          last_error TEXT,
          created_at TEXT,
          local_updated_at TEXT NOT NULL,
          FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS survey_photos_survey_idx
          ON survey_photos (survey_id, created_at, local_uuid);
        CREATE INDEX IF NOT EXISTS survey_photos_sync_idx
          ON survey_photos (sync_status, survey_id);
      `);

      await db.runAsync(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        3,
        new Date().toISOString(),
      );
    });
  }

  if (currentVersion < 4) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS field_events (
          local_uuid TEXT PRIMARY KEY NOT NULL,
          server_id INTEGER,
          survey_id INTEGER NOT NULL,
          event_type TEXT NOT NULL,
          location_status TEXT NOT NULL,
          latitude REAL,
          longitude REAL,
          accuracy REAL,
          captured_at TEXT NOT NULL,
          received_at TEXT,
          metadata_json TEXT,
          sync_status TEXT NOT NULL CHECK (sync_status IN ('queued', 'uploaded', 'failed')),
          last_error TEXT,
          local_updated_at TEXT NOT NULL,
          FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS field_events_survey_idx
          ON field_events (survey_id, captured_at, local_uuid);
        CREATE INDEX IF NOT EXISTS field_events_sync_idx
          ON field_events (sync_status, survey_id);
      `);

      await db.runAsync(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        4,
        new Date().toISOString(),
      );
    });
  }


  if (currentVersion < 5) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS installations (
          id INTEGER PRIMARY KEY NOT NULL,
          user_id INTEGER NOT NULL,
          company_id INTEGER NOT NULL,
          job_id INTEGER NOT NULL,
          job_number TEXT,
          job_title TEXT,
          scheduled_date TEXT NOT NULL,
          estimated_end_date TEXT,
          start_time TEXT,
          end_time TEXT,
          status TEXT NOT NULL,
          version INTEGER NOT NULL,
          notes TEXT,
          started_at TEXT,
          completed_at TEXT,
          server_updated_at TEXT,
          customer_json TEXT,
          workers_json TEXT NOT NULL,
          local_updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS installation_items (
          server_id INTEGER PRIMARY KEY NOT NULL,
          installation_id INTEGER NOT NULL,
          product_id INTEGER,
          product_name TEXT NOT NULL,
          description TEXT,
          group_code TEXT,
          group_title TEXT,
          measurements_json TEXT NOT NULL,
          volume REAL,
          billing_unit TEXT,
          width_mm REAL,
          height_mm REAL,
          quantity INTEGER NOT NULL,
          notes TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (installation_id) REFERENCES installations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS installation_photos (
          local_uuid TEXT PRIMARY KEY NOT NULL,
          server_id INTEGER,
          installation_id INTEGER NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('before', 'after', 'issue')),
          original_name TEXT,
          caption TEXT,
          local_uri TEXT,
          remote_url TEXT,
          mime TEXT,
          sync_status TEXT NOT NULL CHECK (sync_status IN ('queued', 'uploading', 'uploaded', 'failed')),
          last_error TEXT,
          created_at TEXT,
          local_updated_at TEXT NOT NULL,
          FOREIGN KEY (installation_id) REFERENCES installations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS installation_events (
          local_uuid TEXT PRIMARY KEY NOT NULL,
          server_id INTEGER,
          installation_id INTEGER NOT NULL,
          event_type TEXT NOT NULL,
          location_status TEXT NOT NULL,
          latitude REAL,
          longitude REAL,
          accuracy REAL,
          captured_at TEXT NOT NULL,
          received_at TEXT,
          metadata_json TEXT,
          sync_status TEXT NOT NULL CHECK (sync_status IN ('queued', 'uploaded', 'failed')),
          last_error TEXT,
          local_updated_at TEXT NOT NULL,
          FOREIGN KEY (installation_id) REFERENCES installations(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS installations_assignment_idx
          ON installations (company_id, user_id, scheduled_date, status);
        CREATE INDEX IF NOT EXISTS installation_items_installation_idx
          ON installation_items (installation_id, sort_order, server_id);
        CREATE INDEX IF NOT EXISTS installation_photos_installation_idx
          ON installation_photos (installation_id, type, created_at, local_uuid);
        CREATE INDEX IF NOT EXISTS installation_photos_sync_idx
          ON installation_photos (sync_status, installation_id);
        CREATE INDEX IF NOT EXISTS installation_events_installation_idx
          ON installation_events (installation_id, captured_at, local_uuid);
        CREATE INDEX IF NOT EXISTS installation_events_sync_idx
          ON installation_events (sync_status, installation_id);
      `);

      await db.runAsync(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        5,
        new Date().toISOString(),
      );
    });
  }

  if (currentVersion < 6) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE installations ADD COLUMN handover_json TEXT;
      `);

      await db.runAsync(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        6,
        new Date().toISOString(),
      );
    });
  }

  if (currentVersion < 7) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE surveys ADD COLUMN public_id TEXT;
        ALTER TABLE installations ADD COLUMN public_id TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS surveys_public_id_idx ON surveys (public_id);
        CREATE UNIQUE INDEX IF NOT EXISTS installations_public_id_idx ON installations (public_id);
      `);

      await db.runAsync(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        7,
        new Date().toISOString(),
      );
    });
  }

  if (currentVersion < 8) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE installation_photos ADD COLUMN issue_mobile_uuid TEXT;

        CREATE TABLE IF NOT EXISTS installation_issues (
          local_uuid TEXT PRIMARY KEY NOT NULL,
          server_id INTEGER,
          public_id TEXT,
          installation_id INTEGER NOT NULL,
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          severity TEXT NOT NULL,
          blocks_completion INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL,
          customer_informed_at TEXT,
          reported_at TEXT NOT NULL,
          received_at TEXT,
          resolved_at TEXT,
          resolution_notes TEXT,
          reported_by_json TEXT,
          resolved_by_json TEXT,
          sync_status TEXT NOT NULL CHECK (sync_status IN ('queued', 'uploaded', 'failed')),
          last_error TEXT,
          local_updated_at TEXT NOT NULL,
          FOREIGN KEY (installation_id) REFERENCES installations(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS installation_issues_installation_idx
          ON installation_issues (installation_id, status, blocks_completion, reported_at);
        CREATE INDEX IF NOT EXISTS installation_issues_sync_idx
          ON installation_issues (sync_status, installation_id);
        CREATE INDEX IF NOT EXISTS installation_photos_issue_idx
          ON installation_photos (installation_id, issue_mobile_uuid);
      `);

      await db.runAsync(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        8,
        new Date().toISOString(),
      );
    });
  }

}
