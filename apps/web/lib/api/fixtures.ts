// Fixture-fallback do modo FISSÃO. ZONA NEUTRA — só o Integrador altera.
//
// Permite que o slot web-data e a junção rodem ANTES do backend existir: o hook tenta a
// API; se ela não estiver lá, serve a fixture canônica do contrato (@app/shared).
//
// ⚠️ TRAVA DUPLA — NÃO AFROUXE (lição do projeto-origem / PITFALLS-LLM §3: mock vazando
// pra produção é incidente clássico). A fixture só é servida quando:
//   1. NODE_ENV === 'development' (build de produção elimina o caminho), E
//   2. NEXT_PUBLIC_USE_FIXTURES === '1' (opt-in explícito por sessão de dev).
// Fora disso, o erro real da API propaga — como deve ser.

const FIXTURES_ON =
  process.env.NODE_ENV === 'development' && process.env['NEXT_PUBLIC_USE_FIXTURES'] === '1';

export async function withFixture<T>(request: Promise<T>, fixture: T): Promise<T> {
  if (!FIXTURES_ON) return request;
  try {
    return await request;
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[fixtures] API indisponível — servindo fixture (dev + NEXT_PUBLIC_USE_FIXTURES=1)');
    return fixture;
  }
}
