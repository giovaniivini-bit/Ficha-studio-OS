# ADR 005 — Smoke obrigatório e test-first (gate de merge, escrito antes da implementação)

**Status:** aceito (de fábrica — herdado do projeto-origem da metodologia)

## Contexto

Nos 6 milestones do projeto-origem, o que impediu código quebrado de virar mainline
não foi review de olho — foi smoke como GATE. Slot marcado `done` sem smoke verde foi
o antipadrão mais caro: o problema só aparecia no reconcile, com o contexto do Dev já
perdido, e o slot voltava `blocked`. Também aprendemos da pior forma que teste sem
credencial neutralizada bate em serviço real (LEARNINGS 1.19: upload num S3 de
verdade durante o teste).

## Decisão

1. **Todo módulo/rota nasce com teste smoke** em `apps/api/test/<dominio>.smoke.test.ts`,
   cobrindo no mínimo:
   - **caminho feliz** (200 + envelope `ok: true` + payload válido pelo schema de
     `@app/shared`);
   - **autorização** (sem sessão → 401; workspace errado → 403/404 — ver ADR 003);
   - **validação** (input inválido → 400 com `ApiErr`);
   - **erro/edge** (os casos de borda que a DESIGN-SPEC implica: null / vazio / limite /
     duplicado → o erro esperado de `lib/errors.ts`). É a rede que pega o bug lógico que
     os gates estruturais (anti-duplicação, fronteira de módulo, ...) não enxergam.
2. **Test-first: o smoke é escrito ANTES da implementação.** O Dev escreve o smoke a
   partir do CONTRACT, roda e vê falhar (RED) porque o código ainda não existe, e só então
   implementa até ficar verde (GREEN). Smoke verde é GATE de merge: sem ele não existe
   `done`. Não é etapa opcional, não é "depois eu escrevo" — escrever depois reduz o smoke
   a um carimbo do que o código já faz, inclusive dos seus bugs.
3. **O smoke do Dev é TERRITORIAL** (PARALLEL-PROTOCOL §5): erro de typecheck/teste
   vindo de OUTRO slot não bloqueia o seu. Protocolo: `git stash && pnpm typecheck:all`
   → erro persiste sem o seu diff? É pré-existente → `git stash pop`, documenta no
   ARTIFACTS.md e segue.
4. **O smoke cruzado do reconcile é GLOBAL e BLOQUEANTE:** o Integrador roda a suíte
   inteira na main pós-merge; qualquer vermelho trava o reconcile.
5. **`apps/api/vitest.config.ts` neutraliza TODAS as credenciais de provedor**
   (`DATABASE_URL`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, ...).
   Teste NUNCA bate em serviço real — os adapters caem no modo dev (ADR 002). Env de
   provedor nova entra zerada lá no mesmo commit em que entra no
   `apps/api/src/config/env.ts`.

## Consequências

- Nada quebrado vira mainline: o pior caso é um slot atrasar, nunca a main regredir.
- Smoke territorial mantém o paralelismo: um slot quebrado não congela os outros.
- Teste roda sem rede, sem credencial e sem custo — em qualquer worktree e no CI.
- Custo honesto: escrever ~4 casos por módulo, ANTES do código. É barato perto de um
  reconcile reaberto — e o caso de erro/edge é justamente o que pega bug lógico.

## Como aplicar neste repo

- **Teste-exemplo canônico:** `apps/api/test/health.smoke.test.ts` (usa `buildApp()` +
  `app.inject`, valida envelope e schema compartilhado). Replique.
- Comando territorial típico: `pnpm --filter @app/api test` dentro da worktree
  (lembre do `pnpm install` na worktree — ver `05-TROUBLESHOOTING.md`).
- O Arquiteto escreve o comando de smoke no `CONTRACT.md` do slot; o Integrador roda
  o cruzado no `ai-team reconcile` e grava o resultado no `specs/RECONCILE-REPORT.md`.
