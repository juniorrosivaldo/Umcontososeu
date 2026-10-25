import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Um Conto · Inteligência & Crescimento',
  description: 'Pesquisa, estratégia e criação com a sua marca no centro.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
