import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { runSeed } from '../scripts/seed-catalog.mjs';

const APP_ROOT = process.cwd();

function createTempEnv(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-academy-s3-'));
  return {
    dir,
    dbPath: path.join(dir, `${name}.sqlite`),
    reportPath: path.join(dir, `${name}-report.json`),
  };
}

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
  throw new Error(`Servidor não respondeu em ${url}`);
}

function extractSessionCookie(res) {
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/cm_academy_session=([^;]+)/);
  return match ? `cm_academy_session=${match[1]}` : '';
}

async function registerVerifyAndLogin(baseUrl, name, email, password) {
  const r1 = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  assert.equal(r1.status, 201);

  const mailRes = await fetch(
    `${baseUrl}/api/v1/dev/mailbox?email=${encodeURIComponent(email)}`,
  );
  const mailJson = await mailRes.json();
  const verifyToken = mailJson.messages[0].token_preview;

  const r2 = await fetch(`${baseUrl}/api/v1/auth/verify-email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: verifyToken }),
  });
  assert.equal(r2.status, 200);

  const r3 = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(r3.status, 200);
  return extractSessionCookie(r3);
}

test('Etapa 3: RBAC negativo/IDOR, cupom + snapshot imutável, refund, antifraude com recurso, dados bancários cifrados e CSV reconciliado', async () => {
  const { dir, dbPath, reportPath } = createTempEnv('e2e-stage3');
  runSeed({ dbPath, reportPath });

  const port = 3196;
  const baseUrl = `http://127.0.0.1:${port}`;
  const testHottok = 'stage3-hottok-secret-test';
  const productMap = JSON.stringify({
    'CM-IA-M1-PAID': { productId: '990001', offerCode: 'SANDBOX-M1' },
  });

  const nextBin = path.resolve(APP_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: APP_ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      ACADEMY_DB_PATH: dbPath,
      ACADEMY_DEV_MAILBOX: '1',
      ACADEMY_PAYOUT_ENCRYPTION_KEY: 'local-test-aes-key-stage3-only',
      HOTMART_MODE: 'sandbox',
      HOTMART_HOTTOK: testHottok,
      HOTMART_PRODUCT_MAP_JSON: productMap,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(`${baseUrl}/api/v1/contracts/surfaces`);

    const studentCookie = await registerVerifyAndLogin(
      baseUrl,
      'Aluno Comum',
      'aluno.comum@example.invalid',
      'SenhaForte#2026',
    );
    const affiliateCookie = await registerVerifyAndLogin(
      baseUrl,
      'Afiliado Um',
      'afiliado1@example.invalid',
      'SenhaForte#2026',
    );
    const instructorCookie = await registerVerifyAndLogin(
      baseUrl,
      'Professor Um',
      'professor1@example.invalid',
      'SenhaForte#2026',
    );

    // Configura perfis e escopos no banco (como operação/admin faria no onboarding)
    const db = new DatabaseSync(dbPath);
    const affUser = db.prepare(`SELECT id FROM users WHERE email = 'afiliado1@example.invalid'`).get();
    const profUser = db.prepare(`SELECT id FROM users WHERE email = 'professor1@example.invalid'`).get();

    db.prepare(
      `INSERT INTO partner_profiles (id, user_id, display_name, contact_email, status)
       VALUES ('prt_aff_1', ?, 'Afiliado Um', 'afiliado1@example.invalid', 'approved')`,
    ).run(affUser.id);
    db.prepare(
      `INSERT INTO partner_scopes (id, partner_id, role, course_id, campaign)
       VALUES ('psc_aff_1', 'prt_aff_1', 'affiliate', 'course_formacao_ia_anderzilla', 'geral')`,
    ).run();

    db.prepare(
      `INSERT INTO partner_profiles (id, user_id, display_name, contact_email, status)
       VALUES ('prt_prof_1', ?, 'Professor Um', 'professor1@example.invalid', 'approved')`,
    ).run(profUser.id);
    db.prepare(
      `INSERT INTO partner_scopes (id, partner_id, role, course_id, campaign)
       VALUES ('psc_prof_1', 'prt_prof_1', 'instructor', 'course_formacao_ia_anderzilla', 'geral')`,
    ).run();

    db.prepare(
      `INSERT INTO instructor_assignments (id, partner_id, course_id, live_event_id, role_label, prep_checklist_json)
       VALUES ('ia_prof_1', 'prt_prof_1', 'course_formacao_ia_anderzilla', 'live_formacao_ia_m1_kickoff', 'Professor titular', '[{"label":"Testar microfone","done":false}]')`,
    ).run();
    db.close();

    // 1. Testes negativos RBAC / IDOR
    const studentDenied = await fetch(`${baseUrl}/api/v1/partners/dashboard`, {
      headers: { cookie: studentCookie },
    });
    assert.equal(studentDenied.status, 403);

    const affAdminDenied = await fetch(`${baseUrl}/api/v1/admin/overview`, {
      headers: { cookie: affiliateCookie },
    });
    assert.equal(affAdminDenied.status, 403);

    const profAdminDenied = await fetch(`${baseUrl}/api/v1/admin/overview`, {
      headers: { cookie: instructorCookie },
    });
    assert.equal(profAdminDenied.status, 403);

    // Afiliado tenta alterar checklist do Professor -> 403
    const crossEditDenied = await fetch(`${baseUrl}/api/v1/partners/assignments/ia_prof_1`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: affiliateCookie },
      body: JSON.stringify({ recordingStatus: 'published' }),
    });
    assert.equal(crossEditDenied.status, 403);

    // Professor tenta criar cupom de afiliado -> 403
    const profCouponDenied = await fetch(`${baseUrl}/api/v1/partners/coupons`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: instructorCookie },
      body: JSON.stringify({
        courseId: 'course_formacao_ia_anderzilla',
        offerSku: 'CM-IA-M1-PAID',
        code: 'PROF10',
        discountType: 'percent',
        discountValue: 10,
      }),
    });
    assert.equal(profCouponDenied.status, 403);

    // Professor atualiza o próprio checklist -> 200
    const profOwnChecklist = await fetch(`${baseUrl}/api/v1/partners/assignments/ia_prof_1`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: instructorCookie },
      body: JSON.stringify({
        recordingStatus: 'recorded',
        checklist: [{ label: 'Testar microfone', done: true }],
      }),
    });
    assert.equal(profOwnChecklist.status, 200);

    // 2. Afiliado aceita termos, cadastra PIX cifrado e cria cupom PARCEIRO10
    const acceptTermsRes = await fetch(`${baseUrl}/api/v1/partners/terms/accept`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: affiliateCookie },
      body: JSON.stringify({ termsVersion: '2026-11-v1-rascunho' }),
    });
    assert.equal(acceptTermsRes.status, 200);

    const payoutRes = await fetch(`${baseUrl}/api/v1/partners/payout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: affiliateCookie },
      body: JSON.stringify({
        method: 'PIX',
        holderName: 'Afiliado Um LTDA',
        destinationKey: 'chave-pix-secreta-9876',
      }),
    });
    assert.equal(payoutRes.status, 200);
    const payoutJson = await payoutRes.json();
    assert.equal(payoutJson.maskedSummary, 'PIX ••••-9876');

    const couponRes = await fetch(`${baseUrl}/api/v1/partners/coupons`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: affiliateCookie },
      body: JSON.stringify({
        courseId: 'course_formacao_ia_anderzilla',
        offerSku: 'CM-IA-M1-PAID',
        code: 'PARCEIRO10',
        campaign: 'geral',
        discountType: 'percent',
        discountValue: 10,
      }),
    });
    assert.equal(couponRes.status, 201);

    // 3. Venda Hotmart com cupom PARCEIRO10 (R$ 100,00) atribui comissão v1 congelada sem PII do comprador
    const salePayload = {
      id: 'evt-partner-sale-001',
      creation_date: 1764090000000,
      event: 'PURCHASE_APPROVED',
      data: {
        product: { id: 990001 },
        buyer: { email: 'comprador.real@example.invalid' },
        purchase: {
          transaction: 'HP-PARTNER-0001',
          status: 'APPROVED',
          coupon: 'PARCEIRO10',
          offer: { code: 'SANDBOX-M1' },
          price: { value: 100, currency_value: 'BRL' },
        },
      },
    };
    const whSale = await fetch(`${baseUrl}/api/webhooks/hotmart`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hotmart-hottok': testHottok },
      body: JSON.stringify(salePayload),
    });
    assert.equal(whSale.status, 200);

    // 4. Atualiza regra de comissão para v2 (25%) e prova que o pedido já realizado mantém v1 congelado
    const db2 = new DatabaseSync(dbPath);
    db2.prepare(`UPDATE commission_rules SET status = 'superseded' WHERE id = 'crule_ia_m1_affiliate_v1'`).run();
    db2.prepare(
      `INSERT INTO commission_rules (id, rule_key, version, course_id, offer_sku, partner_role, campaign, calc_base, rate_bps, fixed_cents, warranty_days, status)
       VALUES ('crule_ia_m1_affiliate_v2', 'ia-m1-affiliate-default', 2, 'course_formacao_ia_anderzilla', 'CM-IA-M1-PAID', 'affiliate', 'geral', 'net_after_gateway', 2500, 0, 7, 'active')`,
    ).run();
    const frozenRow = db2
      .prepare(`SELECT rule_version, commission_cents, buyer_masked_label FROM commission_entries WHERE transaction_code = 'HP-PARTNER-0001'`)
      .get();
    db2.close();
    assert.equal(Number(frozenRow.rule_version), 1);
    assert.ok(Number(frozenRow.commission_cents) > 0);
    assert.ok(!String(frozenRow.buyer_masked_label).includes('comprador.real@example.invalid'));

    // 5. Autoindicação (mesmo e-mail do afiliado) gera sinalização proporcional com direito a recurso
    const selfRefPayload = {
      id: 'evt-partner-self-002',
      creation_date: 1764090500000,
      event: 'PURCHASE_APPROVED',
      data: {
        product: { id: 990001 },
        buyer: { email: 'afiliado1@example.invalid' },
        purchase: {
          transaction: 'HP-PARTNER-0002',
          status: 'APPROVED',
          coupon: 'PARCEIRO10',
          offer: { code: 'SANDBOX-M1' },
          price: { value: 100, currency_value: 'BRL' },
        },
      },
    };
    const whSelf = await fetch(`${baseUrl}/api/webhooks/hotmart`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hotmart-hottok': testHottok },
      body: JSON.stringify(selfRefPayload),
    });
    assert.equal(whSelf.status, 200);

    // 6. Refund bloqueia comissão da transação 0001 e preserva a trilha
    const refundPayload = {
      id: 'evt-partner-refund-001',
      creation_date: 1764091000000,
      event: 'PURCHASE_REFUNDED',
      data: {
        product: { id: 990001 },
        buyer: { email: 'comprador.real@example.invalid' },
        purchase: {
          transaction: 'HP-PARTNER-0001',
          status: 'REFUNDED',
          offer: { code: 'SANDBOX-M1' },
          price: { value: 100, currency_value: 'BRL' },
        },
      },
    };
    const whRefund = await fetch(`${baseUrl}/api/webhooks/hotmart`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hotmart-hottok': testHottok },
      body: JSON.stringify(refundPayload),
    });
    assert.equal(whRefund.status, 200);

    // 7. Dashboard e CSV reconciliam com as 2 vendas e não expõem e-mail do comprador nem chave PIX
    const dashRes = await fetch(`${baseUrl}/api/v1/partners/dashboard`, {
      headers: { cookie: affiliateCookie },
    });
    assert.equal(dashRes.status, 200);
    const dashText = await dashRes.text();
    assert.ok(!dashText.includes('comprador.real@example.invalid'));
    assert.ok(!dashText.includes('chave-pix-secreta-9876'));
    const dashJson = JSON.parse(dashText);
    assert.equal(dashJson.dashboard.commissions.length, 2);
    assert.equal(dashJson.dashboard.fraudFlags.length, 1);

    // Envia recurso da sinalização antifraude
    const flagId = dashJson.dashboard.fraudFlags[0].id;
    const appealRes = await fetch(`${baseUrl}/api/v1/partners/appeals`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: affiliateCookie },
      body: JSON.stringify({ flagId, appealNote: 'Compra de teste para validação de treinamento interno.' }),
    });
    assert.equal(appealRes.status, 200);

    // Exportação CSV reconcilia exatamente as 2 linhas
    const csvRes = await fetch(`${baseUrl}/api/v1/partners/statement/export`, {
      headers: { cookie: affiliateCookie },
    });
    assert.equal(csvRes.status, 200);
    const csvText = await csvRes.text();
    const csvLines = csvText.trim().split('\n');
    assert.equal(csvLines.length, 3); // header + 2 pedidos
    assert.ok(csvText.includes('HP-PARTNER-0001'));
    assert.ok(csvText.includes('blocked_refund'));
    assert.ok(!csvText.includes('comprador.real@example.invalid'));
  } finally {
    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 400));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
