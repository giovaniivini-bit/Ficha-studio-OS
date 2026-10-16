# 2. Como funciona

> Visão sem jargão de como o produto e o time se organizam. O CTO ajusta a parte de produto.

## As peças do produto

| Peça | O que é | Pasta |
|---|---|---|
| **Web** | A tela que o usuário usa (o app no navegador) | `apps/web` |
| **API** | O "cérebro" no servidor que guarda e serve os dados | `apps/api` |
| **Core** | As regras de negócio (domínio), reusáveis | `packages/core` |
| **Shared** | Tipos compartilhados entre web e API | `packages/shared` |

<O CTO descreve aqui, em 1 parágrafo, o fluxo principal do produto — ex.: "o usuário entra,
vê X, faz Y, e o sistema guarda Z".>

## Como o time de IA constrói (em paralelo, sem se atrapalhar)

- O trabalho é fatiado em **slots** (pedaços com território próprio — pastas que não se
  sobrepõem). Cada **Dev** trabalha num slot, numa **cópia isolada** do projeto (worktree).
- Como ninguém mexe no arquivo do outro, dá pra construir **vários slots ao mesmo tempo** sem
  conflito. No fim, o **Integrador** junta tudo (reconcile) e roda os testes.
- Antes de virar oficial, **você testa e aprova** (HTC).

## A regra que mantém a qualidade

1. **Planejar antes de construir** — milestone + slots escritos (`ROADMAP.md` + `specs/slots/`).
2. **Especificar antes de codar** — cada slot tem DESIGN-SPEC (nomes e formatos exatos).
3. **Testar é obrigatório** — nada vira "pronto" sem o smoke passar.
4. **Você aprova** — HTC antes de fechar o milestone.
5. **Aprender com cada erro** — todo problema corrigido vira aprendizado em [`LEARNINGS.md`](./LEARNINGS.md).

Os termos estão traduzidos em [`04-GLOSSARIO.md`](./04-GLOSSARIO.md).
