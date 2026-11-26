import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';

const DEFAULT_SOURCE_DIR = process.env.ACADEMY_COURSE_SOURCE_DIR || 'G:\\Estudos de IA';

function resolveDbPath() {
  const configured = process.env.ACADEMY_DB_PATH?.trim();
  if (configured === ':memory:') return ':memory:';
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
  }
  return path.resolve(process.cwd(), 'data', 'academy.sqlite');
}

function loadFormacaoSource(sourceDir) {
  const formacaoPath = path.join(sourceDir, 'assets', 'formacao.js');
  const leiaMePath = path.join(sourceDir, 'LEIA-ME.md');
  const cursoJsonPath = path.join(sourceDir, 'curso.json');

  if (!fs.existsSync(formacaoPath)) {
    throw new Error(
      `Fonte do curso não encontrada em ${formacaoPath}. Defina ACADEMY_COURSE_SOURCE_DIR apontando para o diretório com assets/formacao.js.`,
    );
  }

  const rawJs = fs.readFileSync(formacaoPath, 'utf8');
  const markerIndex = rawJs.indexOf('const F=window.FORMACAO');
  const dataOnlyJs = markerIndex > 0 ? rawJs.slice(0, markerIndex) : rawJs;

  const sandbox = { window: {} };
  vm.runInNewContext(dataOnlyJs, sandbox, { timeout: 1000 });

  const formacao = sandbox.window.FORMACAO;
  if (!formacao || !Array.isArray(formacao.modules) || !Array.isArray(formacao.lessons)) {
    throw new Error('Estrutura window.FORMACAO inválida em assets/formacao.js.');
  }

  let legacyModulesCount = 0;
  if (fs.existsSync(cursoJsonPath)) {
    try {
      const legacy = JSON.parse(fs.readFileSync(cursoJsonPath, 'utf8'));
      legacyModulesCount = Array.isArray(legacy.modules) ? legacy.modules.length : 0;
    } catch {
      legacyModulesCount = 0;
    }
  }

  return {
    formacao,
    hasLeiaMe: fs.existsSync(leiaMePath),
    hasCursoJson: fs.existsSync(cursoJsonPath),
    legacyModulesCount,
    sourceDir,
  };
}

