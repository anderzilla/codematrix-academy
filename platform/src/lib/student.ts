import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { listUserActiveEntitlements, scopeGrantsBlock } from '@/lib/entitlements';

export interface SlideContent {
  title: string;
  body: string;
  visual?: string;
  example?: string;
  pause?: string;
}

export interface StudentLibraryCourse {
  courseId: string;
  slug: string;
  title: string;
  subtitle: string;
  availableLessonsCount: number;
  completedLessonsCount: number;
  progressPercent: number;
  entitlements: Array<{
    offerSku: string;
    accessScope: string;
    sourceProvider: string;
    startsAt: string;
  }>;
  certificateCode: string | null;
}

export interface StudentBlockStatus {
  id: string;
  code: string;
  position: number;
  title: string;
  focus: string;
  remediate: string;
  minPassPercent: number;
  isFreeSample: boolean;
  hasEntitlement: boolean;
  sequenceUnlocked: boolean;
  unlocked: boolean;
  lockReason: 'none' | 'no_entitlement' | 'previous_block_required';
  completedLessonsCount: number;
  totalLessonsCount: number;
  passedQuiz: boolean;
  bestScorePercent: number | null;
  attemptsCount: number;
  quizReady: boolean;
  lessons: Array<{
    id: string;
    code: string;
    position: number;
    title: string;
    goal: string;
    slidesCount: number;
    completed: boolean;
    unlocked: boolean;
  }>;
}

