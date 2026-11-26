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

test('Etapa 7 Operação Escolar: turmas, sessões/conflito, conclusão, tickets com nota interna, inbox opt-in e calendário compartilhado/financeiro', async () => {
  const { dir, dbPath, reportPath } = createTempEnv('e2e-stage7-ops');
  runSeed({ dbPath, reportPath });
  // Cenário 10: reexecução de seed/migration preserva integridade
  const seed2 = runSeed({ dbPath, reportPath });
  assert.equal(seed2.integrity.orphanModules, 0);

  const port = 3300 + crypto.randomInt(10, 500);
  const baseUrl = `http://127.0.0.1:${port}`;
  const adminMfa = '554433';

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
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(`${baseUrl}/api/health`);

    const adminCookie = await registerAndLogin(baseUrl, 'Admin Escolar', 'admin.ops@codematrix.test', 'AdminOps#2026');
    const alunoACookie = await registerAndLogin(baseUrl, 'Aluno Turma 1', 'aluno.t1@codematrix.test', 'AlunoT1#2026');
    const alunoBCookie = await registerAndLogin(baseUrl, 'Aluno Turma 2', 'aluno.t2@codematrix.test', 'AlunoT2#2026');
    const profACookie = await registerAndLogin(baseUrl, 'Prof Curso A', 'prof.a@codematrix.test', 'ProfA#2026');

    const db = new DatabaseSync(dbPath);
    const adminRow = db.prepare(`SELECT id FROM users WHERE email = 'admin.ops@codematrix.test'`).get();
    const alunoARow = db.prepare(`SELECT id FROM users WHERE email = 'aluno.t1@codematrix.test'`).get();
    const alunoBRow = db.prepare(`SELECT id FROM users WHERE email = 'aluno.t2@codematrix.test'`).get();
    const profARow = db.prepare(`SELECT id FROM users WHERE email = 'prof.a@codematrix.test'`).get();

    db.prepare(`INSERT INTO user_roles (id, user_id, role) VALUES ('ur_adm_ops', ?, 'admin')`).run(adminRow.id);
    db.prepare(
      `INSERT INTO partner_profiles (id, user_id, display_name, contact_email, status, terms_version, terms_accepted_at)
       VALUES ('prt_prof_a', ?, 'Prof Curso A', 'prof.a@codematrix.test', 'approved', '2026-11-v1-rascunho', datetime('now'))`,
    ).run(profARow.id);
    db.close();

    // Valida MFA do Admin
    assert.equal(
      (
        await fetch(`${baseUrl}/api/v1/admin/mfa/verify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie: adminCookie },
          body: JSON.stringify({ code: adminMfa }),
        })
      ).status,
      200,
    );

    // Cria Curso A e Curso B
    const cA = await (
      await fetch(`${baseUrl}/api/v1/admin/courses`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: adminCookie },
        body: JSON.stringify({ title: 'Curso A Escolar', slug: 'curso-a-escolar', status: 'published' }),
      })
    ).json();
    const cB = await (
      await fetch(`${baseUrl}/api/v1/admin/courses`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: adminCookie },
        body: JSON.stringify({ title: 'Curso B Escolar', slug: 'curso-b-escolar', status: 'published' }),
      })
    ).json();

    // Atribui Prof A exclusivamente ao Curso A (como instructor)
    await fetch(`${baseUrl}/api/v1/admin/courses/${cA.courseId}/partners`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ partnerId: 'prt_prof_a', role: 'instructor' }),
    });

    // Cria 2 turmas no Curso A em blocos diferentes (T1 em B01, T2 em B03) + 1 turma no Curso B
    const t1 = await (
      await fetch(`${baseUrl}/api/v1/admin/cohorts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: adminCookie },
        body: JSON.stringify({ courseId: cA.courseId, code: 'T1-B01', name: 'Turma 1 (Bloco 1)', currentBlockCode: 'B01' }),
      })
    ).json();
    const t2 = await (
      await fetch(`${baseUrl}/api/v1/admin/cohorts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: adminCookie },
        body: JSON.stringify({ courseId: cA.courseId, code: 'T2-B03', name: 'Turma 2 (Bloco 3)', currentBlockCode: 'B03' }),
      })
    ).json();
    const tB = await (
      await fetch(`${baseUrl}/api/v1/admin/cohorts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: adminCookie },
        body: JSON.stringify({ courseId: cB.courseId, code: 'TB-01', name: 'Turma Curso B' }),
      })
    ).json();

    // Matricula Aluno A em T1 e Aluno B em T2
    await fetch(`${baseUrl}/api/v1/admin/cohorts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ action: 'enroll', cohortId: t1.cohortId, userId: alunoARow.id }),
    });
    await fetch(`${baseUrl}/api/v1/admin/cohorts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ action: 'enroll', cohortId: t2.cohortId, userId: alunoBRow.id }),
    });

    // Cenário 2 e 3: Prof A pode dar sessão em T1 (Curso A), mas é BLOQUEADO (403) em tB (Curso B)!
    const sesT1Res = await fetch(`${baseUrl}/api/v1/admin/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({
        cohortId: t1.cohortId,
        instructorPartnerId: 'prt_prof_a',
        title: 'Live T1 — Bloco 1',
        startsAt: '2026-12-10T20:00:00-03:00',
        endsAt: '2026-12-10T21:00:00-03:00',
      }),
    });
    assert.equal(sesT1Res.status, 201);
    const sesT1 = await sesT1Res.json();

    // Conflito de horário para Prof A no mesmo intervalo retorna 409!
    const conflictRes = await fetch(`${baseUrl}/api/v1/admin/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({
        cohortId: t2.cohortId,
        instructorPartnerId: 'prt_prof_a',
        title: 'Live T2 Conflitante',
        startsAt: '2026-12-10T20:30:00-03:00',
        endsAt: '2026-12-10T21:30:00-03:00',
      }),
    });
    assert.equal(conflictRes.status, 409);

    // Prof A tentando ser atribuído ao Curso B -> 403!
    const profBDenied = await fetch(`${baseUrl}/api/v1/admin/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({
        cohortId: tB.cohortId,
        instructorPartnerId: 'prt_prof_a',
        title: 'Live Curso B Proibida',
        startsAt: '2026-12-12T20:00:00-03:00',
        endsAt: '2026-12-12T21:00:00-03:00',
      }),
    });
    assert.equal(profBDenied.status, 403);

    // Agenda sessão própria para T2 e para Curso B (sem Prof A)
    await fetch(`${baseUrl}/api/v1/admin/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({
        cohortId: t2.cohortId,
        title: 'Live T2 — Bloco 3',
        startsAt: '2026-12-11T20:00:00-03:00',
        endsAt: '2026-12-11T21:00:00-03:00',
      }),
    });
    await fetch(`${baseUrl}/api/v1/admin/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({
        cohortId: tB.cohortId,
        title: 'Live Exclusiva Curso B',
        startsAt: '2026-12-12T20:00:00-03:00',
        endsAt: '2026-12-12T21:00:00-03:00',
      }),
    });

    // Cenário 1 e 2: Aluno A vê apenas Live T1; Aluno B vê apenas Live T2; Prof A vê apenas Curso A (nunca Curso B)!
    const calA = await (await fetch(`${baseUrl}/api/v1/app/calendar`, { headers: { cookie: alunoACookie } })).json();
    const calB = await (await fetch(`${baseUrl}/api/v1/app/calendar`, { headers: { cookie: alunoBCookie } })).json();
    const calProfA = await (await fetch(`${baseUrl}/api/v1/partners/calendar`, { headers: { cookie: profACookie } })).json();

    assert.ok(calA.events.some((e) => e.title === 'Live T1 — Bloco 1'));
    assert.ok(!calA.events.some((e) => e.title === 'Live T2 — Bloco 3'));
    assert.ok(calB.events.some((e) => e.title === 'Live T2 — Bloco 3'));
    assert.ok(!calB.events.some((e) => e.title === 'Live T1 — Bloco 1'));
    assert.ok(!calProfA.events.some((e) => e.title === 'Live Exclusiva Curso B'));

    // Reagendar T1 notifica apenas Aluno A (notifiedUsersCount = 1), sem afetar T2!
    const resched = await (
      await fetch(`${baseUrl}/api/v1/admin/sessions`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie: adminCookie },
        body: JSON.stringify({
          sessionId: sesT1.sessionId,
          action: 'reschedule',
          reason: 'Ajuste de pauta pedagógica do Bloco 1',
          newStartsAt: '2026-12-10T21:00:00-03:00',
          newEndsAt: '2026-12-10T22:00:00-03:00',
        }),
      })
    ).json();
    assert.equal(resched.notifiedUsersCount, 1);

    // Cenário 4: Conclusão de módulo server-side (2 módulos obrigatórios: só elegível após concluir ambos!)
    const db2 = new DatabaseSync(dbPath);
    db2.prepare(
      `INSERT INTO modules (id, course_id, version_id, position, code, title, status)
       VALUES ('mod_ops_1', ?, ?, 1, 'M01', 'Módulo 1', 'published'),
              ('mod_ops_2', ?, ?, 2, 'M02', 'Módulo 2', 'published')`,
    ).run(cA.courseId, cA.versionId, cA.courseId, cA.versionId);
    db2.close();

    const comp1 = await (
      await fetch(`${baseUrl}/api/v1/admin/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: adminCookie },
        body: JSON.stringify({ userId: alunoARow.id, courseId: cA.courseId, moduleId: 'mod_ops_1', cohortId: t1.cohortId }),
      })
    ).json();
    assert.equal(comp1.eligibleForCourseCertificate, false);

    const comp2 = await (
      await fetch(`${baseUrl}/api/v1/admin/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: adminCookie },
        body: JSON.stringify({ userId: alunoARow.id, courseId: cA.courseId, moduleId: 'mod_ops_2', cohortId: t1.cohortId }),
      })
    ).json();
    assert.equal(comp2.eligibleForCourseCertificate, true);

    // Cenário 5: Ticket de suporte — aluno abre, admin adiciona nota interna + resposta pública; aluno NÃO vê nota interna e aluno B não acessa ticket de A!
    const tktRes = await fetch(`${baseUrl}/api/v1/app/tickets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: alunoACookie },
      body: JSON.stringify({
        category: 'academic',
        courseId: cA.courseId,
        subject: 'Dúvida sobre exercício do Bloco 1',
        description: 'Gostaria de confirmar o formato do arquivo de entrega da aula 2.',
      }),
    });
    assert.equal(tktRes.status, 201);
    const tkt = await tktRes.json();

    await fetch(`${baseUrl}/api/v1/admin/tickets`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({
        ticketId: tkt.ticketId,
        body: 'NOTA INTERNA SECRETA: verificar histórico financeiro antes de responder.',
        isInternalNote: true,
        status: 'in_progress',
      }),
    });
    await fetch(`${baseUrl}/api/v1/admin/tickets`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({
        ticketId: tkt.ticketId,
        body: 'Olá! Você pode enviar o arquivo em formato PDF ou Markdown.',
        isInternalNote: false,
        status: 'waiting_student',
      }),
    });

    const threadA = await (
      await fetch(`${baseUrl}/api/v1/app/tickets?ticketId=${tkt.ticketId}`, { headers: { cookie: alunoACookie } })
    ).json();
    assert.ok(threadA.messages.some((m) => m.body.includes('PDF ou Markdown')));
    assert.ok(!threadA.messages.some((m) => m.body.includes('NOTA INTERNA SECRETA')));

    // Aluno B não acessa ticket de Aluno A (404)
    const threadB = await fetch(`${baseUrl}/api/v1/app/tickets?ticketId=${tkt.ticketId}`, {
      headers: { cookie: alunoBCookie },
    });
    assert.equal(threadB.status, 404);

    // Cenário 6: Aviso promocional respeita marketing_opt_in (Aluno A ativa opt-in; Aluno B mantém opt-out)
    await fetch(`${baseUrl}/api/v1/app/inbox`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: alunoACookie },
      body: JSON.stringify({ marketingOptIn: true }),
    });
    const promoRes = await (
      await fetch(`${baseUrl}/api/v1/admin/announcements`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: adminCookie },
        body: JSON.stringify({
          category: 'marketing_offer',
          title: 'Oferta especial Módulo 2',
          body: 'Condição exclusiva para alunos que optaram por receber ofertas.',
          audienceType: 'all_students',
        }),
      })
    ).json();
    assert.equal(promoRes.recipientsCount, 1);

    const inboxA = await (await fetch(`${baseUrl}/api/v1/app/inbox`, { headers: { cookie: alunoACookie } })).json();
    const inboxB = await (await fetch(`${baseUrl}/api/v1/app/inbox`, { headers: { cookie: alunoBCookie } })).json();
    assert.ok(inboxA.messages.some((m) => m.title === 'Oferta especial Módulo 2'));
    assert.ok(!inboxB.messages.some((m) => m.title === 'Oferta especial Módulo 2'));

    // Marcar aviso como lido persiste
    const firstDelId = inboxA.messages[0].delivery_id;
    await fetch(`${baseUrl}/api/v1/app/inbox`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: alunoACookie },
      body: JSON.stringify({ deliveryId: firstDelId, status: 'read' }),
    });
    const inboxAAfter = await (await fetch(`${baseUrl}/api/v1/app/inbox`, { headers: { cookie: alunoACookie } })).json();
    assert.equal(inboxAAfter.messages.find((m) => m.delivery_id === firstDelId).delivery_status, 'read');

    // Cenário 7 e 8: Recorrência semanal + bloqueio de alteração direta de evento financeiro (403)
    const recRes = await (
      await fetch(`${baseUrl}/api/v1/admin/calendar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: adminCookie },
        body: JSON.stringify({
          eventType: 'operational_reminder',
          title: 'Plantão semanal',
          startsAt: '2026-12-15T18:00:00-03:00',
          endsAt: '2026-12-15T19:00:00-03:00',
          audienceScope: 'admin_only',
          recurrenceWeeklyCount: 3,
        }),
      })
    ).json();
    assert.equal(recRes.eventIds.length, 3);

    const finEv = await (
      await fetch(`${baseUrl}/api/v1/admin/calendar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: adminCookie },
        body: JSON.stringify({
          eventType: 'financial_payout',
          title: 'Fechamento mensal de repasses',
          startsAt: '2026-12-28T10:00:00-03:00',
          endsAt: '2026-12-28T11:00:00-03:00',
          audienceScope: 'admin_only',
        }),
      })
    ).json();
    const blockFinEdit = await fetch(`${baseUrl}/api/v1/admin/calendar`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({
        eventId: finEv.eventIds[0],
        action: 'reschedule',
        reason: 'Tentativa direta pelo calendário',
        startsAt: '2026-12-29T10:00:00-03:00',
        endsAt: '2026-12-29T11:00:00-03:00',
      }),
    });
    assert.equal(blockFinEdit.status, 403);

    // Agenda financeira derivada do ledger acessível ao admin e bloqueada ao aluno (403)
    const finViewAdm = await fetch(`${baseUrl}/api/v1/admin/calendar?view=financial`, {
      headers: { cookie: adminCookie },
    });
    assert.equal(finViewAdm.status, 200);
    assert.equal((await finViewAdm.json()).financialCalendar.derivedFromSourceOfTruth, true);

    const finViewStu = await fetch(`${baseUrl}/api/v1/admin/calendar?view=financial`, {
      headers: { cookie: alunoACookie },
    });
    assert.equal(finViewStu.status, 403);
  } finally {
    child.kill('SIGTERM');
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignora lock temporário no Windows
    }
  }
});
