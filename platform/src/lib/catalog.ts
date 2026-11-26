import { getDb } from './db';

export interface CourseSummary {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  category: string;
  language: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  plannedModulesCount: number;
  plannedLessonsCount: number;
  plannedBlocksCount: number;
  minPassPercent: number;
  availableModulesCount: number;
  availableLessonsCount: number;
  availableBlocksCount: number;
  hasFreeSample: boolean;
  freeSampleOfferCode: string | null;
}

export interface PublicLessonItem {
  id: string;
  code: string;
  position: number;
  title: string;
  goal: string;
  slidesCount: number;
  status: 'draft' | 'planned' | 'published';
}

export interface PublicBlockItem {
  id: string;
  code: string;
  position: number;
  title: string;
  focus: string;
  minPassPercent: number;
  isFreeSample: boolean;
  status: 'draft' | 'planned' | 'published';
  quizQuestionBankCount: number;
  lessons: PublicLessonItem[];
}

export interface PublicModuleItem {
  id: string;
  code: string;
  position: number;
  title: string;
  promise: string;
  status: 'draft' | 'planned' | 'published';
  blocks: PublicBlockItem[];
}

export interface PublicOfferItem {
  id: string;
  courseId: string;
  sku: string;
  offerCode: string;
  title: string;
  description: string;
  accessScope: string;
  isFree: boolean;
  priceCents: number | null;
  currency: string;
  status: 'draft' | 'published' | 'archived';
  hotmartProductId: string | null;
  hotmartOfferCode: string | null;
}

export interface CourseDetail extends CourseSummary {
  modules: PublicModuleItem[];
  publishedOffers: PublicOfferItem[];
  draftOffersCount: number;
  assetsSummary: {
    slidesPacks: number;
    streamVideosReady: number;
    streamVideosPending: number;
    projectGuides: number;
  };
}

export interface CmsPageSection {
  heading: string;
  paragraphs: string[];
}

export interface CmsPage {
  slug: string;
  title: string;
  subtitle: string;
  status: 'draft' | 'published';
  reviewNotice: string;
  sections: CmsPageSection[];
  updatedAt: string;
}

export function listPublishedCourses(query?: string, category?: string): CourseSummary[] {
  const db = getDb();
  const trimmed = query?.trim().toLowerCase() ?? '';
  const trimmedCat = category?.trim().toLowerCase() ?? '';
  const whereParts = [`c.status = 'published'`];
  const params: string[] = [];

  if (trimmed) {
    whereParts.push(
      `(LOWER(c.title) LIKE ? OR LOWER(c.subtitle) LIKE ? OR LOWER(c.summary) LIKE ? OR LOWER(c.category) LIKE ?)`,
    );
    params.push(`%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`);
  }
  if (trimmedCat) {
    whereParts.push(`LOWER(c.category) = ?`);
    params.push(trimmedCat);
  }

  const sql = `
    SELECT
      c.id, c.slug, c.title, c.subtitle, c.summary, c.category, c.language, c.status,
      c.planned_modules_count, c.planned_lessons_count, c.planned_blocks_count, c.min_pass_percent,
      (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id AND m.status = 'published') AS available_modules_count,
      (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id AND l.status = 'published') AS available_lessons_count,
      (SELECT COUNT(*) FROM blocks b WHERE b.course_id = c.id AND b.status = 'published') AS available_blocks_count,
      (SELECT CASE WHEN EXISTS(SELECT 1 FROM blocks b WHERE b.course_id = c.id AND b.is_free_sample = 1 AND b.status = 'published') THEN 1 ELSE 0 END) AS has_free_sample,
      (SELECT o.offer_code FROM offers o WHERE o.course_id = c.id AND o.is_free = 1 AND o.status = 'published' ORDER BY o.created_at ASC LIMIT 1) AS free_sample_offer_code
    FROM courses c
    WHERE ${whereParts.join(' AND ')}
    ORDER BY c.created_at ASC, c.slug ASC
  `;

  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    subtitle: String(row.subtitle),
    summary: String(row.summary),
    category: String(row.category),
    language: String(row.language),
    status: row.status as CourseSummary['status'],
    plannedModulesCount: Number(row.planned_modules_count),
    plannedLessonsCount: Number(row.planned_lessons_count),
    plannedBlocksCount: Number(row.planned_blocks_count),
    minPassPercent: Number(row.min_pass_percent),
    availableModulesCount: Number(row.available_modules_count),
    availableLessonsCount: Number(row.available_lessons_count),
    availableBlocksCount: Number(row.available_blocks_count),
    hasFreeSample: Number(row.has_free_sample) === 1 || Boolean(row.free_sample_offer_code),
    freeSampleOfferCode: row.free_sample_offer_code ? String(row.free_sample_offer_code) : null,
  }));
}

