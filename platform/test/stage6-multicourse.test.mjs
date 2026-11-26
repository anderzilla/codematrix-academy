import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { runSeed } from '../scripts/seed-catalog.mjs';

const APP_ROOT = process.cwd();

function createTempEnv(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `cm-academy-${prefix}-`));
  return {
    dir,
    dbPath: path.join(dir, 'academy.sqlite'),
    reportPath: path.join(dir, 'import-report.json'),
  };
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // aguarda inicialização
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Servidor não respondeu em ${url} dentro de ${timeoutMs}ms`);
}

function extractSessionCookie(res) {
  const setCookies =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [res.headers.get('set-cookie') || ''];
  for (const raw of setCookies) {
    const m = /cm_academy_session=([^;]+)/.exec(raw);
    if (m) return `cm_academy_session=${m[1]}`;
  }
  return '';
}

async function registerAndLogin(baseUrl, name, email, password) {
  const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  assert.equal(regRes.status, 201);
  const mb = await (await fetch(`${baseUrl}/api/v1/dev/mailbox?email=${encodeURIComponent(email)}`)).json();
  const verifyToken = mb.messages.find((m) => m.purpose === 'verify_email').token_preview;
  await fetch(`${baseUrl}/api/v1/auth/verify-email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: verifyToken }),
  });
  const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(loginRes.status, 200);
  return extractSessionCookie(loginRes);
}

function signMpWebhook(secret, dataId, reqId) {
  const ts = String(Math.floor(Date.now() / 1000));
  const manifest = `id:${dataId};request-id:${reqId};ts:${ts};`;
  const v1 = crypto.createHmac('sha256', secret).update(manifest, 'utf8').digest('hex');
  return { 'x-request-id': reqId, 'x-signature': `ts=${ts},v1=${v1}` };
}

