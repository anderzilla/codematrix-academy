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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-academy-s2-'));
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

test('Etapa 2 ponta a ponta: auth, IDOR, amostra gratuita, Hotmart entitlement + refund, quiz no servidor, Stream RS256 e certificado público', async () => {
  const { dir, dbPath, reportPath } = createTempEnv('e2e-stage2');
  runSeed({ dbPath, reportPath });

  // Gera par de chaves RSA efêmero somente para validar assinatura RS256 do Cloudflare Stream
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  // Vincula um stream_uid sintético na Aula 01 para testar geração de token assinado
  const setupDb = new DatabaseSync(dbPath);
  setupDb
    .prepare(
      `UPDATE assets SET stream_uid = 'cf_uid_aula01_test', status = 'ready'
       WHERE code = 'VIDEO-A01'`,
    )
    .run();
  setupDb.close();

  const port = 3197;
  const baseUrl = `http://127.0.0.1:${port}`;
  const testHottok = 'stage2-hottok-secret-test';
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
      HOTMART_MODE: 'sandbox',
      HOTMART_HOTTOK: testHottok,
      HOTMART_PRODUCT_MAP_JSON: productMap,
      CLOUDFLARE_STREAM_SIGNING_KEY_ID: 'key_test_123',
      CLOUDFLARE_STREAM_SIGNING_PRIVATE_KEY: privateKey,
      CLOUDFLARE_STREAM_ALLOWED_ORIGINS: 'academy.codematrix.com.br',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(`${baseUrl}/api/v1/contracts/surfaces`);

    const studentEmail = 'aluno.teste@example.invalid';
    const studentPass = 'SenhaForte#2026';

    // 1. Cadastro + login bloqueado antes de verificar e-mail
    const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Maria Estudante', email: studentEmail, password: studentPass }),
    });
    assert.equal(regRes.status, 201);

    const loginUnverified = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: studentEmail, password: studentPass }),
    });
    assert.equal(loginUnverified.status, 403);

    // 2. Busca token na dev-mailbox e verifica e-mail
    const mailRes = await fetch(
      `${baseUrl}/api/v1/dev/mailbox?email=${encodeURIComponent(studentEmail)}`,
    );
    assert.equal(mailRes.status, 200);
    const mailJson = await mailRes.json();
    assert.ok(mailJson.messages.length >= 1);
    const verifyToken = mailJson.messages[0].token_preview;

    const verifyRes = await fetch(`${baseUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: verifyToken }),
    });
    assert.equal(verifyRes.status, 200);

    // 3. Login com e-mail verificado
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: studentEmail, password: studentPass }),
    });
    assert.equal(loginRes.status, 200);
    const cookieHeader = extractSessionCookie(loginRes);
    assert.ok(cookieHeader.startsWith('cm_academy_session='));

    // 4. IDOR / Segurança: aluno SEM entitlement não acessa aula protegida nem obtém token Stream
    const deniedLesson = await fetch(
      `${baseUrl}/api/v1/app/courses/formacao-ia-anderzilla/lessons/A01`,
      { headers: { cookie: cookieHeader } },
    );
    assert.equal(deniedLesson.status, 403);

    const deniedStream = await fetch(`${baseUrl}/api/v1/app/stream/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookieHeader },
      body: JSON.stringify({
        courseSlug: 'formacao-ia-anderzilla',
        lessonCode: 'A01',
        streamUid: 'cf_uid_arbitrary_attack',
      }),
    });
    assert.equal(deniedStream.status, 403);

    // 5. Ativa oferta gratuita explícita (Bloco 1) -> libera A01..A03, mas A04 (Bloco 2) segue 403
    const enrollFree = await fetch(`${baseUrl}/api/v1/app/enroll-free`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookieHeader },
      body: JSON.stringify({ offerCode: 'formacao-ia-amostra-bloco-1' }),
    });
    assert.equal(enrollFree.status, 200);

    const allowedA01 = await fetch(
      `${baseUrl}/api/v1/app/courses/formacao-ia-anderzilla/lessons/A01`,
      { headers: { cookie: cookieHeader } },
    );
    assert.equal(allowedA01.status, 200);

    // Anotação "Pare e Anote" no store NoSQL (Etapa 2): salva e lê para A01, bloqueia 403 para A04
    const saveNote = await fetch(
      `${baseUrl}/api/v1/app/courses/formacao-ia-anderzilla/lessons/A01/notes`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({ slideIndex: 0, text: 'IA é técnica computacional, não consciência.' }),
      },
    );
    assert.equal(saveNote.status, 200);
    const readNotes = await fetch(
      `${baseUrl}/api/v1/app/courses/formacao-ia-anderzilla/lessons/A01/notes`,
      { headers: { cookie: cookieHeader } },
    );
    assert.equal(readNotes.status, 200);
    const notesJson = await readNotes.json();
    assert.equal(notesJson.notes[0], 'IA é técnica computacional, não consciência.');

    const deniedNoteA04 = await fetch(
      `${baseUrl}/api/v1/app/courses/formacao-ia-anderzilla/lessons/A04/notes`,
      { headers: { cookie: cookieHeader } },
    );
    assert.equal(deniedNoteA04.status, 403);

    const stillDeniedA04 = await fetch(
      `${baseUrl}/api/v1/app/courses/formacao-ia-anderzilla/lessons/A04`,
      { headers: { cookie: cookieHeader } },
    );
    assert.equal(stillDeniedA04.status, 403);

    // 6. Token Cloudflare Stream RS256 emitido para A01 autorizada e verificado com chave pública
    const streamRes = await fetch(`${baseUrl}/api/v1/app/stream/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookieHeader },
      body: JSON.stringify({ courseSlug: 'formacao-ia-anderzilla', lessonCode: 'A01' }),
    });
    assert.equal(streamRes.status, 200);
    const streamJson = await streamRes.json();
    assert.equal(streamJson.requireSignedURLs, true);
    const [hB64, pB64, sigB64] = streamJson.token.split('.');
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${hB64}.${pB64}`);
    verifier.end();
    assert.equal(verifier.verify(publicKey, Buffer.from(sigB64, 'base64url')), true);
    const payloadDecoded = JSON.parse(Buffer.from(pB64, 'base64url').toString('utf8'));
    assert.equal(payloadDecoded.sub, 'cf_uid_aula01_test');

    // 7. Quiz do Bloco 1 no servidor: sem gabarito antes da submissão
    for (const code of ['A01', 'A02', 'A03']) {
      const comp = await fetch(
        `${baseUrl}/api/v1/app/courses/formacao-ia-anderzilla/lessons/${code}/complete`,
        { method: 'POST', headers: { cookie: cookieHeader } },
      );
      assert.equal(comp.status, 200);
    }

    const startQuiz = await fetch(
      `${baseUrl}/api/v1/app/courses/formacao-ia-anderzilla/blocks/B01/quiz/start`,
      { method: 'POST', headers: { cookie: cookieHeader } },
    );
    assert.equal(startQuiz.status, 200);
    const quizRawText = await startQuiz.text();
    assert.ok(!quizRawText.includes('correct_index'));
    assert.ok(!quizRawText.includes('isCorrect'));
    assert.ok(!quizRawText.includes('explanation'));
    const quizData = JSON.parse(quizRawText);
    assert.equal(quizData.questions.length, 10);

    // Consulta o snapshot no banco apenas no teste para submeter 100% corretas
    const inspectDb = new DatabaseSync(dbPath);
    const attemptRow = inspectDb
      .prepare(`SELECT questions_snapshot_json FROM quiz_attempts WHERE id = ?`)
      .get(quizData.attemptId);
    const snap = JSON.parse(attemptRow.questions_snapshot_json);
    const correctAnswers = snap.map((q) => q.options.findIndex((o) => o.isCorrect));
    inspectDb.close();

    const submitQuiz = await fetch(
      `${baseUrl}/api/v1/app/courses/formacao-ia-anderzilla/blocks/B01/quiz/submit`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({ attemptId: quizData.attemptId, answers: correctAnswers }),
      },
    );
    assert.equal(submitQuiz.status, 200);
    const submitJson = await submitQuiz.json();
    assert.equal(submitJson.passed, true);
    assert.equal(submitJson.scorePercent, 100);

    // 8. Compra Hotmart aprovada (fixture) concede Módulo 1 -> libera A04; evento duplicado é idempotente; refund revoga preservando histórico
    const approvedRaw = fs.readFileSync(
      path.resolve(APP_ROOT, 'fixtures', 'hotmart', 'purchase-approved.json'),
      'utf8',
    );
    const whApprove = await fetch(`${baseUrl}/api/webhooks/hotmart`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hotmart-hottok': testHottok },
      body: approvedRaw,
    });
    assert.equal(whApprove.status, 200);
    const whApproveJson = await whApprove.json();
    assert.equal(whApproveJson.entitlementGranted, true);

    const whApproveDup = await fetch(`${baseUrl}/api/webhooks/hotmart`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hotmart-hottok': testHottok },
      body: approvedRaw,
    });
    assert.equal((await whApproveDup.json()).duplicate, true);

    // Agora A04 está liberada (Bloco 1 aprovado + entitlement do Módulo 1)
    const allowedA04 = await fetch(
      `${baseUrl}/api/v1/app/courses/formacao-ia-anderzilla/lessons/A04`,
      { headers: { cookie: cookieHeader } },
    );
    assert.equal(allowedA04.status, 200);

    // Refund revoga entitlement e preserva histórico
    const refundedRaw = fs.readFileSync(
      path.resolve(APP_ROOT, 'fixtures', 'hotmart', 'purchase-refunded.json'),
      'utf8',
    );
    const whRefund = await fetch(`${baseUrl}/api/webhooks/hotmart`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hotmart-hottok': testHottok },
      body: refundedRaw,
    });
    assert.equal(whRefund.status, 200);
    const whRefundJson = await whRefund.json();
    assert.equal(whRefundJson.entitlementStatus, 'revoked');

    const revokedA04 = await fetch(
      `${baseUrl}/api/v1/app/courses/formacao-ia-anderzilla/lessons/A04`,
      { headers: { cookie: cookieHeader } },
    );
    assert.equal(revokedA04.status, 403);

    // Verifica histórico append-only preservado e emissão de certificado quando elegível
    const verifyDb = new DatabaseSync(dbPath);
    const historyRows = verifyDb
      .prepare(`SELECT action FROM entitlement_history ORDER BY created_at ASC`)
      .all();
    assert.ok(historyRows.some((r) => r.action === 'granted'));
    assert.ok(historyRows.some((r) => r.action === 'revoked'));

    // Marca todas as 15 aulas concluídas e os 5 blocos aprovados para testar emissão e verificação pública do certificado
    const userRow = verifyDb.prepare(`SELECT id FROM users WHERE email = ?`).get(studentEmail);
    const allLessons = verifyDb.prepare(`SELECT id FROM lessons WHERE status = 'published'`).all();
    for (const l of allLessons) {
      verifyDb
        .prepare(
          `INSERT OR IGNORE INTO lesson_progress (id, user_id, course_id, lesson_id)
           VALUES (?, ?, 'course_formacao_ia_anderzilla', ?)`,
        )
        .run(`lp_${l.id}`, userRow.id, l.id);
    }
    const allBlocks = verifyDb.prepare(`SELECT id FROM blocks WHERE status = 'published'`).all();
    for (const b of allBlocks) {
      verifyDb
        .prepare(
          `INSERT INTO quiz_attempts (id, user_id, course_id, block_id, status, questions_snapshot_json, score_percent, correct_count, total_count, passed)
           VALUES (?, ?, 'course_formacao_ia_anderzilla', ?, 'submitted', '[]', 100, 10, 10, 1)`,
        )
        .run(`qa_pass_${b.id}`, userRow.id, b.id);
    }
    verifyDb.close();

    const certIssue = await fetch(
      `${baseUrl}/api/v1/app/courses/formacao-ia-anderzilla/certificate`,
      { method: 'POST', headers: { cookie: cookieHeader } },
    );
    assert.equal(certIssue.status, 200);
    const certJson = await certIssue.json();
    assert.ok(certJson.certificate.verificationCode.length === 32);

    // Verificação pública privacy-safe (sem e-mail nem CPF)
    const publicCertPage = await fetch(
      `${baseUrl}/certificados/${certJson.certificate.verificationCode}`,
    );
    assert.equal(publicCertPage.status, 200);
    const publicCertHtml = await publicCertPage.text();
    assert.ok(publicCertHtml.includes('Maria Estudante'));
    assert.ok(!publicCertHtml.includes(studentEmail));

    // 9. Recuperação de senha revoga sessão anterior
    const forgotRes = await fetch(`${baseUrl}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: studentEmail }),
    });
    assert.equal(forgotRes.status, 200);

    const mailRes2 = await fetch(
      `${baseUrl}/api/v1/dev/mailbox?email=${encodeURIComponent(studentEmail)}`,
    );
    const resetMail = (await mailRes2.json()).messages.find((m) => m.purpose === 'reset_password');
    assert.ok(resetMail);

    const resetRes = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: resetMail.token_preview, password: 'NovaSenhaForte#2026' }),
    });
    assert.equal(resetRes.status, 200);

    const oldSessionCheck = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { cookie: cookieHeader },
    });
    assert.equal(oldSessionCheck.status, 401);
  } finally {
    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 400));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
