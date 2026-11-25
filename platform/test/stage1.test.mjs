import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { runSeed } from '../scripts/seed-catalog.mjs';

const APP_ROOT = process.cwd();

function createTempDbPath(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-academy-test-'));
  return {
    dir,
    dbPath: path.join(dir, `${name}.sqlite`),
    reportPath: path.join(dir, `${name}-report.json`),
  };
}

test('seed é idempotente, preserva ordem das 15 aulas e diferencia publicado de rascunho', () => {
  const { dir, dbPath, reportPath } = createTempDbPath('seed-idempotent');
  try {
    const first = runSeed({ dbPath, reportPath });
    const second = runSeed({ dbPath, reportPath });

    assert.equal(first.migrated.coursesPublished, 1);
    assert.equal(first.migrated.coursesDraft, 1);
    assert.equal(first.migrated.modulesPublished, 1);
    assert.equal(first.migrated.modulesPlanned, 2);
    assert.equal(first.migrated.blocksPublished, 5);
    assert.equal(first.migrated.lessonsPublished, 15);
    assert.equal(first.migrated.slidesImported, 60);
    assert.equal(first.migrated.quizQuestionsImported, 60);
    assert.equal(first.migrated.offersPublished, 1);
    assert.equal(first.migrated.offersDraft, 2);
    assert.deepEqual(second.migrated, first.migrated);

    const db = new DatabaseSync(dbPath);
    try {
      const lessonPositions = db
        .prepare(`SELECT position, code FROM lessons ORDER BY position ASC`)
        .all();
      assert.equal(lessonPositions.length, 15);
      assert.deepEqual(
        lessonPositions.map((r) => Number(r.position)),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      );

      const publishedCourses = db
        .prepare(`SELECT slug FROM courses WHERE status = 'published'`)
        .all();
      assert.deepEqual(
        publishedCourses.map((r) => r.slug),
        ['formacao-ia-anderzilla'],
      );

      // Prova multi-curso sem alterar o schema
      db.prepare(
        `INSERT INTO courses (id, tenant_id, slug, title, status)
         VALUES ('course_second', 'tenant_codematrix', 'automacao-com-ia', 'Automação com IA', 'published')`,
      ).run();
      const totalPublished = db
        .prepare(`SELECT COUNT(*) AS cnt FROM courses WHERE status = 'published'`)
        .get();
      assert.equal(Number(totalPublished.cnt), 2);
    } finally {
      db.close();
    }

    assert.ok(fs.existsSync(reportPath));
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.ok(report.missingOrPending.length >= 3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // aguarda inicialização
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Servidor não respondeu em ${url} dentro de ${timeoutMs}ms`);
}

test('vitrine HTTP, isolamento de rascunhos e webhook Hotmart autenticado e idempotente', async () => {
  const { dir, dbPath, reportPath } = createTempDbPath('http-e2e');
  runSeed({ dbPath, reportPath });

  const port = 3199;
  const baseUrl = `http://127.0.0.1:${port}`;
  const testHottok = 'test-hottok-local-stage1-only';

  const nextBin = path.resolve(APP_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: APP_ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      ACADEMY_DB_PATH: dbPath,
      HOTMART_MODE: 'sandbox',
      HOTMART_HOTTOK: testHottok,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(`${baseUrl}/api/v1/contracts/surfaces`);

    // 1. Vitrine e páginas institucionais
    for (const route of [
      '/',
      '/cursos',
      '/cursos/formacao-ia-anderzilla',
      '/oferta/formacao-ia-amostra-bloco-1',
      '/suporte',
      '/privacidade',
      '/termos',
      '/app',
      '/partners',
      '/admin',
    ]) {
      const res = await fetch(`${baseUrl}${route}`);
      assert.equal(res.status, 200, `Rota ${route} deveria retornar 200`);
      const html = await res.text();
      assert.ok(!html.includes('correct_index'), `Rota ${route} não pode vazar gabarito`);
    }

    // 2. Curso em rascunho não aparece na API pública e retorna 404 na vitrine
    const catalogRes = await fetch(`${baseUrl}/api/v1/catalog`);
    assert.equal(catalogRes.status, 200);
    const catalogJson = await catalogRes.json();
    assert.equal(catalogJson.count, 1);
    assert.equal(catalogJson.courses[0].slug, 'formacao-ia-anderzilla');

    const draftCourseRes = await fetch(`${baseUrl}/cursos/ia-operacoes-pme-rascunho`);
    assert.equal(draftCourseRes.status, 404);

    // 3. Webhook Hotmart rejeita credencial inválida
    const fixtureRaw = fs.readFileSync(
      path.resolve(APP_ROOT, 'fixtures', 'hotmart', 'purchase-approved.json'),
      'utf8',
    );
    const invalidAuthRes = await fetch(`${baseUrl}/api/webhooks/hotmart`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hotmart-hottok': 'credencial-invalida',
      },
      body: fixtureRaw,
    });
    assert.equal(invalidAuthRes.status, 401);

    // 4. Webhook Hotmart rejeita schema inválido mesmo com credencial válida
    const invalidSchemaRes = await fetch(`${baseUrl}/api/webhooks/hotmart`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hotmart-hottok': testHottok,
      },
      body: JSON.stringify({ id: 'evt-bad', event: 'UNKNOWN_EVENT' }),
    });
    assert.equal(invalidSchemaRes.status, 400);

    // 5. Webhook Hotmart aceita fixture válida sem SKU mapeado e falha fechado (não concede direito)
    const firstWebhookRes = await fetch(`${baseUrl}/api/webhooks/hotmart`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hotmart-hottok': testHottok,
      },
      body: fixtureRaw,
    });
    assert.equal(firstWebhookRes.status, 200);
    const firstBody = await firstWebhookRes.json();
    assert.equal(firstBody.ok, true);
    assert.equal(firstBody.duplicate, false);
    assert.equal(firstBody.entitlementGranted, false);
    assert.equal(firstBody.entitlementStatus, 'unmapped_sku');

    // 6. Reenvio do mesmo evento é idempotente e não duplica registro no banco
    const dupWebhookRes = await fetch(`${baseUrl}/api/webhooks/hotmart`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hotmart-hottok': testHottok,
      },
      body: fixtureRaw,
    });
    assert.equal(dupWebhookRes.status, 200);
    const dupBody = await dupWebhookRes.json();
    assert.equal(dupBody.duplicate, true);
    assert.equal(dupBody.recordId, firstBody.recordId);

    const db = new DatabaseSync(dbPath);
    try {
      const countRow = db.prepare(`SELECT COUNT(*) AS cnt FROM payment_events`).get();
      assert.equal(Number(countRow.cnt), 1);
      const savedRow = db
        .prepare(`SELECT payload_sanitized_json FROM payment_events LIMIT 1`)
        .get();
      assert.ok(!String(savedRow.payload_sanitized_json).includes('aluno.teste@example.invalid'));
    } finally {
      db.close();
    }
  } finally {
    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 400));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('webhook Hotmart falha fechado (503) quando HOTMART_HOTTOK não está configurado', async () => {
  const { dir, dbPath, reportPath } = createTempDbPath('http-fail-closed');
  runSeed({ dbPath, reportPath });

  const port = 3198;
  const baseUrl = `http://127.0.0.1:${port}`;
  const nextBin = path.resolve(APP_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');

  const envWithoutHottok = { ...process.env, NODE_ENV: 'production', ACADEMY_DB_PATH: dbPath, HOTMART_MODE: 'production' };
  delete envWithoutHottok.HOTMART_HOTTOK;

  const child = spawn(process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: APP_ROOT,
    env: envWithoutHottok,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(`${baseUrl}/api/v1/contracts/surfaces`);
    const fixtureRaw = fs.readFileSync(
      path.resolve(APP_ROOT, 'fixtures', 'hotmart', 'purchase-approved.json'),
      'utf8',
    );
    const res = await fetch(`${baseUrl}/api/webhooks/hotmart`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hotmart-hottok': 'qualquer-valor',
      },
      body: fixtureRaw,
    });
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.code, 'missing_hottok_config');
  } finally {
    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 400));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
