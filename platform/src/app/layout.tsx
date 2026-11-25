import type { Metadata } from 'next';
import './globals.css';
import { AcademyHeader } from '@/components/AcademyHeader';
import { AcademyFooter } from '@/components/AcademyFooter';

export const metadata: Metadata = {
  title: 'CodeMatrix Academy — Formação prática em IA e tecnologia',
  description:
    'Plataforma educacional da CodeMatrix para formação prática em Inteligência Artificial e tecnologia aplicada para PMEs e profissionais.',
  icons: {
    icon: [{ url: '/assets/codematrix-logo-blue.png', type: 'image/png' }],
    apple: [{ url: '/assets/codematrix-logo-blue.png', type: 'image/png' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <AcademyHeader />
        <main id="conteudo-principal">{children}</main>
        <AcademyFooter />
      </body>
    </html>
  );
}
