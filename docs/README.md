# Documentação do projeto

> **Bem-vindo.** Este diretório explica **o que é** o projeto e **como usar** — em
> português de gente, sem exigir que você programe. O que precisa ser **feito** vive em
> [`../specs/`](../specs/). O que já **aprendemos com erros** vive em [`LEARNINGS.md`](./LEARNINGS.md).

## Por onde começar

Leia nesta ordem. Cada arquivo é curto (≤5 minutos):

| # | Arquivo | Pra quê |
|---|---------|---------|
| 1 | [`01-INTRODUCAO.md`](./01-INTRODUCAO.md) | O que o produto faz e o que entrega. |
| 2 | [`02-COMO-FUNCIONA.md`](./02-COMO-FUNCIONA.md) | Como as peças se conectam (sem jargão). |
| 3 | [`03-COMO-USAR-O-CLAUDE.md`](./03-COMO-USAR-O-CLAUDE.md) | Como pedir ao Claude pra evoluir o projeto. |
| 4 | [`04-GLOSSARIO.md`](./04-GLOSSARIO.md) | Tradução dos termos técnicos. |
| 5 | [`05-TROUBLESHOOTING.md`](./05-TROUBLESHOOTING.md) | Quando algo dá errado. |

## Biblioteca viva (mantida pelo time de IA)

| Arquivo / pasta | O que é | Quem mantém |
|---|---|---|
| `SOLUTION-OVERVIEW.md` | Arquitetura de alto nível (viva) | CTO / Integrador |
| `ROADMAP.md` | Milestones + critérios de sucesso | CTO / Arquiteto |
| `LEARNINGS.md` | Aprendizados com cada erro (append-only) | todos |
| `ADRs/` | Decisões arquiteturais (1 por arquivo) | Arquiteto |
| `design/` | Design do OpenDesign (`raw/`) + `DESIGN-OVERVIEW.md` | Você entrega; time lê |
| `_references/` | Material externo (APIs, docs de terceiros) | Você importa |

## Pra fazer o projeto andar

1. Abra o **Claude Code** no terminal, na raiz do projeto.
2. Comandos do time: `/a360:iniciar` (montar), `/a360:vamos` (construir), `/a360:deploy` (publicar).
3. O time mostra o que mudou, você testa no **HTC** e aprova. Repete por milestone.

Travou? → [`05-TROUBLESHOOTING.md`](./05-TROUBLESHOOTING.md).
