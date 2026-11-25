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

export function openDatabase(dbPath = resolveDbPath()): DatabaseSync {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(readSchemaSql());
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