export function runSeed({
  dbPath = resolveDbPath(),
  sourceDir = DEFAULT_SOURCE_DIR,
  reportPath = path.resolve(process.cwd(), 'data', 'import-report.json'),
} = {}) {
  const schemaPath = path.resolve(process.cwd(), 'src', 'lib', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(schemaSql);

  const source = loadFormacaoSource(sourceDir);
  const { formacao } = source;

  const report = {
    executedAt: new Date().toISOString(),
    sourceDir,
    dbPath,
    migrated: {
      tenants: 0,
      coursesPublished: 0,
      coursesDraft: 0,
      modulesPublished: 0,
      modulesPlanned: 0,
      blocksPublished: 0,
      lessonsPublished: 0,
      slidesImported: 0,
      quizQuestionsImported: 0,
      assetsRecorded: 0,
      offersPublished: 0,
      offersDraft: 0,
      cmsPages: 0,
    },
    missingOrPending: [
      {
        area: 'Módulo 2 — Construir uma solução de IA útil',
        status: 'planned',
        detail: '15 aulas (aulas 16–30) e 5 blocos (blocos 6–10) ainda em planejamento conforme PROMPTS-MODULOS-2-E-3.md; não inventados.',
      },
      {
        area: 'Módulo 3 — Avaliar, proteger e evoluir a solução',
        status: 'planned',
        detail: '15 aulas (aulas 31–45) e 5 blocos (blocos 11–15) ainda em planejamento conforme PROMPTS-MODULOS-2-E-3.md; não inventados.',
      },
      {
        area: 'Cloudflare Stream (vídeos e lives)',
        status: 'pending_upload',
        detail: 'Nenhum video_uid/live_input_uid cadastrado ainda; placeholders registrados como pending_upload.',
      },
      {
        area: 'Preços comerciais e SKUs Hotmart',
        status: 'draft',
        detail: 'Ofertas pagas do Módulo 1 e Pacote Completo mantidas como draft (price_cents = NULL) até definição comercial e configuração Hotmart.',
      },
    ],
    legacyReference: {
      cursoJsonFound: source.hasCursoJson,
      leiaMeFound: source.hasLeiaMe,
      legacyModulesPreservedOutsideMainTrack: source.legacyModulesCount,
    },
  };

  db.exec('BEGIN');
  try {
    // 1. Tenant padrão
    db.prepare(
      `INSERT INTO tenants (id, slug, name, domain)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, domain = excluded.domain`,
    ).run('tenant_codematrix', 'codematrix', 'CodeMatrix', 'academy.codematrix.com.br');
    report.migrated.tenants = 1;

    // 2. Curso principal publicado: Formação IA / AnderZilla
    const courseId = 'course_formacao_ia_anderzilla';
    db.prepare(
      `INSERT INTO courses (
         id, tenant_id, slug, title, subtitle, summary, category, language, status,
         planned_modules_count, planned_lessons_count, planned_blocks_count, min_pass_percent, metadata_json, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         subtitle = excluded.subtitle,
         summary = excluded.summary,
         category = excluded.category,
         status = excluded.status,
         planned_modules_count = excluded.planned_modules_count,
         planned_lessons_count = excluded.planned_lessons_count,
         planned_blocks_count = excluded.planned_blocks_count,
         min_pass_percent = excluded.min_pass_percent,
         metadata_json = excluded.metadata_json,
         updated_at = datetime('now')`,
    ).run(
      courseId,
      'tenant_codematrix',
      'formacao-ia-anderzilla',
      `Formação IA — ${formacao.title}`,
      formacao.subtitle,
      'Formação prática em Inteligência Artificial em português do Brasil, planejada em 3 módulos (45 aulas e 15 blocos avaliados). O Módulo 1 está disponível com 15 aulas, 5 blocos, projeto didático Intelicar e avaliações com nota mínima de 70%.',
      'Inteligência Artificial Aplicada',
      'pt-BR',
      'published',
      3,
      45,
      15,
      70,
      JSON.stringify({
        brandLine: 'Formação IA / AnderZilla',
        capstoneProject: 'Intelicar (projeto didático fictício)',
        sourceVerified: 'LEIA-ME.md + assets/formacao.js',
      }),
    );
    report.migrated.coursesPublished = 1;

    // 2b. Curso em rascunho para demonstrar multi-curso sem expor rascunho na vitrine pública
    db.prepare(
      `INSERT INTO courses (
         id, tenant_id, slug, title, subtitle, summary, category, language, status,
         planned_modules_count, planned_lessons_count, planned_blocks_count, min_pass_percent, metadata_json, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         status = excluded.status,
         updated_at = datetime('now')`,
    ).run(
      'course_draft_pme_ops',
      'tenant_codematrix',
      'ia-operacoes-pme-rascunho',
      'IA para Operações em PMEs (Rascunho Interno)',
      'Estrutura reservada — não publicado na vitrine',
      'Registro interno em rascunho para validar catálogo multi-curso sem exposição pública.',
      'Gestão e Operações',
      'pt-BR',
      'draft',
      0,
      0,
      0,
      70,
      JSON.stringify({ internalDraft: true }),
    );
    report.migrated.coursesDraft = 1;

    // 3. Versão do curso principal
    const versionId = 'ver_formacao_ia_v1';
    db.prepare(
      `INSERT INTO course_versions (id, course_id, version_tag, status, source_ref, notes)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, source_ref = excluded.source_ref, notes = excluded.notes`,
    ).run(
      versionId,
      courseId,
      'v1.0-m1',
      'published',
      'G:\\Estudos de IA\\assets\\formacao.js',
      'Módulo 1 autoral importado fielmente; Módulos 2 e 3 registrados como planejados.',
    );

    // 4. Módulos (1 publicado, 2 e 3 planejados)
    const upsertModule = db.prepare(
      `INSERT INTO modules (id, course_id, version_id, position, code, title, promise, status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         position = excluded.position,
         title = excluded.title,
         promise = excluded.promise,
         status = excluded.status,
         updated_at = datetime('now')`,
    );

    for (const mod of formacao.modules) {
      const modPos = Number(mod.id);
      const isAvailable = modPos === 1;
      const modId = `mod_formacao_ia_${modPos}`;
      const cleanPromise = String(mod.promise || '').replace(/^Prompt pronto:\s*/i, '');
      upsertModule.run(
        modId,
        courseId,
        versionId,
        modPos,
        `M${modPos}`,
        mod.title,
        cleanPromise,
        isAvailable ? 'published' : 'planned',
      );
      if (isAvailable) report.migrated.modulesPublished += 1;
      else report.migrated.modulesPlanned += 1;
    }

    // 5. Blocos do Módulo 1 (preservando ordem original)
    const upsertBlock = db.prepare(
      `INSERT INTO blocks (id, course_id, module_id, position, code, title, focus, remediate, min_pass_percent, is_free_sample, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         position = excluded.position,
         title = excluded.title,
         focus = excluded.focus,
         remediate = excluded.remediate,
         min_pass_percent = excluded.min_pass_percent,
         is_free_sample = excluded.is_free_sample,
         status = excluded.status`,
    );

    for (const blk of formacao.blocks) {
      const blkPos = Number(blk.id);
      const blkId = `blk_formacao_ia_${blkPos}`;
      upsertBlock.run(
        blkId,
        courseId,
        'mod_formacao_ia_1',
        blkPos,
        `B${String(blkPos).padStart(2, '0')}`,
        blk.title,
        blk.focus,
        blk.remediate,
        70,
        blkPos === 1 ? 1 : 0,
        'published',
      );
      report.migrated.blocksPublished += 1;
    }

    // 6. Aulas e Assets do Módulo 1 (15 aulas em ordem exata)
    const upsertLesson = db.prepare(
      `INSERT INTO lessons (id, course_id, module_id, block_id, position, code, title, goal, slides_count, content_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         block_id = excluded.block_id,
         position = excluded.position,
         title = excluded.title,
         goal = excluded.goal,
         slides_count = excluded.slides_count,
         content_json = excluded.content_json,
         status = excluded.status`,
    );

    const upsertAsset = db.prepare(
      `INSERT INTO assets (id, course_id, module_id, lesson_id, code, kind, title, storage_ref, stream_uid, status, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         storage_ref = excluded.storage_ref,
         status = excluded.status,
         metadata_json = excluded.metadata_json`,
    );

    for (const lesson of formacao.lessons) {
      const pos = Number(lesson.id);
      const blockNumber = Math.ceil(pos / 3);
      const lessonId = `les_formacao_ia_${String(pos).padStart(2, '0')}`;
      const blockId = `blk_formacao_ia_${blockNumber}`;
      const slides = Array.isArray(lesson.slides) ? lesson.slides : [];

      upsertLesson.run(
        lessonId,
        courseId,
        'mod_formacao_ia_1',
        blockId,
        pos,
        `A${String(pos).padStart(2, '0')}`,
        lesson.title,
        lesson.goal,
        slides.length,
        JSON.stringify(slides),
        'published',
      );
      report.migrated.lessonsPublished += 1;
      report.migrated.slidesImported += slides.length;

      upsertAsset.run(
        `ast_slides_${String(pos).padStart(2, '0')}`,
        courseId,
        'mod_formacao_ia_1',
        lessonId,
        `SLIDES-A${String(pos).padStart(2, '0')}`,
        'slides',
        `Apresentação em telas — Aula ${String(pos).padStart(2, '0')}`,
        `assets/formacao.js#lesson-${pos}`,
        null,
        'ready',
        JSON.stringify({ slidesCount: slides.length }),
      );
      report.migrated.assetsRecorded += 1;

      upsertAsset.run(
        `ast_video_${String(pos).padStart(2, '0')}`,
        courseId,
        'mod_formacao_ia_1',
        lessonId,
        `VIDEO-A${String(pos).padStart(2, '0')}`,
        'stream_video',
        `Vídeo gravado (Cloudflare Stream) — Aula ${String(pos).padStart(2, '0')}`,
        '',
        null,
        'pending_upload',
        JSON.stringify({ requireSignedURLs: true }),
      );
      report.migrated.assetsRecorded += 1;
    }

    // Asset do projeto didático Intelicar
    upsertAsset.run(
      'ast_intelicar_guide',
      courseId,
      'mod_formacao_ia_1',
      null,
      'INTELICAR-GUIDE',
      'project_guide',
      'Documentação e protótipo didático Intelicar (dados sintéticos)',
      'meu_estudo/projetos/intelicar/README-DO-PROJETO.md',
      null,
      'ready',
      JSON.stringify({ syntheticOnly: true }),
    );
    report.migrated.assetsRecorded += 1;

    // 7. Bancos de questões dos 5 blocos (armazenados somente no servidor)
    const upsertQuiz = db.prepare(
      `INSERT INTO quiz_questions (id, course_id, block_id, question_code, lesson_position, question, options_json, correct_index, skill, explanation, version_tag)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         lesson_position = excluded.lesson_position,
         question = excluded.question,
         options_json = excluded.options_json,
         correct_index = excluded.correct_index,
         skill = excluded.skill,
         explanation = excluded.explanation`,
    );

    if (Array.isArray(formacao.quizBanks)) {
      formacao.quizBanks.forEach((bank, bankIdx) => {
        const blockNumber = bankIdx + 1;
        const blockId = `blk_formacao_ia_${blockNumber}`;
        bank.forEach((item, qIdx) => {
          const qCode = `B${String(blockNumber).padStart(2, '0')}-Q${String(qIdx + 1).padStart(2, '0')}`;
          upsertQuiz.run(
            `quiz_${qCode.toLowerCase()}`,
            courseId,
            blockId,
            qCode,
            Number(item.lesson),
            item.q,
            JSON.stringify(item.o),
            Number(item.a),
            item.skill || '',
            item.why || '',
            'v1.0-m1',
          );
          report.migrated.quizQuestionsImported += 1;
        });
      });
    }

    // 8. Ofertas / SKUs (Amostra Gratuita publicada; ofertas pagas em rascunho sem preço inventado)
    const upsertOffer = db.prepare(
      `INSERT INTO offers (
         id, course_id, sku, offer_code, title, description, access_scope, is_free,
         price_cents, currency, status, hotmart_product_id, hotmart_offer_code, metadata_json, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         description = excluded.description,
         access_scope = excluded.access_scope,
         is_free = excluded.is_free,
         price_cents = excluded.price_cents,
         status = excluded.status,
         metadata_json = excluded.metadata_json,
         updated_at = datetime('now')`,
    );

    upsertOffer.run(
      'offer_formacao_ia_bloco1_free',
      courseId,
      'CM-IA-M1-B1-FREE',
      'formacao-ia-amostra-bloco-1',
      'Amostra gratuita — Bloco 1 (Aulas 1 a 3)',
      'Experimente as 3 primeiras aulas do Módulo 1 em telas de apresentação, com exemplos práticos e avaliação de fixação de 10 questões — sem cartão de crédito.',
      'course:formacao-ia-anderzilla:block:B01',
      1,
      0,
      'BRL',
      'published',
      null,
      null,
      JSON.stringify({ entitlementRule: 'explicit_free_offer' }),
    );
    report.migrated.offersPublished = 1;

    upsertOffer.run(
      'offer_formacao_ia_mod1_draft',
      courseId,
      'CM-IA-M1-PAID',
      'formacao-ia-modulo-1-rascunho',
      'Módulo 1 completo — Entender IA e reconhecer seus limites (Rascunho)',
      'Oferta comercial em preparação. Preço, prazo de acesso e IDs Hotmart aguardam aprovação comercial antes da publicação.',
      'course:formacao-ia-anderzilla:module:M1',
      0,
      null,
      'BRL',
      'draft',
      null,
      null,
      JSON.stringify({ pendingCommercialApproval: true }),
    );

    upsertOffer.run(
      'offer_formacao_ia_full_draft',
      courseId,
      'CM-IA-FULL-PAID',
      'formacao-ia-completa-rascunho',
      'Formação IA completa — Módulos 1, 2 e 3 (Rascunho)',
      'Oferta comercial em preparação. Módulos 2 e 3 estão planejados; publicação condicionada à aprovação comercial e cronograma definido.',
      'course:formacao-ia-anderzilla:full',
      0,
      null,
      'BRL',
      'draft',
      null,
      null,
      JSON.stringify({ pendingCommercialApproval: true }),
    );
    report.migrated.offersDraft = 2;

    // 9. Páginas institucionais editáveis (CMS local em SQLite)
    const upsertCms = db.prepare(
      `INSERT INTO cms_pages (slug, title, subtitle, status, review_notice, sections_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(slug) DO UPDATE SET
         title = excluded.title,
         subtitle = excluded.subtitle,
         status = excluded.status,
         review_notice = excluded.review_notice,
         sections_json = excluded.sections_json,
         updated_at = datetime('now')`,
    );

    const cmsPages = [
      {
        slug: 'suporte',
        title: 'Suporte ao Aluno e Operação',
        subtitle: 'Canais oficiais de atendimento e orientações para dúvidas sobre cursos, acesso e pagamentos.',
        reviewNotice: 'Conteúdo operacional em revisão final antes da abertura comercial.',
        sections: [
          {
            heading: 'Atendimento oficial',
            paragraphs: [
              'Para dúvidas sobre matrícula, acesso à plataforma, conteúdo das aulas ou solicitações relacionadas aos seus dados pessoais, utilize o canal oficial de suporte da CodeMatrix.',
              'Nunca compartilhe senhas, códigos de verificação ou dados completos de cartão de pagamento por e-mail ou mensagens.',
            ],
          },
          {
            heading: 'Escopo do atendimento',
            paragraphs: [
              'Pagamentos e estornos processados via checkout externo (Hotmart) seguem o identificador de transação registrado na plataforma e passam por conciliação auditada.',
            ],
          },
        ],
      },
      {
        slug: 'privacidade',
        title: 'Política de Privacidade',
        subtitle: 'Como protegemos seus dados pessoais e aplicamos o princípio de minimização na CodeMatrix Academy.',
        reviewNotice: 'Versão de trabalho sujeita a revisão jurídica formal antes da abertura comercial em produção.',
        sections: [
          {
            heading: 'Minimização de dados',
            paragraphs: [
              'A CodeMatrix Academy adota o princípio de minimização de dados: coletamos apenas as informações estritamente necessárias para autenticação, entrega do conteúdo educacional, emissão de certificados quando aplicável e conciliação de pagamentos.',
              'CPF e data de nascimento nunca são utilizados como senha ou segredo de acesso. Parceiros e afiliados não têm acesso a dados pessoais de alunos.',
            ],
          },
          {
            heading: 'Direitos do titular (LGPD)',
            paragraphs: [
              'Solicitações de acesso, correção, portabilidade ou eliminação de dados pessoais serão atendidas mediante verificação de identidade pelo canal oficial de suporte, observadas as obrigações legais e fiscais de guarda.',
            ],
          },
        ],
      },
      {
        slug: 'termos',
        title: 'Termos de Uso da Academy',
        subtitle: 'Regras de acesso, uso do material didático e transparência sobre os cursos da CodeMatrix Academy.',
        reviewNotice: 'Versão de trabalho sujeita a revisão jurídica formal (prazo de acesso e política de reembolso) antes da abertura comercial.',
        sections: [
          {
            heading: 'Uso pessoal e intransferível',
            paragraphs: [
              'O acesso à CodeMatrix Academy é individual. Materiais autorais, slides, avaliações e vídeos protegidos destinam-se exclusivamente ao estudo do aluno autorizado.',
            ],
          },
          {
            heading: 'Transparência de escopo pedagógico',
            paragraphs: [
              'Cada página de curso informa claramente quais módulos e aulas já estão disponíveis e quais estão em planejamento. Certificados de curso livre dependem do cumprimento dos critérios objetivos registrados no servidor.',
            ],
          },
        ],
      },
    ];

    for (const page of cmsPages) {
      upsertCms.run(
        page.slug,
        page.title,
        page.subtitle,
        'published',
        page.reviewNotice,
        JSON.stringify(page.sections),
      );
      report.migrated.cmsPages += 1;
    }

    // 10. Agenda inicial de live (planejada, sem stream key no banco)
    db.prepare(
      `INSERT INTO live_events (
         id, course_id, module_id, code, title, description, scheduled_at,
         duration_minutes, status, access_scope, retention_days
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         description = excluded.description,
         scheduled_at = excluded.scheduled_at,
         status = excluded.status`,
    ).run(
      'live_formacao_ia_m1_kickoff',
      courseId,
      'mod_formacao_ia_1',
      'LIVE-M1-BOAS-VINDAS',
      'Encontro ao vivo — Boas-vindas e dúvidas do Módulo 1',
      'Sessão de orientação sobre o percurso do Módulo 1, uso das fichas didáticas Intelicar e boas práticas de estudo. O replay ficará disponível conforme a política de retenção.',
      '2026-12-10T20:00:00-03:00',
      60,
      'scheduled',
      'course:formacao-ia-anderzilla:block:B01',
      90,
    );

    // 11. Regra versionada inicial de comissão (v1) para Módulo 1 pago (15% sobre líquido após taxa)
    db.prepare(
      `INSERT INTO commission_rules (
         id, rule_key, version, course_id, offer_sku, partner_role, campaign,
         calc_base, rate_bps, fixed_cents, warranty_days, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(rule_key, version) DO UPDATE SET status = excluded.status`,
    ).run(
      'crule_ia_m1_affiliate_v1',
      'ia-m1-affiliate-default',
      1,
      courseId,
      'CM-IA-M1-PAID',
      'affiliate',
      'geral',
      'net_after_gateway',
      1500,
      0,
      7,
      'active',
    );

    // 11b. Vincula versão ativa e popula offer_grants explícitos para todas as ofertas da Formação IA
    db.prepare(`UPDATE courses SET active_version_id = 'ver_formacao_ia_v1' WHERE id = ?`).run(courseId);
    const courseOffers = db
      .prepare(`SELECT id, course_id, access_scope FROM offers WHERE course_id = ?`)
      .all(courseId);
    const upsertGrant = db.prepare(
      `INSERT INTO offer_grants (id, offer_id, course_id, course_version_id, grant_type, target_code, access_scope)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(offer_id, course_id, access_scope) DO UPDATE SET
         course_version_id = excluded.course_version_id,
         grant_type = excluded.grant_type,
         target_code = excluded.target_code`,
    );
    for (const ofr of courseOffers) {
      const scope = String(ofr.access_scope);
      const grantType = scope.includes(':block:')
        ? 'block'
        : scope.includes(':module:')
          ? 'module'
          : 'course';
      const targetCode = scope.split(':').pop() || 'full';
      upsertGrant.run(
        `og_${ofr.id}`,
        ofr.id,
        ofr.course_id,
        'ver_formacao_ia_v1',
        grantType,
        targetCode,
        scope,
      );
    }

    // Relatório de integridade / órfãos
    report.integrity = {
      orphanModules: Number(
        db.prepare(`SELECT COUNT(*) AS c FROM modules WHERE course_id NOT IN (SELECT id FROM courses)`).get().c,
      ),
      orphanBlocks: Number(
        db.prepare(`SELECT COUNT(*) AS c FROM blocks WHERE module_id NOT IN (SELECT id FROM modules)`).get().c,
      ),
      orphanLessons: Number(
        db.prepare(`SELECT COUNT(*) AS c FROM lessons WHERE block_id NOT IN (SELECT id FROM blocks)`).get().c,
      ),
      offerGrantsCount: Number(db.prepare(`SELECT COUNT(*) AS c FROM offer_grants`).get().c),
    };

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    db.close();
  }

  if (reportPath) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  }

  // Sincroniza snapshot documental do catálogo no store NoSQL local (compatível com Cosmos DB)
  const nosqlDir = process.env.ACADEMY_NOSQL_LOCAL_DIR?.trim() || path.resolve(process.cwd(), 'data', 'nosql');
  const contentDir = path.join(nosqlDir, 'content_documents');
  fs.mkdirSync(contentDir, { recursive: true });
  fs.writeFileSync(
    path.join(contentDir, 'tenant_codematrix.json'),
    JSON.stringify(
      [
        {
          id: 'catalog_snapshot:formacao-ia-anderzilla',
          partitionKey: 'tenant_codematrix',
          kind: 'course_catalog_snapshot',
          payload: {
            slug: 'formacao-ia-anderzilla',
            title: `Formação IA — ${formacao.title}`,
            modulesAvailable: 1,
            modulesPlanned: 2,
            lessonsPublished: report.migrated.lessonsPublished,
            slidesImported: report.migrated.slidesImported,
          },
          updatedAt: new Date().toISOString(),
        },
      ],
      null,
      2,
    ),
    'utf8',
  );

  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isMain) {
  const dryRun = process.argv.includes('--dry-run');
  const result = runSeed(dryRun ? { dbPath: ':memory:', reportPath: '' } : {});
  console.log(
    dryRun ? 'Dry-run concluído com sucesso:' : 'Seed concluído com sucesso:',
    JSON.stringify({ migrated: result.migrated, integrity: result.integrity }),
  );
}
