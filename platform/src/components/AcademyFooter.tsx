import Link from 'next/link';

const CORPORATE_URL =
  process.env.ACADEMY_CORPORATE_SITE_URL || 'https://www.codematrix.com.br';

export function AcademyFooter() {
  return (
    <footer className="academy-footer">
      <div className="academy-footer-inner">
        <div>
          <Link href="/" aria-label="CodeMatrix Academy">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/codematrix-logo-wordmark-matrix-blue.png"
              alt="CodeMatrix"
              width={118}
              height={26}
            />
          </Link>
          <p style={{ margin: '8px 0 0' }}>
            CodeMatrix Academy · Ambiente educacional dedicado em{' '}
            <span>academy.codematrix.com.br</span>
          </p>
        </div>

        <nav aria-label="Links institucionais e áreas da plataforma">
          <Link href="/cursos">Cursos</Link>
          <Link href="/suporte">Suporte</Link>
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/termos">Termos de uso</Link>
          <Link href="/partners">Parceiros</Link>
          <Link href="/admin">Administração</Link>
          <a href={CORPORATE_URL} target="_blank" rel="noopener noreferrer">
            codematrix.com.br
          </a>
        </nav>
      </div>
    </footer>
  );
}
