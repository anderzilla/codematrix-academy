import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
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

function hashEmail(e) {
  return crypto.createHash('sha256').update(e.trim().toLowerCase(), 'utf8').digest('hex');
}

function hashPwd(p) {
  const s = crypto.randomBytes(16).toString('hex');
  return `scrypt$${s}$${crypto.scryptSync(p, s, 64).toString('hex')}`;
}

function bootstrapUsersFromEnv() {
  const masterEmail = process.env.ACADEMY_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const masterPass = process.env.ACADEMY_BOOTSTRAP_ADMIN_PASSWORD?.trim();
  if (!masterEmail || !masterPass || dbPath === ':memory:') return;

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');

  const upsertUser = (id, name, email, pwd) => {
    const norm = email.trim().toLowerCase();
    db.prepare(
      `INSERT INTO users (id, email, email_hash, name, password_hash, email_verified_at, status)
       VALUES (?, ?, ?, ?, ?, datetime('now'), 'active')
       ON CONFLICT(email) DO UPDATE SET
         name = excluded.name,
         password_hash = excluded.password_hash,
         email_verified_at = datetime('now'),
         status = 'active'`,
    ).run(id, norm, hashEmail(norm), name, hashPwd(pwd));
    return db.prepare(`SELECT id FROM users WHERE email = ?`).get(norm).id;
  };

  try {
    const masterId = upsertUser(
      'usr_founder_master',
      process.env.ACADEMY_BOOTSTRAP_ADMIN_NAME?.trim() || 'Administrador Master',
      masterEmail,
      masterPass,
    );

    db.prepare(`INSERT OR IGNORE INTO user_roles (id, user_id, role) VALUES ('ur_master_admin', ?, 'admin')`).run(masterId);
    db.prepare(`INSERT OR IGNORE INTO user_roles (id, user_id, role) VALUES ('ur_master_student', ?, 'student')`).run(masterId);
    db.prepare(
      `INSERT INTO partner_profiles (id, user_id, display_name, contact_email, status, terms_version, terms_accepted_at)
       VALUES ('prt_founder_master', ?, 'Administrador Master (Parceiro)', ?, 'approved', '2026-11-v1-rascunho', datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET status = 'approved', terms_accepted_at = datetime('now')`,
    ).run(masterId, masterEmail);

    const firstCourse = db.prepare(`SELECT id, slug FROM courses WHERE status = 'published' ORDER BY created_at ASC LIMIT 1`).get();
    if (firstCourse) {
      db.prepare(
        `INSERT OR IGNORE INTO course_partner_assignments (id, partner_id, course_id, role, status, granted_by)
         VALUES ('cpa_master_aff', 'prt_founder_master', ?, 'affiliate', 'active', ?),
                ('cpa_master_ins', 'prt_founder_master', ?, 'instructor', 'active', ?)`,
      ).run(firstCourse.id, masterId, firstCourse.id, masterId);
      db.prepare(
        `INSERT OR IGNORE INTO entitlements (id, user_id, buyer_email_hash, course_id, offer_sku, access_scope, source_provider, status)
         VALUES ('ent_master_full', ?, ?, ?, 'CM-MASTER-FULL', ?, 'manual', 'active')`,
      ).run(masterId, hashEmail(masterEmail), firstCourse.id, `course:${firstCourse.slug}:full`);
    }

    const partnerEmail = process.env.ACADEMY_BOOTSTRAP_PARTNER_EMAIL?.trim().toLowerCase();
    const partnerPass = process.env.ACADEMY_BOOTSTRAP_PARTNER_PASSWORD?.trim();
    if (partnerEmail && partnerPass && firstCourse) {
      const parcId = upsertUser('usr_founder_parceiro', 'Parceiro Teste', partnerEmail, partnerPass);
      db.prepare(
        `INSERT INTO partner_profiles (id, user_id, display_name, contact_email, status, terms_version, terms_accepted_at)
         VALUES ('prt_founder_test', ?, 'Parceiro Teste', ?, 'approved', '2026-11-v1-rascunho', datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET status = 'approved', terms_accepted_at = datetime('now')`,
      ).run(parcId, partnerEmail);
      db.prepare(
        `INSERT OR IGNORE INTO course_partner_assignments (id, partner_id, course_id, role, status, granted_by)
         VALUES ('cpa_test_aff', 'prt_founder_test', ?, 'affiliate', 'active', ?),
                ('cpa_test_ins', 'prt_founder_test', ?, 'instructor', 'active', ?)`,
      ).run(firstCourse.id, masterId, firstCourse.id, masterId);
    }

    const studentEmail = process.env.ACADEMY_BOOTSTRAP_STUDENT_EMAIL?.trim().toLowerCase();
    const studentPass = process.env.ACADEMY_BOOTSTRAP_STUDENT_PASSWORD?.trim();
    if (studentEmail && studentPass && firstCourse) {
      const alunoId = upsertUser('usr_founder_aluno', 'Aluno Teste', studentEmail, studentPass);
      db.prepare(`INSERT OR IGNORE INTO user_roles (id, user_id, role) VALUES ('ur_aluno_test', ?, 'student')`).run(alunoId);
      db.prepare(
        `INSERT OR IGNORE INTO entitlements (id, user_id, buyer_email_hash, course_id, offer_sku, access_scope, source_provider, status)
         VALUES ('ent_aluno_m1', ?, ?, ?, 'CM-IA-M1-PAID', ?, 'manual', 'active')`,
      ).run(alunoId, hashEmail(studentEmail), firstCourse.id, `course:${firstCourse.slug}:module:M01`);
    }

    console.log('[academy-boot] Contas administrativas/teste sincronizadas via env secrets.');
  } finally {
    db.close();
  }
}

bootstrapUsersFromEnv();

await import(pathToFileURL(path.resolve(process.cwd(), 'server.js')).href);
