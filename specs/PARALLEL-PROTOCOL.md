# PARALLEL-PROTOCOL — desenvolvimento multi-agente em worktrees

Como vários Devs (Claudes) trabalham em paralelo sem merge hell. 5 regras de ouro.

## 1. Worktree por worker
Cada Dev trabalha numa cópia isolada do repo em `.worktrees/<worker>/`, na sua própria
branch (`worker/<milestone>/<slot>`). Criada pelo `ai-team start`. `node_modules` é
compartilhado via pnpm — instala uma vez na main (e `pnpm install` rápido na worktree).

## 2. Slot é a unidade de trabalho
`specs/slots/<milestone>/<slot-id>/` com:

| Arquivo | Quem escreve | O quê |
|---|---|---|
| `BRIEF.md` | Arquiteto | o quê + critérios de aceite |
| `DESIGN-SPEC.md` | Arquiteto | schemas Zod, signatures, nomes EXATOS + contratos da fundação (com paths) |
| `CONTRACT.md` | Arquiteto | I/O formal + comando de smoke |
| `TERRITORY.txt` | Arquiteto | globs dos arquivos que o slot PODE tocar (1 por linha) — pre-commit e reconcile validam |
| `DEPENDS-ON.txt` | Arquiteto | slots que precisam estar `done` antes (ex.: fundação). `ai-team plan/start` respeitam |
| `STATUS.txt` | Dev | `available → claimed:<w> → done:<w>` ou `blocked:<motivo>` |
| `ARTIFACTS.md` | Dev (no fim) | arquivos, smoke, pendências, **candidatos à fundação**, divergências |

Por milestone existe ainda `specs/slots/<milestone>/SHARED-CONTRACT.md` — contrato
comum entre os slots (nomes de rotas, tipos compartilhados, decisões transversais).

## 3. Zoning rígido (territórios não-sobrepostos)

A arquitetura do monorepo JÁ define a malha de territórios — slot novo encaixa numa
dessas células, nunca atravessa:

| Tipo de slot | Território (TERRITORY.txt) | Exemplo |
|---|---|---|
| Backend (1 domínio) | `apps/api/src/modules/<dominio>/**` + `apps/api/test/<dominio>*.ts` | módulo `clients/` |
| Front dados (fissão) | `apps/web/lib/queries/<dominio>.ts` | hooks de clients |
| Front UI (fissão) | `apps/web/app/<grupo>/<rota>/components/**` | componentes da tela |
| Front junção (fissão) | `apps/web/app/<grupo>/<rota>/page.tsx` + `<rota>-client.tsx` | liga hooks↔componentes |
| Frontend inteiro (sem fissão) | `apps/web/app/<grupo>/<rota>/**` + `apps/web/lib/queries/<dominio>.ts` | tela CRUD simples |
| Core (1 domínio) | `packages/core/src/<dominio>/**` | regras de scoring |
| Adapter (1 integração) | `packages/<dominio>/src/**` (exceto `index.ts`) | `packages/whatsapp` |
| Fundação de dados (wave 0) | `packages/db/src/**` + `packages/db/drizzle/**` | migration + tabelas |

**Fissão de feature (contract-first):** o Arquiteto escreve o contrato na wave 0 (DTO +
fixtures em `packages/shared` + ViewModel no SHARED-CONTRACT) e a feature vira 3 pistas
paralelas (api, web-data, web-ui) + 1 junção pequena (web-screen, DEPENDS-ON das duas).
Ver `decompose-goal` §2.5. Os 3 lados validam contra o MESMO schema Zod — drift quebra em
typecheck/smoke, não na integração.

**Zonas neutras** (só o Integrador toca — lista executável em `.ai-team.json → neutralZones`):
- composição: `apps/api/src/{index,app}.ts`, `config/`, `plugins/`, `lib/` da api
- frontend central: `app/layout.tsx`, `globals.css`, `components/ui/**`, `components/shell/**`,
  `lib/providers.tsx`, `lib/api/**`, `lib/queries/index.ts`
- contrato: `packages/shared/**` (DTOs — o Arquiteto define via DESIGN-SPEC),
  `packages/db/src/schema.ts` (fora do slot de fundação)
- barrels: `packages/*/src/index.ts`
- raiz: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`,
  `.ai-team.json`, `scripts/**`, `.githooks/**`

**Zona neutra CONCEITUAL** (lição do projeto-origem): tipos de domínio compartilhados são
zona neutra mesmo quando o glob não pega — Dev nunca alarga DTO/tipo compartilhado por
conta própria. Tipo que só a sua tela usa = tipo local no arquivo da tela.

**Regra de ouro:** se 2 slots poderiam editar o mesmo arquivo, o arquivo é zona neutra
(ou o zoning está errado — Arquiteto refaz a decomposição).

**Enforcement em 2 camadas:**
1. pre-commit (`.githooks/pre-commit` → `scripts/check-zoning.mjs`) bloqueia commit
   fora do TERRITORY/em zona neutra na branch do worker;
2. `ai-team reconcile` re-valida o diff de cada branch e grava o resultado no
   `specs/RECONCILE-REPORT.md` pro review estrutural.

## 4. Claim atômico
O worker escreve `STATUS.txt=claimed:<worker>` + `OWNER.txt` e commita na sua branch. Dois
workers no mesmo slot → o segundo pega conflito e escolhe outro. (O `ai-team start` faz isso.)

## 5. Done exige smoke verde — e smoke é TERRITORIAL
Antes de `done`: o smoke do CONTRACT passa. Typecheck global acusando erro de OUTRO slot
não bloqueia o seu: confirme que é pré-existente (`git stash && pnpm typecheck:all`),
documente no ARTIFACTS.md e siga. O reconciler (`ai-team reconcile`) faz merge `--no-ff`
na main, valida zoning, sincroniza barrels, roda o smoke CRUZADO (esse sim, global e
bloqueante), grava o RECONCILE-REPORT.md e limpa a worktree.

## Ordem de execução (waves)
Slots de FUNDAÇÃO (schema/migrations, DTOs novos em shared, adapter novo) são **wave 0**:
merge + aplicados (db push em dev E test) ANTES dos consumidores começarem. O Arquiteto
expressa isso no `DEPENDS-ON.txt` dos consumidores — `ai-team plan` só lista um slot como
pronto quando as dependências estão `done`.

## Papéis
- **Arquiteto** — escreve BRIEF + DESIGN-SPEC + TERRITORY + DEPENDS-ON dos slots (antes dos Devs).
- **Dev/Worker** — pega 1 slot, implementa, smoke territorial, done. Vários em paralelo.
- **Integrador/Reconciler** — merge + zoning + review + zonas neutras. Único a tocar a main.
