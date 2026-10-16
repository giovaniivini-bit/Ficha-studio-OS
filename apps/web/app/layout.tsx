// Layout raiz — providers globais. ZONA NEUTRA: só o Integrador altera.
// Provider novo (ex.: ToastProvider) entra AQUI via Integrador, nunca via slot.
// Tela standalone que precisa de provider próprio monta ele localmente
// (lição projeto-origem / LEARNINGS 1.6) — não mexe neste arquivo.

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/lib/providers';
import './globals.css';

// Fonte da fundacao AdminCN: Geist. Registra --font-geist-sans / --font-geist-mono que o
// @theme inline do ui-kit referencia (font-sans). Sem isto, font-sans cai no serif do browser.

export const metadata: Metadata = {
  title: 'Ficha Studio — Fichas técnicas de vestuário',
  description: 'Da imagem à ficha técnica: extraia, revise e padronize seus produtos.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
