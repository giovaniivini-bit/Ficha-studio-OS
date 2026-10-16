# ADR 006 — Frontend decomposto + data layer único (React Query)

**Status:** aceito (de fábrica — herdado do projeto-origem da metodologia)

## Contexto

Duas classes de erro dominaram o início do frontend no projeto-origem: (a) hooks/
`use client` em server component — o erro mais repetido por agentes no App Router; e
(b) server-state espalhado (`fetch` solto, dados em `useState`) — cache duplicado,
telas dessincronizadas, refetch manual. Uma decomposição fixa por tela + um data layer
único eliminaram as duas classes inteiras de uma vez.

## Decisão

1. **Toda tela segue a mesma decomposição em 3 camadas:**
   - `page.tsx` — **server e thin**: zero `'use client'`, zero hooks, zero dados.
     Só importa e renderiza o client da rota.
   - `<rota>-client.tsx` — `'use client'`, o ORQUESTRADOR: chama os hooks de dados,
     segura estado de UI, compõe os componentes. **Teto ~300 linhas** — passou disso,
     extrai componentes pra `components/` da rota.
   - `components/` locais — **presentacionais**: recebem tudo por props, zero hooks
     de dados.
2. **Server-state SÓ em React Query**, em `apps/web/lib/queries/<dominio>.ts`
   (1 domínio = 1 arquivo = 1 território de slot), com **query-key factory**
   (objeto `<dominio>Keys` — nunca string solta) e resposta validada com o schema
   Zod de `@app/shared`. O barrel `apps/web/lib/queries/index.ts` é **zona neutra**
   (Integrador sincroniza no reconcile).
3. **Proibido:** `fetch` solto em tela (sempre via hook → `apiFetch` de
   `apps/web/lib/api/client.ts`) e server-state em `useState` (`useState` é só pra
   estado de UI: modal aberto, input, seleção).
4. **Componente local que outra rota precisar = candidato à fundação:** o Dev registra
   no ARTIFACTS.md do slot e o **Integrador promove** pra `apps/web/components/ui/`
   (zona neutra). NUNCA copia-e-cola entre rotas — duas cópias divergem em uma semana.

## Consequências

- A classe de erros "use client"/hooks em server component desaparece por construção:
  hook só existe em arquivo que já é client.
- Cache, invalidation e loading states ficam de graça (React Query) e consistentes
  entre telas do mesmo domínio.
- A troca mock→API real (ADR 001) acontece num arquivo só (o hook), telas intactas.
- Slot de frontend tem território limpo: `apps/web/app/<grupo>/<rota>/**` +
  `apps/web/lib/queries/<dominio>.ts`.

## Como aplicar neste repo

- **Exemplo canônico vivo:** `apps/web/app/page.tsx` (server, thin) →
  `apps/web/app/home-client.tsx` (orquestrador) →
  `apps/web/app/components/health-card.tsx` (presentacional).
- **Data layer canônico:** `apps/web/lib/queries/health.ts` (`healthKeys` +
  `useHealth()` validando com `HealthDtoSchema`). Replique por domínio.
- Fundação de UI existente: `apps/web/components/ui/` (`button`, `card`, `tag`) —
  promova candidatos pra cá via Integrador, importando do barrel
  `apps/web/components/ui/index.ts`.
