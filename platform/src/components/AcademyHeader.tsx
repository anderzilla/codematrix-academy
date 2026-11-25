'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const CORPORATE_URL =
  process.env.NEXT_PUBLIC_CORPORATE_SITE_URL || 'https://www.codematrix.com.br';

export function AcademyHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="academy-header">
      <a className="skip-link" href="#conteudo-principal">
        Pular para o conteúdo principal
      </a>
      <div className="academy-header-inner">
        <Link href="/" className="academy-brand" aria-label="CodeMatrix Academy — página inicial">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/codematrix-logo-wordmark-matrix-blue.png"
            alt="CodeMatrix"
            width={138}
            height={30}
          />
          <span className="academy-brand-tag">Academy</span>
        </Link>

        <button
          type="button"
          className="menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="academy-main-nav"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          {menuOpen ? 'Fechar menu' : 'Menu'}
        </button>

        <nav
          id="academy-main-nav"
          aria-label="Navegação principal da Academy"
          className={`academy-nav ${menuOpen ? 'is-open' : ''}`}
        >
          <Link
            href="/"
            aria-current={pathname === '/' ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
          >
            Início
          </Link>
          <Link
            href="/cursos"
            aria-current={pathname.startsWith('/cursos') ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
          >
            Cursos
          </Link>
          <Link
            href="/suporte"
            aria-current={pathname === '/suporte' ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
          >
            Suporte
          </Link>
          <a href={CORPORATE_URL} target="_blank" rel="noopener noreferrer">
            Site CodeMatrix
          </a>
          <Link
            href="/app"
            className="pill-btn pill-btn-sm"
            aria-current={pathname.startsWith('/app') ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
          >
            Área do aluno
          </Link>
        </nav>
      </div>
    </header>
  );
}
