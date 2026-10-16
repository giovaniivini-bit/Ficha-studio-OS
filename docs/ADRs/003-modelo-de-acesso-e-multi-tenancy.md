# ADR 003 — Modelo de acesso e multi-tenancy decididos no kickoff

**Status:** aceito (de fábrica — herdado do projeto-origem da metodologia)

## Contexto

Multi-tenancy não é feature — é fundação. No projeto-origem a pergunta foi feita no
kickoff e a resposta ("sim, múltiplas organizações") moldou a migration 0000. Projetos
que tentam "adaptar depois" descobrem que tenancy permeia TODA tabela, TODA query, TODO
endpoint e TODO log: a adaptação tardia é um refactor enorme com risco de vazamento de
dados entre clientes (STACK-DEFAULT §5). A decisão tem que ser tomada quando ainda custa
zero — no kickoff.

## Decisão

1. **O CTO pergunta ao fundador no KICKOFF:** "o produto atende múltiplas
   organizações/clientes?" É uma das poucas perguntas que o fundador responde —
   é decisão de produto, não técnica.
2. **Se SIM (multi-tenant):**
   - `workspaceId` em **TODA tabela desde a migration 0000** — a tabela `workspace`
     nasce primeiro, tudo referencia ela (`NOT NULL` + FK). Sem exceção, nem em
     tabela "que nunca vai precisar".
   - **Papéis top-level + perfis por membership:** o usuário existe uma vez
     (identidade global); o que ele PODE fazer vem do vínculo `membership`
     (usuário × workspace × papel). Permissão nunca mora no usuário solto.
   - **Autorização SEMPRE no backend.** Esconder botão na UI é UX, não segurança —
     todo endpoint valida workspace + papel no servidor.
   - **RLS no Supabase ativado dia 1** (defense in depth — mesmo com o backend
     validando, o banco também recusa acesso cruzado).
3. **Se NÃO (single-tenant):** registrar a decisão explicitamente (neste ADR ou num
   ADR do projeto) — ela é difícil de reverter e todo mundo precisa saber que foi
   tomada de propósito.

## Consequências

- Multi-tenant: custo pequeno e constante desde o início (1 coluna + 1 filtro por
  query) em troca de nunca pagar o refactor gigante.
- Query sem filtro de workspace vira bug de SEGURANÇA, não de lógica — o review
  estrutural do Integrador trata como Critical.
- O smoke de autorização (ADR 005) sempre inclui o caso "usuário do workspace A não
  enxerga dados do workspace B".

## Como aplicar neste repo

- O schema vive em `packages/db/src/schema.ts` — o comentário no arquivo já mostra o
  padrão (`workspaceId: uuid('workspace_id').notNull().references(() => workspace.id)`).
  O primeiro slot de fundação (ADR 007) substitui a tabela-exemplo pelas reais, já com
  `workspaceId` em todas.
- Tipos branded prontos em `packages/shared/src/index.ts` (`WorkspaceId`, `UserId`) —
  use-os nas signatures pra não misturar IDs.
- Guards de autorização moram em `apps/api/src/lib/guards.ts` (zona neutra); os
  services dos módulos (`apps/api/src/modules/<dominio>/`) sempre recebem e filtram
  por `workspaceId`.
- RLS: ativar nas policies do Supabase junto com o primeiro `db:push` de produção.
