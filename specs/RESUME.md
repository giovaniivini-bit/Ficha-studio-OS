# RESUME.md — snapshot do projeto

> Lido por todo worker no início. Mantenha curto e atual. O CTO/Integrador atualizam.

## Estado atual

- Milestone vigente: **M1** (em definição)
- Apps: `apps/web` (front), `apps/api` (back) — stubs até o M1 começar.
- Pacotes: `packages/shared` (tipos), `packages/core` (domínio).

## Regras invioláveis (resumo — detalhe em EMPRESA.md + PARALLEL-PROTOCOL.md)

- Trabalhe SÓ no território do seu slot. Não toque zona neutra (barrels, config raiz).
- Implemente a DESIGN-SPEC literalmente (nomes/schemas exatos). Sem DESIGN-SPEC → blocked.
- Smoke verde é gate pra `done`. Nunca desligue/pule teste.
- Replique o design fielmente (`docs/design/raw/`). BRIEF prevalece se divergir.

## Smoke

`pnpm -r typecheck` (configurável em `.ai-team.json`).