test('Etapa 6 Multi-Curso: Curso A vs Curso B, isolamento aluno/parceiro, bundles offer_grants, suspensão sem perda histórica e DRE por curso', async () => {
  const { dir, dbPath, reportPath } = createTempEnv('e2e-stage6-mc');

  // Cenário 2: Seed idempotente executado 2x mantém integridade e 0 órfãos
  const seed1 = runSeed({ dbPath, reportPath });
  const seed2 = runSeed({ dbPath, reportPath });
  assert.equal(seed1.migrated.lessonsPublished, 15);
  assert.equal(seed2.migrated.lessonsPublished, 15);
  assert.equal(seed2.integrity.orphanModules, 0);
  assert.equal(seed2.integrity.orphanBlocks, 0);
  assert.equal(seed2.integrity.orphanLessons, 0);
  assert.ok(seed2.integrity.offerGrantsCount >= 3);

  const port = 3200 + crypto.randomInt(10, 600);
  const baseUrl = `http://127.0.0.1:${port}`;
  const mpSecret = 'mp-multicourse-secret-test';
  const adminMfa = '991122';

  const nextBin = path.resolve(APP_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: APP_ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      ACADEMY_DB_PATH: dbPath,
      ACADEMY_DEV_MAILBOX: '1',
      ACADEMY_ADMIN_MFA_CODE: adminMfa,
      MERCADOPAGO_MODE: 'sandbox',
      MERCADOPAGO_WEBHOOK_SECRET: mpSecret,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(`${baseUrl}/api/health`);

    // Cria usuários: admin, alunoA, alunoAB, parceiraA, parceiraAB
    const adminCookie = await registerAndLogin(baseUrl, 'Admin MC', 'admin.mc@codematrix.test', 'AdminMc#2026');
    const alunoACookie = await registerAndLogin(baseUrl, 'Aluno A', 'aluno.a@codematrix.test', 'AlunoA#2026');
    const alunoABCookie = await registerAndLogin(baseUrl, 'Aluno AB', 'aluno.ab@codematrix.test', 'AlunoAB#2026');
    const parceiraACookie = await registerAndLogin(baseUrl, 'Parceira A', 'parceira.a@codematrix.test', 'ParcA#2026');
    const parceiraABCookie = await registerAndLogin(baseUrl, 'Parceira AB', 'parceira.ab@codematrix.test', 'ParcAB#2026');

    const db = new DatabaseSync(dbPath);
    const adminRow = db.prepare(`SELECT id FROM users WHERE email = 'admin.mc@codematrix.test'`).get();
    const parcARow = db.prepare(`SELECT id FROM users WHERE email = 'parceira.a@codematrix.test'`).get();
    const parcABRow = db.prepare(`SELECT id FROM users WHERE email = 'parceira.ab@codematrix.test'`).get();

    db.prepare(`INSERT INTO user_roles (id, user_id, role) VALUES ('ur_adm_mc', ?, 'admin')`).run(adminRow.id);
    db.prepare(
      `INSERT INTO partner_profiles (id, user_id, display_name, contact_email, status, terms_version, terms_accepted_at)
       VALUES ('prt_a', ?, 'Parceira A', 'parceira.a@codematrix.test', 'approved', '2026-11-v1-rascunho', datetime('now'))`,
    ).run(parcARow.id);
    db.prepare(
      `INSERT INTO partner_profiles (id, user_id, display_name, contact_email, status, terms_version, terms_accepted_at)
       VALUES ('prt_ab', ?, 'Parceira AB', 'parceira.ab@codematrix.test', 'approved', '2026-11-v1-rascunho', datetime('now'))`,
    ).run(parcABRow.id);
    db.close();

    // Valida MFA do Admin
    const mfaRes = await fetch(`${baseUrl}/api/v1/admin/mfa/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ code: adminMfa }),
    });
    assert.equal(mfaRes.status, 200);

    // Cenário 1: Cria Curso A (published), Curso B (published), Curso R (review) e testa slug duplicado (409)
    const createA = await fetch(`${baseUrl}/api/v1/admin/courses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({
        title: 'Curso A — Automação Inteligente',
        slug: 'curso-a-automacao',
        category: 'Automação',
        status: 'published',
        offerPriceCents: 15000,
      }),
    });
    assert.equal(createA.status, 201);
    const courseA = await createA.json();

    const dupSlug = await fetch(`${baseUrl}/api/v1/admin/courses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ title: 'Duplicado', slug: 'curso-a-automacao', status: 'draft' }),
    });
    assert.equal(dupSlug.status, 409);

    const createB = await fetch(`${baseUrl}/api/v1/admin/courses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({
        title: 'Curso B — Segurança em Nuvem',
        slug: 'curso-b-seguranca',
        category: 'Segurança',
        status: 'published',
        offerPriceCents: 25000,
      }),
    });
    assert.equal(createB.status, 201);
    const courseB = await createB.json();

    const createReview = await fetch(`${baseUrl}/api/v1/admin/courses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({
        title: 'Curso R — Em Revisão',
        slug: 'curso-r-revisao',
        status: 'review',
      }),
    });
    assert.equal(createReview.status, 201);

    // Catálogo lista A e B, nunca R (review)
    const catJson = await (await fetch(`${baseUrl}/api/v1/catalog`)).json();
    assert.ok(catJson.courses.some((c) => c.slug === 'curso-a-automacao'));
    assert.ok(catJson.courses.some((c) => c.slug === 'curso-b-seguranca'));
    assert.ok(!catJson.courses.some((c) => c.slug === 'curso-r-revisao'));

    // Página /courses/:slug funciona para A e retorna 404 para review
    assert.equal((await fetch(`${baseUrl}/courses/curso-a-automacao`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/courses/curso-r-revisao`)).status, 404);

    // Popula estrutura mínima (módulo, bloco, aula, live, regra de comissão e bundle A+B) para A e B
    const db2 = new DatabaseSync(dbPath);
    for (const [tag, c, slug] of [
      ['a', courseA, 'curso-a-automacao'],
      ['b', courseB, 'curso-b-seguranca'],
    ]) {
      db2.prepare(
        `INSERT INTO modules (id, course_id, version_id, position, code, title, promise, status)
         VALUES (?, ?, ?, 1, 'M01', ?, 'Promessa', 'published')`,
      ).run(`mod_${tag}_1`, c.courseId, c.versionId, `Módulo 1 ${tag.toUpperCase()}`);
      db2.prepare(
        `INSERT INTO blocks (id, course_id, module_id, position, code, title, focus, status)
         VALUES (?, ?, ?, 1, 'B01', ?, 'Foco', 'published')`,
      ).run(`blk_${tag}_1`, c.courseId, `mod_${tag}_1`, `Bloco 1 ${tag.toUpperCase()}`);
      db2.prepare(
        `INSERT INTO lessons (id, course_id, module_id, block_id, position, code, title, goal, slides_count, content_json, status)
         VALUES (?, ?, ?, ?, 1, 'A01', ?, 'Objetivo', 1, '[{"title":"Slide 1","body":"Conteúdo"}]', 'published')`,
      ).run(`les_${tag}_1`, c.courseId, `mod_${tag}_1`, `blk_${tag}_1`, `Aula 1 ${tag.toUpperCase()}`);
      db2.prepare(
        `INSERT INTO live_events (id, course_id, module_id, code, title, scheduled_at, status, access_scope)
         VALUES (?, ?, ?, ?, ?, '2026-12-20T20:00:00-03:00', 'scheduled', ?)`,
      ).run(`live_${tag}_1`, c.courseId, `mod_${tag}_1`, `LIVE-${tag.toUpperCase()}`, `Live ${tag.toUpperCase()}`, `course:${slug}:full`);
      db2.prepare(
        `INSERT INTO commission_rules (id, rule_key, version, course_id, offer_sku, partner_role, campaign, calc_base, rate_bps, fixed_cents, warranty_days, status)
         VALUES (?, ?, 1, ?, ?, 'affiliate', 'geral', 'net_after_gateway', 1500, 0, 7, 'active')`,
      ).run(`crule_${tag}`, `rule-${tag}`, c.courseId, `CM-${slug.toUpperCase().slice(0, 16)}-FULL`);
    }

    // Oferta Bundle A+B com 2 offer_grants explícitos
    db2.prepare(
      `INSERT INTO offers (id, course_id, sku, offer_code, title, description, access_scope, is_free, price_cents, currency, status)
       VALUES ('ofr_bundle_ab', ?, 'CM-BUNDLE-AB', 'bundle-a-e-b', 'Bundle Curso A + Curso B', 'Acesso aos dois cursos', 'course:curso-a-automacao:full', 0, 32000, 'BRL', 'published')`,
    ).run(courseA.courseId);
    db2.prepare(
      `INSERT INTO offer_grants (id, offer_id, course_id, course_version_id, grant_type, target_code, access_scope)
       VALUES ('og_b_a', 'ofr_bundle_ab', ?, ?, 'course', 'full', 'course:curso-a-automacao:full'),
              ('og_b_b', 'ofr_bundle_ab', ?, ?, 'course', 'full', 'course:curso-b-seguranca:full')`,
    ).run(courseA.courseId, courseA.versionId, courseB.courseId, courseB.versionId);
    db2.close();

    // Cenário 4: Atribuição de parceiros por curso (Parceira A só em A; Parceira AB em A e B)
    const assignPA = await fetch(`${baseUrl}/api/v1/admin/courses/${courseA.courseId}/partners`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ partnerId: 'prt_a', role: 'affiliate' }),
    });
    assert.equal(assignPA.status, 201);
    const assignPAData = await assignPA.json();

    await fetch(`${baseUrl}/api/v1/admin/courses/${courseA.courseId}/partners`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ partnerId: 'prt_ab', role: 'affiliate' }),
    });
    await fetch(`${baseUrl}/api/v1/admin/courses/${courseB.courseId}/partners`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ partnerId: 'prt_ab', role: 'instructor' }),
    });

    // Parceira A vê somente Curso A; Parceira AB vê A e B
    const pACourses = await (await fetch(`${baseUrl}/api/v1/partners/courses`, { headers: { cookie: parceiraACookie } })).json();
    assert.equal(pACourses.courses.length, 1);
    assert.equal(pACourses.courses[0].courseId, courseA.courseId);

    const pABCourses = await (await fetch(`${baseUrl}/api/v1/partners/courses`, { headers: { cookie: parceiraABCookie } })).json();
    assert.equal(pABCourses.courses.length, 2);

    // Parceira A cria link em A (201) mas recebe 403 ao tentar criar link em B!
    const skuA = `CM-${'curso-a-automacao'.toUpperCase().slice(0, 16)}-FULL`;
    const skuB = `CM-${'curso-b-seguranca'.toUpperCase().slice(0, 16)}-FULL`;

    const linkAOk = await fetch(`${baseUrl}/api/v1/partners/links`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: parceiraACookie },
      body: JSON.stringify({ courseId: courseA.courseId, offerSku: skuA, code: 'link-parca-a' }),
    });
    assert.equal(linkAOk.status, 201);

    const linkBDenied = await fetch(`${baseUrl}/api/v1/partners/links`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: parceiraACookie },
      body: JSON.stringify({ courseId: courseB.courseId, offerSku: skuB, code: 'link-parca-b-proibido' }),
    });
    assert.equal(linkBDenied.status, 403);

    // Cenários 3, 5 e 8: Aluno A compra Curso A (via link da Parceira A); Aluno AB compra Bundle A+B
    const orderARes = await fetch(`${baseUrl}/api/v1/checkout/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: alunoACookie },
      body: JSON.stringify({ offerCode: 'curso-a-automacao-completo', paymentMethod: 'pix', partnerLinkCode: 'link-parca-a' }),
    });
    assert.equal(orderARes.status, 201);
    const orderA = await orderARes.json();

    const orderBundleRes = await fetch(`${baseUrl}/api/v1/checkout/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: alunoABCookie },
      body: JSON.stringify({ offerCode: 'bundle-a-e-b', paymentMethod: 'pix' }),
    });
    assert.equal(orderBundleRes.status, 201);
    const orderBundle = await orderBundleRes.json();

    // Dispara webhook Orders API ("order.processed") para orderA (e reenvia para testar idempotência!)
    const whBodyA = JSON.stringify({
      id: 'mp-ord-evt-a1',
      type: 'order',
      data: { id: 'ORD01TESTA', external_reference: orderA.orderCode, status: 'processed' },
    });
    const whA1 = await fetch(`${baseUrl}/api/webhooks/mercadopago`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...signMpWebhook(mpSecret, 'ORD01TESTA', 'req-a1') },
      body: whBodyA,
    });
    assert.equal(whA1.status, 200);
    const whA2 = await fetch(`${baseUrl}/api/webhooks/mercadopago`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...signMpWebhook(mpSecret, 'ORD01TESTA', 'req-a2') },
      body: whBodyA,
    });
    assert.equal((await whA2.json()).duplicate, true);

    // Dispara webhook Orders API para Bundle A+B
    const whBodyB = JSON.stringify({
      id: 'mp-ord-evt-ab1',
      type: 'order',
      data: { id: 'ORD01TESTAB', external_reference: orderBundle.orderCode, status: 'processed' },
    });
    const whAB = await fetch(`${baseUrl}/api/webhooks/mercadopago`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...signMpWebhook(mpSecret, 'ORD01TESTAB', 'req-ab1') },
      body: whBodyB,
    });
    assert.equal(whAB.status, 200);

    // Isolamento de aluno: Aluno A acessa Aula 1 de A (200), mas recebe 403 em Aula 1 de B!
    assert.equal((await fetch(`${baseUrl}/api/v1/app/courses/curso-a-automacao/lessons/A01`, { headers: { cookie: alunoACookie } })).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/v1/app/courses/curso-b-seguranca/lessons/A01`, { headers: { cookie: alunoACookie } })).status, 403);

    // Bundle concedeu exatamente A e B ao Aluno AB!
    assert.equal((await fetch(`${baseUrl}/api/v1/app/courses/curso-a-automacao/lessons/A01`, { headers: { cookie: alunoABCookie } })).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/v1/app/courses/curso-b-seguranca/lessons/A01`, { headers: { cookie: alunoABCookie } })).status, 200);

    // Cenário 6: Suspender vínculo da Parceira A no Curso A bloqueia novos links, mas preserva comissão histórica!
    const suspRes = await fetch(`${baseUrl}/api/v1/admin/courses/${courseA.courseId}/partners`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({
        assignmentId: assignPAData.assignmentId,
        status: 'suspended',
        reason: 'Encerramento contratual de campanha do Curso A',
      }),
    });
    assert.equal(suspRes.status, 200);
    const suspJson = await suspRes.json();
    assert.equal(suspJson.impact.affectedLinksCount, 1);
    assert.equal(suspJson.impact.historyPreserved, true);

    // Novo link em A agora é bloqueado (403), mas demonstrativo preserva a comissão anterior!
    const blockedNewLink = await fetch(`${baseUrl}/api/v1/partners/links`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: parceiraACookie },
      body: JSON.stringify({ courseId: courseA.courseId, offerSku: skuA, code: 'link-pos-suspensao' }),
    });
    assert.equal(blockedNewLink.status, 403);

    const pADashAfter = await (await fetch(`${baseUrl}/api/v1/partners/dashboard`, { headers: { cookie: parceiraACookie } })).json();
    assert.equal(pADashAfter.dashboard.commissions.length, 1);

    // Cenário 7: DRE filtrada por courseId separa A de B
    const dreA = await (await fetch(`${baseUrl}/api/v1/admin/finance/balance?courseId=${courseA.courseId}`, { headers: { cookie: adminCookie } })).json();
    const dreB = await (await fetch(`${baseUrl}/api/v1/admin/finance/balance?courseId=${courseB.courseId}`, { headers: { cookie: adminCookie } })).json();
    assert.ok(dreA.dre.gross_revenue_cents > 0);
    assert.equal(dreB.dre.gross_revenue_cents, 0);

    // Cenário 9: Imutabilidade de versão, bloqueio de DELETE físico (409) e controle negativo de acesso (403)
    const delA = await fetch(`${baseUrl}/api/v1/admin/courses/${courseA.courseId}`, {
      method: 'DELETE',
      headers: { cookie: adminCookie },
    });
    assert.equal(delA.status, 409);

    const ver2 = await fetch(`${baseUrl}/api/v1/admin/courses/${courseA.courseId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ action: 'publish_version', versionTag: 'v2.0', notes: 'Atualização curricular' }),
    });
    assert.equal(ver2.status, 201);
    const ver2Dup = await fetch(`${baseUrl}/api/v1/admin/courses/${courseA.courseId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ action: 'publish_version', versionTag: 'v2.0' }),
    });
    assert.equal(ver2Dup.status, 409);

    // Cenário 10: Aluno comum não acessa Admin nem Parceiros (403)
    assert.equal((await fetch(`${baseUrl}/api/v1/admin/courses`, { headers: { cookie: alunoACookie } })).status, 403);
    assert.equal((await fetch(`${baseUrl}/api/v1/partners/courses`, { headers: { cookie: alunoACookie } })).status, 403);
  } finally {
    child.kill('SIGTERM');
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignora lock temporário de arquivo no Windows durante encerramento do processo filho
    }
  }
});
