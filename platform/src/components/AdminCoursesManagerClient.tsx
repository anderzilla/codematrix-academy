'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface AdminCourseRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  versions_count: number;
  modules_count: number;
  blocks_count: number;
  lessons_count: number;
  offers_count: number;
  active_partners_count: number;
}

export function AdminCoursesManagerClient({
  initialCourses,
  isFullAdmin,
}: {
  initialCourses: AdminCourseRow[];
  isFullAdmin: boolean;
}) {
  const router = useRouter();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newCategory, setNewCategory] = useState('Inteligência Artificial Aplicada');
  const [newPriceReais, setNewPriceReais] = useState('');

  const filtered = initialCourses.filter((c) => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      const priceNum = Number(newPriceReais.replace(',', '.'));
      const res = await fetch('/api/v1/admin/courses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          slug: newSlug || undefined,
          category: newCategory,
          status: 'draft',
          offerPriceCents: priceNum > 0 ? Math.round(priceNum * 100) : undefined,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; slug?: string };
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error || 'Erro ao criar curso.');
        return;
      }
      setNewTitle('');
      setNewSlug('');
      setNewPriceReais('');
      setFeedback(`Curso "${json.slug}" criado como rascunho com versão inicial v1.0.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusChange(courseId: string, status: AdminCourseRow['status']) {
    setBusy(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'update', status }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error || 'Erro ao atualizar status.');
        return;
      }
      setFeedback(`Status atualizado para "${status}".`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate(course: AdminCourseRow) {
    setBusy(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      const suffix = Date.now().toString(36).slice(-4);
      const res = await fetch(`/api/v1/admin/courses/${course.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'duplicate',
          newTitle: `${course.title} (Cópia)`,
          newSlug: `${course.slug}-${suffix}`,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; slug?: string };
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error || 'Erro ao duplicar curso.');
        return;
      }
      setFeedback(`Cópia criada em rascunho com slug "${json.slug}".`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="module-stack">
      <div className="card" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 4 }}>
            Gestão Multi-Curso · /admin/courses
          </p>
          <h1 className="section-heading" style={{ margin: 0 }}>
            Catálogo editorial e versões curriculares
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--cm-muted)', fontSize: 14 }}>
            Gerencie cursos, ciclo de vida (<code>draft → review → published → archived</code>),
            duplicação e isolamento de parceiros. Cursos com histórico nunca são excluídos fisicamente.
          </p>
        </div>
        <Link href="/admin" className="pill-btn pill-btn-secondary">
          Voltar ao painel geral
        </Link>
      </div>

      {feedback ? (
        <div className="alert-success" role="status">
          {feedback}
        </div>
      ) : null}
      {errorMsg ? (
        <div className="alert-error" role="alert">
          {errorMsg}
        </div>
      ) : null}

      {isFullAdmin ? (
        <section className="card card-highlight">
          <h2 style={{ margin: 0, fontSize: 20 }}>Novo curso (com versão inicial e oferta)</h2>
          <form onSubmit={handleCreate} className="grid-2" style={{ marginTop: 12 }}>
            <div className="field-group">
              <label htmlFor="mc-title" className="field-label">
                Título do curso
              </label>
              <input
                id="mc-title"
                className="field-input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex.: Engenharia de Agentes na Prática"
                required
              />
            </div>
            <div className="field-group">
              <label htmlFor="mc-slug" className="field-label">
                Slug público (único)
              </label>
              <input
                id="mc-slug"
                className="field-input"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="engenharia-de-agentes"
              />
            </div>
            <div className="field-group">
              <label htmlFor="mc-cat" className="field-label">
                Categoria
              </label>
              <input
                id="mc-cat"
                className="field-input"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
            </div>
            <div className="field-group">
              <label htmlFor="mc-price" className="field-label">
                Preço da oferta completa em R$ (opcional)
              </label>
              <input
                id="mc-price"
                className="field-input"
                value={newPriceReais}
                onChange={(e) => setNewPriceReais(e.target.value)}
                placeholder="Ex.: 297,00"
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="pill-btn" disabled={busy}>
                {busy ? 'Salvando...' : 'Criar curso em rascunho'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="card">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <input
            type="search"
            className="field-input"
            style={{ maxWidth: 320 }}
            placeholder="Filtrar por título, slug ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="field-input"
            style={{ maxWidth: 200 }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filtrar por status"
          >
            <option value="all">Todos os status</option>
            <option value="draft">Rascunho (draft)</option>
            <option value="review">Em revisão (review)</option>
            <option value="published">Publicado (published)</option>
            <option value="archived">Arquivado (archived)</option>
          </select>
          <span className="meta-ref">{filtered.length} curso(s) exibido(s)</span>
        </div>

        <div className="module-stack">
          {filtered.map((course) => (
            <article key={course.id} className="block-card">
              <div className="badge-row">
                <span className={course.status === 'published' ? 'badge badge-available' : 'badge badge-planned'}>
                  {course.status}
                </span>
                <span className="badge badge-brand">{course.category}</span>
                <span className="badge badge-neutral">
                  {course.versions_count} versão(ões) · {course.modules_count} mód · {course.blocks_count} blocos · {course.lessons_count} aulas
                </span>
                <span className="badge badge-neutral">
                  {course.active_partners_count} parceiro(s) ativo(s)
                </span>
              </div>
              <h3 style={{ margin: '6px 0 0', fontSize: 19 }}>{course.title}</h3>
              <p className="meta-ref" style={{ margin: '2px 0 8px' }}>
                ID: <code>{course.id}</code> · Slug: <code>{course.slug}</code> · Ofertas: {course.offers_count}
              </p>
              <div className="card-actions" style={{ flexWrap: 'wrap' }}>
                {course.status === 'published' ? (
                  <Link href={`/cursos/${course.slug}`} className="pill-btn pill-btn-secondary">
                    Pré-visualizar na vitrine
                  </Link>
                ) : null}
                {isFullAdmin ? (
                  <>
                    {course.status === 'draft' ? (
                      <button
                        type="button"
                        className="pill-btn pill-btn-secondary"
                        disabled={busy}
                        onClick={() => handleStatusChange(course.id, 'review')}
                      >
                        Enviar para revisão
                      </button>
                    ) : null}
                    {course.status !== 'published' ? (
                      <button
                        type="button"
                        className="pill-btn"
                        disabled={busy}
                        onClick={() => handleStatusChange(course.id, 'published')}
                      >
                        Publicar
                      </button>
                    ) : null}
                    {course.status !== 'archived' ? (
                      <button
                        type="button"
                        className="pill-btn pill-btn-secondary"
                        disabled={busy}
                        onClick={() => handleStatusChange(course.id, 'archived')}
                      >
                        Arquivar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="pill-btn pill-btn-secondary"
                      disabled={busy}
                      onClick={() => handleDuplicate(course)}
                    >
                      Duplicar
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
