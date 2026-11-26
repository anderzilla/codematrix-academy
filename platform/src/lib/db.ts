import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const globalForDb = globalThis as unknown as {
  __academyDb?: DatabaseSync;
  __academyDbPath?: string;
};

export function resolveDbPath(): string {
  const configured = process.env.ACADEMY_DB_PATH?.trim();
  if (configured === ':memory:') {
    return ':memory:';
  }
  const baseDir = process.cwd();
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(baseDir, configured);
  }
  return path.resolve(baseDir, 'data', 'academy.sqlite');
}

function readSchemaSql(): string {
  const candidates = [
    path.resolve(process.cwd(), 'src', 'lib', 'schema.sql'),
    path.resolve(process.cwd(), 'platform', 'src', 'lib', 'schema.sql'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, 'utf8');
    }
  }
  throw new Error('Arquivo schema.sql não encontrado.');
}

function ensureColumn(db: DatabaseSync, table: string, column: string, definition: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

function applyIncrementalMigrations(db: DatabaseSync): void {
  ensureColumn(db, 'courses', 'active_version_id', 'TEXT');
  ensureColumn(db, 'entitlements', 'course_version_id', 'TEXT');
  ensureColumn(db, 'entitlements', 'offer_id', 'TEXT');
  ensureColumn(db, 'lesson_progress', 'course_version_id', 'TEXT');
  ensureColumn(db, 'quiz_attempts', 'course_version_id', 'TEXT');
  ensureColumn(db, 'certificates', 'course_version_id', 'TEXT');
  ensureColumn(db, 'orders', 'course_version_id', 'TEXT');
  ensureColumn(db, 'orders', 'offer_id', 'TEXT');
  ensureColumn(db, 'orders', 'partner_course_assignment_id', 'TEXT');
  ensureColumn(db, 'commission_entries', 'course_version_id', 'TEXT');
  ensureColumn(db, 'commission_entries', 'partner_course_assignment_id', 'TEXT');
  ensureColumn(db, 'financial_ledger', 'course_version_id', 'TEXT');

  db.prepare(
    `INSERT OR IGNORE INTO schema_migrations (version, name)
     VALUES ('20261126_01', 'multicourse_offer_grants_partner_assignments_and_versions')`,
  ).run();
}

export function openDatabase(dbPath = resolveDbPath()): DatabaseSync {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(readSchemaSql());
  applyIncrementalMigrations(db);
  return db;
}

export function getDb(): DatabaseSync {
  const targetPath = resolveDbPath();
  if (globalForDb.__academyDb && globalForDb.__academyDbPath === targetPath) {
    return globalForDb.__academyDb;
  }
  if (globalForDb.__academyDb) {
    globalForDb.__academyDb.close();
  }
  const db = openDatabase(targetPath);
  globalForDb.__academyDb = db;
  globalForDb.__academyDbPath = targetPath;
  return db;
}

export function closeDb(): void {
  if (globalForDb.__academyDb) {
    globalForDb.__academyDb.close();
    globalForDb.__academyDb = undefined;
    globalForDb.__academyDbPath = undefined;
  }
}
