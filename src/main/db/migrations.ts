import type Database from 'better-sqlite3'

interface Migration {
  version: number
  sql: string
}

const migrations: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS folders (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        folder_id    INTEGER REFERENCES folders(id) ON DELETE SET NULL,
        parent_id    INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        title        TEXT NOT NULL,
        notes        TEXT,
        due_date     TEXT,
        completed    INTEGER NOT NULL DEFAULT 0,
        completed_at INTEGER,
        created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_folder ON tasks(folder_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);

      CREATE TABLE IF NOT EXISTS task_tags (
        task_id  INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        tag      TEXT NOT NULL,
        PRIMARY KEY (task_id, tag)
      );

      CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag);

      CREATE TABLE IF NOT EXISTS conversations (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS messages (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role            TEXT NOT NULL,
        content         TEXT NOT NULL,
        tool_use_id     TEXT,
        created_at      INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);

      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      INSERT OR IGNORE INTO settings (key, value) VALUES ('show_parent_tasks', 'false');
      INSERT OR IGNORE INTO settings (key, value) VALUES ('mcp_port', '3737');
    `
  },
  {
    version: 2,
    sql: `ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;`
  }
]

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  const getApplied = db.prepare('SELECT version FROM schema_migrations')
  const applied = new Set(
    (getApplied.all() as { version: number }[]).map((r) => r.version)
  )
  const insertMigration = db.prepare(
    'INSERT INTO schema_migrations (version) VALUES (?)'
  )

  for (const migration of migrations) {
    if (!applied.has(migration.version)) {
      db.exec(migration.sql)
      insertMigration.run(migration.version)
    }
  }
}
