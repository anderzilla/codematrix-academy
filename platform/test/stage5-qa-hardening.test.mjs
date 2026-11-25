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

function createTempEnv(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-academy-s5-'));
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
      // aguarda
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

test('Hardening QA + Checkout Próprio Mercado Pago + Link /r/[code] + Balanço DRE + Correções P0/P1', async () => {
  const { dir, dbPath, reportPath } = createTempEnv('e2e-stage5');
  runSeed({ dbPath, reportPath });

  const port = 3194;
  const baseUrl = `http://127.0.0.1:${port}`;
  const mpSecret = 'mp-webhook-hmac-secret-test';
  const adminMfa = '778899';

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

    // 1. Healthcheck Azure
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);

    const adminCookie = await registerVerifyAndLogin(
      baseUrl,
      'Admin Principal',
      'admin.s5@example.invalid',
      'SenhaAdmin#2026',
    );
    const buyerCookie = await registerVerifyAndLogin(
      baseUrl,
      'Comprador Pix',
      'comprador.pix@example.invalid',
      'SenhaAluno#2026',
    );
    const partnerCookie = await registerVerifyAndLogin(
      baseUrl,
      'Parceiro MP',
      'parceiro.mp@example.invalid',
      'SenhaParceiro#2026',
    );

    const db = new DatabaseSync(dbPath);
    const a1 = db.prepare(`SELECT id FROM users WHERE email = 'admin.s5@example.invalid'`).get();
    const prt = db.prepare(`SELECT id FROM users WHERE email = 'parceiro.mp@example.invalid'`).get();
    db.prepare(`INSERT INTO user_roles (id, user_id, role, course_id) VALUES ('ur_a5', ?, 'admin', NULL)`).run(a1.id);
    // Publica oferta paga Módulo 1 com preço real R$ 197,00 para teste de checkout próprio
    db.prepare(`UPDATE offers SET status = 'published', price_cents = 19700 WHERE sku = 'CM-IA-M1-PAID'`).run();
    // Cria live paga exclusiva do Módulo 1 (para testar correção P0-5)
    db.prepare(
      `INSERT INTO live_events (id, course_id, module_id, code, title, scheduled_at, status, access_scope)
       VALUES ('live_paid_m1', 'course_formacao_ia_anderzilla', 'mod_formacao_ia_1', 'LIVE-PAGA-M1', 'Live Exclusiva M1', '2026-12-20T20:00:00-03:00', 'scheduled', 'course:formacao-ia-anderzilla:module:M1')`,
    ).run();
    // Cria perfil parceiro + link + cupom
    db.prepare(
      `INSERT INTO partner_profiles (id, user_id, display_name, contact_email, status)
       VALUES ('prt_mp', ?, 'Parceiro MP', 'parceiro.mp@example.invalid', 'approved')`,
    ).run(prt.id);
    db.prepare(
      `INSERT INTO partner_scopes (id, partner_id, role, course_id, campaign)
       VALUES ('psc_mp', 'prt_mp', 'affiliate', 'course_formacao_ia_anderzilla', 'geral')`,
    ).run();
    db.prepare(
      `INSERT INTO partner_links (id, partner_id, course_id, offer_sku, code, campaign, status)
       VALUES ('plk_mp', 'prt_mp', 'course_formacao_ia_anderzilla', 'CM-IA-M1-PAID', 'link-mp-top', 'geral', 'active')`,
    ).run();
    db.prepare(
      `INSERT INTO partner_coupons (id, partner_id, course_id, offer_sku, code, campaign, discount_type, discount_value, status)
       VALUES ('pcp_mp', 'prt_mp', 'course_formacao_ia_anderzilla', 'CM-IA-M1-PAID', 'PIX10', 'geral', 'percent', 10, 'active')`,
    ).run();
    db.close();

    // 2. Correção P0-5: aluno da amostra gratuita NÃO vê a live exclusiva do Módulo 1 pago
    await fetch(`${baseUrl}/api/v1/app/enroll-free`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: buyerCookie },
      body: JSON.stringify({ offerCode: 'formacao-ia-amostra-bloco-1' }),
    });
    const livesRes = await fetch(`${baseUrl}/api/v1/app/lives`, {
      headers: { cookie: buyerCookie },
    });
    const livesJson = await livesRes.json();
    assert.ok(!livesJson.lives.some((l) => l.code === 'LIVE-PAGA-M1'));

    // 3. Correção P0-6: clique no link de parceiro /r/link-mp-top incrementa clicks_count e retorna cookie
    const redirectRes = await fetch(`${baseUrl}/r/link-mp-top`, { redirect: 'manual' });
    assert.equal(redirectRes.status, 307);
    assert.ok((redirectRes.headers.get('set-cookie') || '').includes('cm_partner_ref=link-mp-top'));

    // 4. Checkout próprio Mercado Pago (Pix + cupom PIX10)
    const checkoutRes = await fetch(`${baseUrl}/api/v1/checkout/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: buyerCookie },
      body: JSON.stringify({
        offerCode: 'formacao-ia-modulo-1-rascunho',
        paymentMethod: 'pix',
        couponCode: 'PIX10',
        partnerLinkCode: 'link-mp-top',
      }),
    });
    assert.equal(checkoutRes.status, 201);
    const orderData = await checkoutRes.json();
    assert.equal(orderData.grossCents, 19700);
    assert.equal(orderData.discountCents, 1970);
    assert.equal(orderData.netPayableCents, 17730);

    // 5. Webhook Mercado Pago rejeita assinatura inválida (401) e aceita HMAC-SHA256 válido (200)
    const dataId = '987654321';
    const mpPayload = JSON.stringify({
      id: 'mp-evt-001',
      type: 'payment',
      data: { id: dataId, external_reference: orderData.orderCode, status: 'approved' },
    });
    const badSig = await fetch(`${baseUrl}/api/webhooks/mercadopago`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-signature': 'ts=123,v1=deadbeef' },
      body: mpPayload,
    });
    assert.equal(badSig.status, 401);

    const ts = String(Math.floor(Date.now() / 1000));
    const reqId = 'req-mp-001';
    const manifest = `id:${dataId};request-id:${reqId};ts:${ts};`;
    const v1 = crypto.createHmac('sha256', mpSecret).update(manifest, 'utf8').digest('hex');

    const okSig = await fetch(`${baseUrl}/api/webhooks/mercadopago`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': reqId,
        'x-signature': `ts=${ts},v1=${v1}`,
      },
      body: mpPayload,
    });
    assert.equal(okSig.status, 200);
    assert.equal((await okSig.json()).entitlementStatus, 'granted');

    // Agora o comprador tem acesso à live exclusiva do Módulo 1 pago!
    const livesAfterBuy = await (
      await fetch(`${baseUrl}/api/v1/app/lives`, { headers: { cookie: buyerCookie } })
    ).json();
    assert.ok(livesAfterBuy.lives.some((l) => l.code === 'LIVE-PAGA-M1'));

    // 6. Parceiro vê o clique (1) e a comissão atribuída pelo Pix com cupom PIX10
    const pDash = await (
      await fetch(`${baseUrl}/api/v1/partners/dashboard`, { headers: { cookie: partnerCookie } })
    ).json();
    assert.equal(pDash.dashboard.summary.totalClicks, 1);
    assert.equal(pDash.dashboard.commissions.length, 1);

    // 7. Admin valida MFA, consulta Balanço/DRE e cria novo curso via CRUD
    await fetch(`${baseUrl}/api/v1/admin/mfa/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ code: adminMfa }),
    });
    const balanceRes = await fetch(`${baseUrl}/api/v1/admin/finance/balance`, {
      headers: { cookie: adminCookie },
    });
    assert.equal(balanceRes.status, 200);
    const balanceJson = await balanceRes.json();
    assert.equal(Number(balanceJson.dre.gross_revenue_cents), 19700);
    assert.equal(Number(balanceJson.dre.coupon_discounts_cents), 1970);
    assert.ok(Number(balanceJson.dre.operating_net_result_cents) > 0);

    const createCourseRes = await fetch(`${baseUrl}/api/v1/admin/courses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({
        title: 'Automação Prática com IA',
        status: 'published',
        offerPriceCents: 29700,
      }),
    });
    assert.equal(createCourseRes.status, 201);

    // 8. Lista de espera Módulo 2 e reenvio de e-mail
    const wlRes = await fetch(`${baseUrl}/api/v1/waitlist`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: buyerCookie },
      body: JSON.stringify({
        courseId: 'course_formacao_ia_anderzilla',
        targetScope: 'module:M2',
      }),
    });
    assert.equal(wlRes.status, 200);

    const resendRes = await fetch(`${baseUrl}/api/v1/auth/resend-verification`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'naoexiste@example.invalid' }),
    });
    assert.equal(resendRes.status, 200);
  } finally {
    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 400));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
