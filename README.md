# Ficha Studio

Transforma imagens de fichas de vestuário em documentos técnicos padronizados, com imagem grande e campos revisáveis. Consulte [COMO-USAR.md](COMO-USAR.md) para iniciar, configurar IA e salvar suas fichas.

Esta implementação usa agentes nativos do Codex em territórios separados. Os comandos do motor original abaixo são referência do template Claude, não a forma usada neste desenvolvimento. Os dados salvos pelo app ficam no navegador, não nesta pasta, e podem ser exportados em backup JSON.

## Rodar local

```bash
corepack enable
pnpm install
pnpm dev            # sobe api + web
pnpm -r typecheck   # checagem de tipos (o "smoke" do time)
```

## Desenvolvimento multi-agente

Este projeto é construído por um time de IA (CTO, Arquiteto, Dev, Integrador) que
trabalha em **git worktrees paralelas**. O motor é o `ai-team` CLI:

```bash
pnpm ai-team run --milestone=M1 --workers=4            # modo autônomo: constrói sozinho
pnpm ai-team plan --milestone=M1                       # slots prontos (waves)
pnpm ai-team start --slot=<id> --worker=<nome>         # despacho manual (demo)
pnpm ai-team status                                     # dashboard
pnpm ai-team reconcile                                  # integra os slots done
```

Comandos do Claude Code (plugin `a360`):

- `/a360:iniciar` — kickoff + scaffold (já rodou).
- `/a360:vamos` — lê o design system e constrói.
- `/a360:deploy` — coloca no ar (Docker + VPS).

## Estrutura

```
apps/        web (front) + api (back)
packages/    shared (tipos) + core (lógica/domínio)
tools/       ai-team (motor multi-agente)
specs/       RESUME.md + PARALLEL-PROTOCOL.md + slots/
docs/        design/ (system design do OpenDesign) + ADRs/ + _references/
EMPRESA.md   invariantes não-negociáveis do projeto
```

## Design system

Coloque o export do **OpenDesign** em `docs/design/raw/` e rode `/a360:vamos`.
