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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-academy-s4-'));
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
  await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  const mailRes = await fetch(`${baseUrl}/api/v1/dev/mailbox?email=${encodeURIComponent(email)}`);
  const verifyToken = (await mailRes.json()).messages[0].token_preview;
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

test('Etapa 4 integrada: MFA obrigatório, ledger append-only CSV, maker-checker (2 admins), revogação de certificado e vinculação Stream', async () => {
  const { dir, dbPath, reportPath } = createTempEnv('e2e-stage4');
  runSeed({ dbPath, reportPath });

  const port = 3195;
  const baseUrl = `http://127.0.0.1:${port}`;
  const testHottok = 'stage4-hottok-secret-test';
  const adminMfa = '654321';
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
      ACADEMY_ADMIN_MFA_CODE: adminMfa,
      HOTMART_MODE: 'sandbox',
      HOTMART_HOTTOK: testHottok,
      HOTMART_PRODUCT_MAP_JSON: productMap,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(`${baseUrl}/api/v1/contracts/surfaces`);

    const admin1Cookie = await registerVerifyAndLogin(
      baseUrl,
      'Admin Maker',
      'admin1@example.invalid',
      'SenhaAdmin#2026',
    );
    const admin2Cookie = await registerVerifyAndLogin(
      baseUrl,
      'Admin Checker',
      'admin2@example.invalid',
      'SenhaAdmin#2026',
    );
    const affCookie = await registerVerifyAndLogin(
      baseUrl,
      'Parceiro Demo',
      'parceiro4@example.invalid',
      'SenhaParceiro#2026',
    );

    const db = new DatabaseSync(dbPath);
    const a1 = db.prepare(`SELECT id FROM users WHERE email = 'admin1@example.invalid'`).get();
    const a2 = db.prepare(`SELECT id FROM users WHERE email = 'admin2@example.invalid'`).get();
    const aff = db.prepare(`SELECT id FROM users WHERE email = 'parceiro4@example.invalid'`).get();

    db.prepare(`INSERT INTO user_roles (id, user_id, role, course_id) VALUES ('ur_a1', ?, 'admin', NULL)`).run(a1.id);
    db.prepare(`INSERT INTO user_roles (id, user_id, role, course_id) VALUES ('ur_a2', ?, 'admin', NULL)`).run(a2.id);

    db.prepare(
      `INSERT INTO partner_profiles (id, user_id, display_name, contact_email, status)
       VALUES ('prt_s4', ?, 'Parceiro Demo', 'parceiro4@example.invalid', 'approved')`,
    ).run(aff.id);
    db.prepare(
      `INSERT INTO partner_scopes (id, partner_id, role, course_id, campaign)
       VALUES ('psc_s4', 'prt_s4', 'affiliate', 'course_formacao_ia_anderzilla', 'geral')`,
    ).run();
    db.prepare(
      `INSERT INTO partner_coupons (id, partner_id, course_id, offer_sku, code, campaign, discount_type, discount_value, status)
       VALUES ('pcp_s4', 'prt_s4', 'course_formacao_ia_anderzilla', 'CM-IA-M1-PAID', 'STAGE4CUPOM', 'geral', 'percent', 10, 'active')`,
    ).run();
    db.prepare(
      `INSERT INTO certificates (id, verification_code, user_id, course_id, student_display_name, course_title, scope_label, workload_hours, status, template_notice)
       VALUES ('cert_s4', 'abcdef0123456789abcdef0123456789', ?, 'course_formacao_ia_anderzilla', 'Parceiro Demo', 'Formação IA', 'Módulo 1', 15, 'valid', 'Aviso revisável')`,
    ).run(aff.id);
    db.close();

    // 1. Admin SEM MFA é bloqueado (403 mfa_required)
    const noMfaRes = await fetch(`${baseUrl}/api/v1/admin/overview`, {
      headers: { cookie: admin1Cookie },
    });
    assert.equal(noMfaRes.status, 403);
    assert.equal((await noMfaRes.json()).code, 'mfa_required');

    // Parceiro nunca consegue validar MFA admin (403 forbidden)
    const partnerMfaDenied = await fetch(`${baseUrl}/api/v1/admin/mfa/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: affCookie },
      body: JSON.stringify({ code: adminMfa }),
    });
    assert.equal(partnerMfaDenied.status, 403);

    // Admin 1 e Admin 2 validam MFA
    for (const ck of [admin1Cookie, admin2Cookie]) {
      const mfaOk = await fetch(`${baseUrl}/api/v1/admin/mfa/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: ck },
        body: JSON.stringify({ code: adminMfa }),
      });
      assert.equal(mfaOk.status, 200);
    }

    // 2. Venda Hotmart com cupom gera lançamento no financial_ledger + comissão
    const whRes = await fetch(`${baseUrl}/api/webhooks/hotmart`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hotmart-hottok': testHottok },
      body: JSON.stringify({
        id: 'evt-s4-sale-001',
        creation_date: 1764095000000,
        event: 'PURCHASE_APPROVED',
        data: {
          product: { id: 990001 },
          buyer: { email: 'cliente.s4@example.invalid' },
          purchase: {
            transaction: 'HP-S4-0001',
            status: 'APPROVED',
            coupon: 'STAGE4CUPOM',
            offer: { code: 'SANDBOX-M1' },
            price: { value: 200, currency_value: 'BRL' },
          },
        },
      }),
    });
    assert.equal(whRes.status, 200);

    // Exportação CSV do ledger append-only
    const ledgerCsvRes = await fetch(`${baseUrl}/api/v1/admin/ledger/export`, {
      headers: { cookie: admin1Cookie },
    });
    assert.equal(ledgerCsvRes.status, 200);
    const ledgerCsv = await ledgerCsvRes.text();
    assert.ok(ledgerCsv.includes('HP-S4-0001'));
    assert.ok(ledgerCsv.includes('sale'));

    // 3. Maker-Checker: Admin 1 prepara lote -> Admin 1 NÃO pode aprovar (403) -> Admin 2 aprova -> marca pago manualmente
    const prepRes = await fetch(`${baseUrl}/api/v1/admin/payout-batches`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: admin1Cookie },
      body: JSON.stringify({ periodLabel: '2026-11', includePendingWarranty: true }),
    });
    assert.equal(prepRes.status, 201);
    const { batchId } = await prepRes.json();

    const selfApproveDenied = await fetch(
      `${baseUrl}/api/v1/admin/payout-batches/${batchId}/approve`,
      { method: 'POST', headers: { cookie: admin1Cookie } },
    );
    assert.equal(selfApproveDenied.status, 403);
    assert.equal((await selfApproveDenied.json()).code, 'maker_checker_violation');

    const checkerApproveOk = await fetch(
      `${baseUrl}/api/v1/admin/payout-batches/${batchId}/approve`,
      { method: 'POST', headers: { cookie: admin2Cookie } },
    );
    assert.equal(checkerApproveOk.status, 200);

    const markPaidOk = await fetch(
      `${baseUrl}/api/v1/admin/payout-batches/${batchId}/mark-paid`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: admin2Cookie },
        body: JSON.stringify({
          paymentMethod: 'PIX_MANUAL',
          paymentReference: 'E2E-MANUAL-9991',
          receiptRef: 'comprovante-2026-11.pdf',
        }),
      },
    );
    assert.equal(markPaidOk.status, 200);

    // 4. Revogação de certificado com motivo obrigatório refletida na página pública
    const revokeRes = await fetch(`${baseUrl}/api/v1/admin/certificates/revoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: admin1Cookie },
      body: JSON.stringify({
        verificationCode: 'abcdef0123456789abcdef0123456789',
        reason: 'Emissão de teste revogada após homologação.',
      }),
    });
    assert.equal(revokeRes.status, 200);

    const publicCert = await fetch(`${baseUrl}/certificados/abcdef0123456789abcdef0123456789`);
    assert.equal(publicCert.status, 200);
    const certHtml = await publicCert.text();
    assert.ok(certHtml.includes('Certificado revogado'));

    // 5. Vinculação de Stream UID em asset de aula via admin (sem segredos)
    const bindMedia = await fetch(`${baseUrl}/api/v1/admin/media`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: admin1Cookie },
      body: JSON.stringify({
        targetType: 'lesson_asset',
        code: 'VIDEO-A01',
        streamUid: 'cf_stream_uid_admin_01',
      }),
    });
    assert.equal(bindMedia.status, 200);
  } finally {
    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 400));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
