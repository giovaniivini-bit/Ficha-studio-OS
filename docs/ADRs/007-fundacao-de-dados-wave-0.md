# ADR 007 — Fundação de dados é wave 0 (merge + push antes dos consumidores)

**Status:** aceito (de fábrica — herdado do projeto-origem da metodologia)

## Contexto

Lição cara do projeto-origem: um milestone soltou slots de schema e de consumidores
ao mesmo tempo — resultado: **4 slots travados** com `relation "..." does not exist`
no smoke, porque as tabelas existiam no código do slot de fundação mas não no banco
(nem de dev, nem de test). Slot de dados não é "mais um slot paralelo": é
PRÉ-CONDIÇÃO física dos outros. A ordem precisa ser explícita e ferramentada, não
combinada de boca.

## Decisão

1. **Schema Drizzle (`packages/db/src/schema.ts` + `packages/db/drizzle/`) é slot de
   FUNDAÇÃO — wave 0** (PARALLEL-PROTOCOL, "Ordem de execução"): merge na main **+
   `db:push` aplicado em dev E test** ANTES de qualquer slot consumidor começar.
   - `pnpm --filter @app/db db:push` (banco de dev)
   - `pnpm --filter @app/db db:push:test` (banco de test — o smoke dos consumidores
     roda contra ele)
2. **`DEPENDS-ON.txt` expressa a dependência:** todo slot consumidor lista o slot de
   fundação. `ai-team plan`/`ai-team start` só liberam o consumidor quando a fundação
   está `done`.
3. **`packages/db/src/schema.ts` é zona neutra fora do slot de fundação:** nenhum
   outro slot toca o schema "só pra adicionar uma coluninha". Precisa de tabela/coluna
   nova? Volta pro Arquiteto → vira slot de fundação (ou item do slot de fundação
   existente do milestone).
4. **Evolução de DTO existente é compatível por padrão:** campo novo em DTO de
   `packages/shared/src/dto/` entra **OPCIONAL**, com **fallback no serializer** do
   service (caminho antigo continua funcionando). Zero regressão em tela viva —
   tornar o campo obrigatório é um passo posterior, depois que todos os consumidores
   migraram.

## Consequências

- "Relation does not exist" deixa de existir como classe de erro de paralelismo —
  se aparecer, é fundação não aplicada (receita no `05-TROUBLESHOOTING.md`).
- O milestone ganha uma fase serial curta (wave 0) em troca de paralelismo seguro nas
  waves seguintes. Na prática a fundação é o menor slot do milestone.
- DTOs evoluem sem quebrar telas em produção nem slots em voo.

## Como aplicar neste repo

- O schema-exemplo está em `packages/db/src/schema.ts` (com as regras comentadas no
  topo) — o primeiro slot de fundação substitui a tabela `exampleItem` pelas reais.
- Multi-tenant? `workspaceId` em toda tabela desde a migration 0000 (ADR 003).
- O Arquiteto: cria o slot de fundação como wave 0 do milestone, escreve os
  `DEPENDS-ON.txt` dos consumidores apontando pra ele, e define os DTOs novos em
  `packages/shared/src/dto/<dominio>.ts` na DESIGN-SPEC.
- O Integrador: após merge da fundação, roda os dois pushes (dev e test) ANTES de
  liberar os consumidores — e registra no `specs/RECONCILE-REPORT.md`.
