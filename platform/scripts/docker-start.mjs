import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dbPath = process.env.ACADEMY_DB_PATH?.trim() || path.resolve(process.cwd(), 'data', 'academy.sqlite');
const seedTemplatePath = path.resolve(process.cwd(), 'seed-data', 'academy.sqlite');

if (dbPath !== ':memory:') {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (!fs.existsSync(dbPath) && fs.existsSync(seedTemplatePath)) {
    fs.copyFileSync(seedTemplatePath, dbPath);
    console.log(`[academy-boot] Catálogo inicial copiado para ${dbPath}`);
  }
}

await import(pathToFileURL(path.resolve(process.cwd(), 'server.js')).href);