export interface StudentCourseRoom {
  courseId: string;
  slug: string;
  title: string;
  subtitle: string;
  completedLessonsCount: number;
  totalAvailableLessonsCount: number;
  progressPercent: number;
  eligibleForCertificate: boolean;
  certificateCode: string | null;
  modules: Array<{
    id: string;
    code: string;
    position: number;
    title: string;
    promise: string;
    status: 'draft' | 'planned' | 'published';
    blocks: StudentBlockStatus[];
  }>;
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getStudentLibrary(db: DatabaseSync, userId: string): StudentLibraryCourse[] {
  const activeEntitlements = listUserActiveEntitlements(db, userId);
  const byCourse = new Map<string, typeof activeEntitlements>();
  for (const ent of activeEntitlements) {
    const list = byCourse.get(ent.courseId) ?? [];
    list.push(ent);
    byCourse.set(ent.courseId, list);
  }

  const results: StudentLibraryCourse[] = [];
  for (const [courseId, ents] of byCourse.entries()) {
    const course = db
      .prepare(
        `SELECT id, slug, title, subtitle,
                (SELECT COUNT(*) FROM lessons l WHERE l.course_id = courses.id AND l.status = 'published') AS available_lessons,
                (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.course_id = courses.id AND lp.user_id = ?) AS completed_lessons
         FROM courses
         WHERE id = ? AND status = 'published'`,
      )
      .get(userId, courseId) as
      | {
          id: string;
          slug: string;
          title: string;
          subtitle: string;
          available_lessons: number;
          completed_lessons: number;
        }
      | undefined;

    if (!course) continue;

    const cert = db
      .prepare(
        `SELECT verification_code FROM certificates
         WHERE user_id = ? AND course_id = ? AND status = 'valid'
         LIMIT 1`,
      )
      .get(userId, courseId) as { verification_code: string } | undefined;

    const avail = Number(course.available_lessons);
    const done = Number(course.completed_lessons);
    results.push({
      courseId: course.id,
      slug: course.slug,
      title: course.title,
      subtitle: course.subtitle,
      availableLessonsCount: avail,
      completedLessonsCount: done,
      progressPercent: avail > 0 ? Math.round((done / avail) * 100) : 0,
      entitlements: ents.map((e) => ({
        offerSku: e.offerSku,
        accessScope: e.accessScope,
        sourceProvider: e.sourceProvider,
        startsAt: e.startsAt,
      })),
      certificateCode: cert?.verification_code ?? null,
    });
  }

  return results;
}

export function getStudentCourseRoom(
  db: DatabaseSync,
  userId: string,
  slug: string,
): StudentCourseRoom | null {
  const course = db
    .prepare(
      `SELECT id, slug, title, subtitle FROM courses WHERE slug = ? AND status = 'published'`,
    )
    .get(slug) as { id: string; slug: string; title: string; subtitle: string } | undefined;

  if (!course) return null;

  const entitlements = listUserActiveEntitlements(db, userId).filter(
    (e) => e.courseId === course.id,
  );

  const completedSet = new Set(
    (
      db
        .prepare(`SELECT lesson_id FROM lesson_progress WHERE user_id = ? AND course_id = ?`)
        .all(userId, course.id) as Array<{ lesson_id: string }>
    ).map((r) => r.lesson_id),
  );

  const attemptsRows = db
    .prepare(
      `SELECT block_id, score_percent, passed
       FROM quiz_attempts
       WHERE user_id = ? AND course_id = ? AND status = 'submitted'`,
    )
    .all(userId, course.id) as Array<{
    block_id: string;
    score_percent: number;
    passed: number;
  }>;

  const blockQuizStats = new Map<
    string,
    { passed: boolean; bestScore: number | null; count: number }
  >();
  for (const row of attemptsRows) {
    const prev = blockQuizStats.get(row.block_id) ?? {
      passed: false,
      bestScore: null,
      count: 0,
    };
    prev.count += 1;
    if (Number(row.passed) === 1) prev.passed = true;
    const score = Number(row.score_percent);
    if (prev.bestScore === null || score > prev.bestScore) prev.bestScore = score;
    blockQuizStats.set(row.block_id, prev);
  }

  const moduleRows = db
    .prepare(
      `SELECT id, code, position, title, promise, status
       FROM modules WHERE course_id = ? AND status IN ('published', 'planned')
       ORDER BY position ASC`,
    )
    .all(course.id) as Array<Record<string, unknown>>;

  const blockRows = db
    .prepare(
      `SELECT id, module_id, code, position, title, focus, remediate, min_pass_percent, is_free_sample
       FROM blocks WHERE course_id = ? AND status = 'published'
       ORDER BY position ASC`,
    )
    .all(course.id) as Array<Record<string, unknown>>;

  const lessonRows = db
    .prepare(
      `SELECT id, block_id, code, position, title, goal, slides_count
       FROM lessons WHERE course_id = ? AND status = 'published'
       ORDER BY position ASC`,
    )
    .all(course.id) as Array<Record<string, unknown>>;

  const lessonsByBlock = new Map<string, Array<Record<string, unknown>>>();
  for (const l of lessonRows) {
    const bid = String(l.block_id);
    const list = lessonsByBlock.get(bid) ?? [];
    list.push(l);
    lessonsByBlock.set(bid, list);
  }

  const passedByPosition = new Map<number, boolean>();
  for (const b of blockRows) {
    const stats = blockQuizStats.get(String(b.id));
    passedByPosition.set(Number(b.position), Boolean(stats?.passed));
  }

  const blocksByModule = new Map<string, StudentBlockStatus[]>();
  let allPublishedBlocksPassed = blockRows.length > 0;

  for (const b of blockRows) {
    const modRow = moduleRows.find((m) => String(m.id) === String(b.module_id));
    const modCode = modRow ? String(modRow.code) : 'M1';
    const blkCode = String(b.code);
    const blkPos = Number(b.position);
    const blkId = String(b.id);

    const hasEntitlement = entitlements.some((e) =>
      scopeGrantsBlock(e.accessScope, course.slug, modCode, blkCode),
    );
    const sequenceUnlocked = blkPos === 1 || Boolean(passedByPosition.get(blkPos - 1));
    const unlocked = hasEntitlement && sequenceUnlocked;
    const lockReason: StudentBlockStatus['lockReason'] = !hasEntitlement
      ? 'no_entitlement'
      : !sequenceUnlocked
        ? 'previous_block_required'
        : 'none';

    const blkLessonsRaw = lessonsByBlock.get(blkId) ?? [];
    const blkLessons = blkLessonsRaw.map((l) => {
      const lid = String(l.id);
      return {
        id: lid,
        code: String(l.code),
        position: Number(l.position),
        title: String(l.title),
        goal: String(l.goal),
        slidesCount: Number(l.slides_count),
        completed: completedSet.has(lid),
        unlocked,
      };
    });

    const completedLessonsCount = blkLessons.filter((l) => l.completed).length;
    const stats = blockQuizStats.get(blkId);
    const passedQuiz = Boolean(stats?.passed);
    if (!passedQuiz) allPublishedBlocksPassed = false;

    const item: StudentBlockStatus = {
      id: blkId,
      code: blkCode,
      position: blkPos,
      title: String(b.title),
      focus: String(b.focus),
      remediate: String(b.remediate),
      minPassPercent: Number(b.min_pass_percent),
      isFreeSample: Number(b.is_free_sample) === 1,
      hasEntitlement,
      sequenceUnlocked,
      unlocked,
      lockReason,
      completedLessonsCount,
      totalLessonsCount: blkLessons.length,
      passedQuiz,
      bestScorePercent: stats?.bestScore ?? null,
      attemptsCount: stats?.count ?? 0,
      quizReady: unlocked && completedLessonsCount === blkLessons.length && blkLessons.length > 0,
      lessons: blkLessons,
    };

    const modId = String(b.module_id);
    const list = blocksByModule.get(modId) ?? [];
    list.push(item);
    blocksByModule.set(modId, list);
  }

  const totalAvailableLessonsCount = lessonRows.length;
  const completedLessonsCount = lessonRows.filter((l) => completedSet.has(String(l.id))).length;
  const eligibleForCertificate =
    totalAvailableLessonsCount > 0 &&
    completedLessonsCount === totalAvailableLessonsCount &&
    allPublishedBlocksPassed;

  const cert = db
    .prepare(
      `SELECT verification_code FROM certificates
       WHERE user_id = ? AND course_id = ? AND status = 'valid'
       LIMIT 1`,
    )
    .get(userId, course.id) as { verification_code: string } | undefined;

  return {
    courseId: course.id,
    slug: course.slug,
    title: course.title,
    subtitle: course.subtitle,
    completedLessonsCount,
    totalAvailableLessonsCount,
    progressPercent:
      totalAvailableLessonsCount > 0
        ? Math.round((completedLessonsCount / totalAvailableLessonsCount) * 100)
        : 0,
    eligibleForCertificate,
    certificateCode: cert?.verification_code ?? null,
    modules: moduleRows.map((m) => ({
      id: String(m.id),
      code: String(m.code),
      position: Number(m.position),
      title: String(m.title),
      promise: String(m.promise),
      status: m.status as 'draft' | 'planned' | 'published',
      blocks: blocksByModule.get(String(m.id)) ?? [],
    })),
  };
}

export function getProtectedLessonContent(
  db: DatabaseSync,
  userId: string,
  slug: string,
  lessonCode: string,
):
  | {
      ok: true;
      courseId: string;
      courseSlug: string;
      courseTitle: string;
      moduleCode: string;
      blockCode: string;
      blockTitle: string;
      lesson: {
        id: string;
        code: string;
        position: number;
        title: string;
        goal: string;
        slides: SlideContent[];
        completed: boolean;
      };
      videoAsset: {
        assetCode: string;
        status: string;
        hasStreamUid: boolean;
      } | null;
      nextLessonCode: string | null;
      isLastLessonInBlock: boolean;
    }
  | { ok: false; status: 403 | 404; code: string; error: string } {
  const room = getStudentCourseRoom(db, userId, slug);
  if (!room) {
    return { ok: false, status: 404, code: 'course_not_found', error: 'Curso não encontrado.' };
  }

  for (const mod of room.modules) {
    for (const blk of mod.blocks) {
      const lessonIdx = blk.lessons.findIndex(
        (l) => l.code.toLowerCase() === lessonCode.toLowerCase(),
      );
      if (lessonIdx === -1) continue;

      if (!blk.hasEntitlement) {
        return {
          ok: false,
          status: 403,
          code: 'no_entitlement',
          error: 'Você não possui acesso liberado para este bloco/módulo.',
        };
      }
      if (!blk.sequenceUnlocked) {
        return {
          ok: false,
          status: 403,
          code: 'previous_block_required',
          error: 'Conclua o quiz do bloco anterior com pelo menos 70% para liberar esta aula.',
        };
      }

      const lessonMeta = blk.lessons[lessonIdx];
      const rawLesson = db
        .prepare(`SELECT content_json FROM lessons WHERE id = ?`)
        .get(lessonMeta.id) as { content_json: string } | undefined;

      let slides: SlideContent[] = [];
      try {
        slides = JSON.parse(rawLesson?.content_json || '[]') as SlideContent[];
      } catch {
        slides = [];
      }

      const videoAssetRow = db
        .prepare(
          `SELECT code, status, stream_uid FROM assets
           WHERE lesson_id = ? AND kind = 'stream_video'
           LIMIT 1`,
        )
        .get(lessonMeta.id) as
        | { code: string; status: string; stream_uid: string | null }
        | undefined;

      const nextInBlock = blk.lessons[lessonIdx + 1]?.code ?? null;

      return {
        ok: true,
        courseId: room.courseId,
        courseSlug: room.slug,
        courseTitle: room.title,
        moduleCode: mod.code,
        blockCode: blk.code,
        blockTitle: blk.title,
        lesson: {
          id: lessonMeta.id,
          code: lessonMeta.code,
          position: lessonMeta.position,
          title: lessonMeta.title,
          goal: lessonMeta.goal,
          slides,
          completed: lessonMeta.completed,
        },
        videoAsset: videoAssetRow
          ? {
              assetCode: videoAssetRow.code,
              status: videoAssetRow.status,
              hasStreamUid: Boolean(videoAssetRow.stream_uid),
            }
          : null,
        nextLessonCode: nextInBlock,
        isLastLessonInBlock: lessonIdx === blk.lessons.length - 1,
      };
    }
  }

  return { ok: false, status: 404, code: 'lesson_not_found', error: 'Aula não encontrada.' };
}

export function completeLessonForUser(
  db: DatabaseSync,
  userId: string,
  slug: string,
  lessonCode: string,
): { ok: true; lessonId: string; blockCode: string } | { ok: false; status: 403 | 404; error: string } {
  const access = getProtectedLessonContent(db, userId, slug, lessonCode);
  if (!access.ok) {
    return { ok: false, status: access.status, error: access.error };
  }

  db.prepare(
    `INSERT INTO lesson_progress (id, user_id, course_id, lesson_id)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, lesson_id) DO UPDATE SET reviewed_at = datetime('now')`,
  ).run(
    `lp_${crypto.randomUUID().replace(/-/g, '')}`,
    userId,
    access.courseId,
    access.lesson.id,
  );

  return { ok: true, lessonId: access.lesson.id, blockCode: access.blockCode };
}

interface StoredQuizQuestionSnapshot {
  questionId: string;
  questionCode: string;
  lessonPosition: number;
  skill: string;
  question: string;
  options: Array<{ text: string; isCorrect: boolean }>;
  explanation: string;
}

export function startBlockQuizAttempt(
  db: DatabaseSync,
  userId: string,
  slug: string,
  blockCode: string,
):
  | {
      ok: true;
      attemptId: string;
      blockCode: string;
      blockTitle: string;
      minPassPercent: number;
      questions: Array<{
        index: number;
        questionId: string;
        question: string;
        options: string[];
      }>;
    }
  | { ok: false; status: 400 | 403 | 404; code: string; error: string } {
  const room = getStudentCourseRoom(db, userId, slug);
  if (!room) {
    return { ok: false, status: 404, code: 'course_not_found', error: 'Curso não encontrado.' };
  }

  let targetBlock: StudentBlockStatus | null = null;
  for (const mod of room.modules) {
    const found = mod.blocks.find((b) => b.code.toLowerCase() === blockCode.toLowerCase());
    if (found) {
      targetBlock = found;
      break;
    }
  }

  if (!targetBlock) {
    return { ok: false, status: 404, code: 'block_not_found', error: 'Bloco não encontrado.' };
  }
  if (!targetBlock.hasEntitlement) {
    return {
      ok: false,
      status: 403,
      code: 'no_entitlement',
      error: 'Você não possui acesso liberado para este bloco.',
    };
  }
  if (!targetBlock.sequenceUnlocked) {
    return {
      ok: false,
      status: 403,
      code: 'previous_block_required',
      error: 'Conclua o bloco anterior com pelo menos 70% antes de iniciar este quiz.',
    };
  }
  if (!targetBlock.quizReady) {
    return {
      ok: false,
      status: 400,
      code: 'lessons_incomplete',
      error: 'Conclua as 3 aulas deste bloco antes de iniciar o quiz de avaliação.',
    };
  }

  const bankRows = db
    .prepare(
      `SELECT id, question_code, lesson_position, question, options_json, correct_index, skill, explanation
       FROM quiz_questions
       WHERE course_id = ? AND block_id = ?`,
    )
    .all(room.courseId, targetBlock.id) as Array<{
    id: string;
    question_code: string;
    lesson_position: number;
    question: string;
    options_json: string;
    correct_index: number;
    skill: string;
    explanation: string;
  }>;

  if (bankRows.length === 0) {
    return {
      ok: false,
      status: 404,
      code: 'quiz_bank_empty',
      error: 'Banco de questões indisponível para este bloco.',
    };
  }

  const selected = shuffleArray(bankRows).slice(0, Math.min(10, bankRows.length));
  const snapshot: StoredQuizQuestionSnapshot[] = selected.map((row) => {
    const rawOptions = JSON.parse(row.options_json) as string[];
    const tagged = rawOptions.map((text, idx) => ({
      text,
      isCorrect: idx === Number(row.correct_index),
    }));
    return {
      questionId: row.id,
      questionCode: row.question_code,
      lessonPosition: Number(row.lesson_position),
      skill: row.skill,
      question: row.question,
      options: shuffleArray(tagged),
      explanation: row.explanation,
    };
  });

  const attemptId = `qa_${crypto.randomUUID().replace(/-/g, '')}`;
  db.prepare(
    `INSERT INTO quiz_attempts (
       id, user_id, course_id, block_id, status, questions_snapshot_json, total_count
     ) VALUES (?, ?, ?, ?, 'in_progress', ?, ?)`,
  ).run(
    attemptId,
    userId,
    room.courseId,
    targetBlock.id,
    JSON.stringify(snapshot),
    snapshot.length,
  );

  // Nunca retornar isCorrect, correct_index ou explanation antes da submissão
  return {
    ok: true,
    attemptId,
    blockCode: targetBlock.code,
    blockTitle: targetBlock.title,
    minPassPercent: targetBlock.minPassPercent,
    questions: snapshot.map((q, index) => ({
      index,
      questionId: q.questionId,
      question: q.question,
      options: q.options.map((o) => o.text),
    })),
  };
}

export function submitBlockQuizAttempt(
  db: DatabaseSync,
  userId: string,
  slug: string,
  blockCode: string,
  attemptId: string,
  answers: number[],
):
  | {
      ok: true;
      attemptId: string;
      scorePercent: number;
      correctCount: number;
      totalCount: number;
      minPassPercent: number;
      passed: boolean;
      reviewItems: Array<{
        question: string;
        skill: string;
        lessonPosition: number;
        selectedText: string;
        expectedText: string;
        explanation: string;
      }>;
    }
  | { ok: false; status: 400 | 403 | 404; error: string } {
  const attempt = db
    .prepare(
      `SELECT qa.id, qa.user_id, qa.course_id, qa.block_id, qa.status, qa.questions_snapshot_json,
              b.code AS block_code, b.min_pass_percent, c.slug AS course_slug
       FROM quiz_attempts qa
       INNER JOIN blocks b ON b.id = qa.block_id
       INNER JOIN courses c ON c.id = qa.course_id
       WHERE qa.id = ?`,
    )
    .get(attemptId) as
    | {
        id: string;
        user_id: string;
        course_id: string;
        block_id: string;
        status: string;
        questions_snapshot_json: string;
        block_code: string;
        min_pass_percent: number;
        course_slug: string;
      }
    | undefined;

  if (!attempt || attempt.course_slug !== slug || attempt.block_code.toLowerCase() !== blockCode.toLowerCase()) {
    return { ok: false, status: 404, error: 'Tentativa de quiz não encontrada.' };
  }
  if (attempt.user_id !== userId) {
    return { ok: false, status: 403, error: 'Você não tem permissão para enviar esta tentativa.' };
  }
  if (attempt.status === 'submitted') {
    return { ok: false, status: 400, error: 'Esta tentativa já foi corrigida. Inicie uma nova tentativa.' };
  }

  const snapshot = JSON.parse(attempt.questions_snapshot_json) as StoredQuizQuestionSnapshot[];
  if (!Array.isArray(answers) || answers.length !== snapshot.length) {
    return {
      ok: false,
      status: 400,
      error: `Responda todas as ${snapshot.length} questões antes de enviar.`,
    };
  }

  let correctCount = 0;
  const reviewItems: Array<{
    question: string;
    skill: string;
    lessonPosition: number;
    selectedText: string;
    expectedText: string;
    explanation: string;
  }> = [];

  snapshot.forEach((q, idx) => {
    const chosenIdx = Number(answers[idx]);
    const expectedIdx = q.options.findIndex((o) => o.isCorrect);
    if (chosenIdx === expectedIdx) {
      correctCount += 1;
    } else {
      reviewItems.push({
        question: q.question,
        skill: q.skill,
        lessonPosition: q.lessonPosition,
        selectedText: q.options[chosenIdx]?.text ?? 'Sem resposta',
        expectedText: q.options[expectedIdx]?.text ?? '',
        explanation: q.explanation,
      });
    }
  });

  const scorePercent = Math.round((correctCount / snapshot.length) * 100);
  const minPassPercent = Number(attempt.min_pass_percent);
  const passed = scorePercent >= minPassPercent;

  db.prepare(
    `UPDATE quiz_attempts
     SET status = 'submitted',
         answers_json = ?,
         score_percent = ?,
         correct_count = ?,
         passed = ?,
         submitted_at = datetime('now')
     WHERE id = ?`,
  ).run(JSON.stringify(answers), scorePercent, correctCount, passed ? 1 : 0, attempt.id);

  return {
    ok: true,
    attemptId: attempt.id,
    scorePercent,
    correctCount,
    totalCount: snapshot.length,
    minPassPercent,
    passed,
    reviewItems,
  };
}