export function resolveCourseSlugAlias(slug: string): string | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT c.slug
       FROM course_slug_aliases a
       INNER JOIN courses c ON c.id = a.course_id
       WHERE a.old_slug = ? AND c.status = 'published'
       LIMIT 1`,
    )
    .get(slug) as { slug: string } | undefined;
  return row?.slug ?? null;
}

export function getPublishedCourseBySlug(slug: string): CourseDetail | null {
  const db = getDb();
  const courseRow = db
    .prepare(
      `SELECT id, slug, title, subtitle, summary, category, language, status,
              planned_modules_count, planned_lessons_count, planned_blocks_count, min_pass_percent
       FROM courses
       WHERE slug = ? AND status = 'published'`,
    )
    .get(slug) as Record<string, unknown> | undefined;

  if (!courseRow) {
    return null;
  }

  const courseId = String(courseRow.id);

  const moduleRows = db
    .prepare(
      `SELECT id, code, position, title, promise, status
       FROM modules
       WHERE course_id = ? AND status IN ('published', 'planned')
       ORDER BY position ASC`,
    )
    .all(courseId) as Array<Record<string, unknown>>;

  const blockRows = db
    .prepare(
      `SELECT b.id, b.module_id, b.code, b.position, b.title, b.focus, b.min_pass_percent, b.is_free_sample, b.status,
              (SELECT COUNT(*) FROM quiz_questions q WHERE q.block_id = b.id) AS quiz_count
       FROM blocks b
       WHERE b.course_id = ? AND b.status IN ('published', 'planned')
       ORDER BY b.position ASC`,
    )
    .all(courseId) as Array<Record<string, unknown>>;

  const lessonRows = db
    .prepare(
      `SELECT id, block_id, code, position, title, goal, slides_count, status
       FROM lessons
       WHERE course_id = ? AND status = 'published'
       ORDER BY position ASC`,
    )
    .all(courseId) as Array<Record<string, unknown>>;

  const publishedOffersRows = db
    .prepare(
      `SELECT id, course_id, sku, offer_code, title, description, access_scope, is_free,
              price_cents, currency, status, hotmart_product_id, hotmart_offer_code
       FROM offers
       WHERE course_id = ? AND status = 'published'
       ORDER BY is_free DESC, sku ASC`,
    )
    .all(courseId) as Array<Record<string, unknown>>;

  const draftOfferCountRow = db
    .prepare(`SELECT COUNT(*) AS cnt FROM offers WHERE course_id = ? AND status = 'draft'`)
    .get(courseId) as { cnt: number };

  const assetStatsRows = db
    .prepare(
      `SELECT kind, status, COUNT(*) AS cnt
       FROM assets
       WHERE course_id = ?
       GROUP BY kind, status`,
    )
    .all(courseId) as Array<{ kind: string; status: string; cnt: number }>;

  let slidesPacks = 0;
  let streamVideosReady = 0;
  let streamVideosPending = 0;
  let projectGuides = 0;
  for (const row of assetStatsRows) {
    if (row.kind === 'slides') slidesPacks += Number(row.cnt);
    if (row.kind === 'project_guide') projectGuides += Number(row.cnt);
    if (row.kind === 'stream_video' && row.status === 'ready') streamVideosReady += Number(row.cnt);
    if (row.kind === 'stream_video' && row.status !== 'ready') streamVideosPending += Number(row.cnt);
  }

  const lessonsByBlock = new Map<string, PublicLessonItem[]>();
  for (const l of lessonRows) {
    const blockId = String(l.block_id);
    const list = lessonsByBlock.get(blockId) ?? [];
    list.push({
      id: String(l.id),
      code: String(l.code),
      position: Number(l.position),
      title: String(l.title),
      goal: String(l.goal),
      slidesCount: Number(l.slides_count),
      status: l.status as PublicLessonItem['status'],
    });
    lessonsByBlock.set(blockId, list);
  }

  const blocksByModule = new Map<string, PublicBlockItem[]>();
  for (const b of blockRows) {
    const moduleId = String(b.module_id);
    const list = blocksByModule.get(moduleId) ?? [];
    list.push({
      id: String(b.id),
      code: String(b.code),
      position: Number(b.position),
      title: String(b.title),
      focus: String(b.focus),
      minPassPercent: Number(b.min_pass_percent),
      isFreeSample: Number(b.is_free_sample) === 1,
      status: b.status as PublicBlockItem['status'],
      quizQuestionBankCount: Number(b.quiz_count),
      lessons: lessonsByBlock.get(String(b.id)) ?? [],
    });
    blocksByModule.set(moduleId, list);
  }

  const modules: PublicModuleItem[] = moduleRows.map((m) => ({
    id: String(m.id),
    code: String(m.code),
    position: Number(m.position),
    title: String(m.title),
    promise: String(m.promise),
    status: m.status as PublicModuleItem['status'],
    blocks: blocksByModule.get(String(m.id)) ?? [],
  }));

  const publishedOffers: PublicOfferItem[] = publishedOffersRows.map((o) => ({
    id: String(o.id),
    courseId: String(o.course_id),
    sku: String(o.sku),
    offerCode: String(o.offer_code),
    title: String(o.title),
    description: String(o.description),
    accessScope: String(o.access_scope),
    isFree: Number(o.is_free) === 1,
    priceCents: o.price_cents === null ? null : Number(o.price_cents),
    currency: String(o.currency),
    status: o.status as PublicOfferItem['status'],
    hotmartProductId: o.hotmart_product_id ? String(o.hotmart_product_id) : null,
    hotmartOfferCode: o.hotmart_offer_code ? String(o.hotmart_offer_code) : null,
  }));

  return {
    id: courseId,
    slug: String(courseRow.slug),
    title: String(courseRow.title),
    subtitle: String(courseRow.subtitle),
    summary: String(courseRow.summary),
    category: String(courseRow.category),
    language: String(courseRow.language),
    status: courseRow.status as CourseDetail['status'],
    plannedModulesCount: Number(courseRow.planned_modules_count),
    plannedLessonsCount: Number(courseRow.planned_lessons_count),
    plannedBlocksCount: Number(courseRow.planned_blocks_count),
    minPassPercent: Number(courseRow.min_pass_percent),
    availableModulesCount: modules.filter((m) => m.status === 'published').length,
    availableLessonsCount: lessonRows.length,
    availableBlocksCount: blockRows.filter((b) => b.status === 'published').length,
    hasFreeSample: blockRows.some((b) => Number(b.is_free_sample) === 1 && b.status === 'published'),
    freeSampleOfferCode: publishedOffers.find((o) => o.isFree)?.offerCode ?? null,
    modules,
    publishedOffers,
    draftOffersCount: Number(draftOfferCountRow.cnt),
    assetsSummary: {
      slidesPacks,
      streamVideosReady,
      streamVideosPending,
      projectGuides,
    },
  };
}

export function getPublishedOfferByCode(offerCode: string): (PublicOfferItem & { courseSlug: string; courseTitle: string }) | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT o.id, o.course_id, o.sku, o.offer_code, o.title, o.description, o.access_scope,
              o.is_free, o.price_cents, o.currency, o.status, o.hotmart_product_id, o.hotmart_offer_code,
              c.slug AS course_slug, c.title AS course_title
       FROM offers o
       INNER JOIN courses c ON c.id = o.course_id
       WHERE o.offer_code = ? AND o.status = 'published' AND c.status = 'published'`,
    )
    .get(offerCode) as Record<string, unknown> | undefined;

  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    courseId: String(row.course_id),
    sku: String(row.sku),
    offerCode: String(row.offer_code),
    title: String(row.title),
    description: String(row.description),
    accessScope: String(row.access_scope),
    isFree: Number(row.is_free) === 1,
    priceCents: row.price_cents === null ? null : Number(row.price_cents),
    currency: String(row.currency),
    status: row.status as PublicOfferItem['status'],
    hotmartProductId: row.hotmart_product_id ? String(row.hotmart_product_id) : null,
    hotmartOfferCode: row.hotmart_offer_code ? String(row.hotmart_offer_code) : null,
    courseSlug: String(row.course_slug),
    courseTitle: String(row.course_title),
  };
}

export function getPublishedCmsPage(slug: string): CmsPage | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT slug, title, subtitle, status, review_notice, sections_json, updated_at
       FROM cms_pages
       WHERE slug = ? AND status = 'published'`,
    )
    .get(slug) as Record<string, unknown> | undefined;

  if (!row) {
    return null;
  }

  let sections: CmsPageSection[] = [];
  try {
    sections = JSON.parse(String(row.sections_json)) as CmsPageSection[];
  } catch {
    sections = [];
  }

  return {
    slug: String(row.slug),
    title: String(row.title),
    subtitle: String(row.subtitle),
    status: row.status as CmsPage['status'],
    reviewNotice: String(row.review_notice),
    sections,
    updatedAt: String(row.updated_at),
  };
}
