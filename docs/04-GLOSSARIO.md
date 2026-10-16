# 4. Glossário

> Tradução dos termos técnicos pro que importa pra **você**.

## Como o time trabalha

| Termo | O que é |
|-------|---------|
| **Milestone** | Uma entrega fechada e testável (ex.: "login + quadro funcionando"). O time constrói por milestones, não tudo de uma vez. |
| **Slot** | Um pedaço de trabalho com **território próprio** (pastas que não se sobrepõem a outro slot). É a unidade que um Dev pega. Vive em `specs/slots/<milestone>/<slot>/`. |
| **Território** | As pastas/arquivos que um slot pode editar. Dois slots nunca compartilham território — é o que evita conflito. |
| **Zona neutra** | Arquivos compartilhados (config raiz, re-exports) que **só o Integrador** toca. |
| **Worktree** | Uma **cópia isolada** do projeto onde um Dev trabalha sem atrapalhar os outros. Some quando o trabalho é integrado. |
| **Reconcile** | Quando o Integrador **junta** os slots prontos no projeto principal, roda os testes e limpa as worktrees. |
| **HTC** (Human Test Checkpoint) | O portão onde **você testa e aprova** antes do milestone fechar. Review do time ✅ ≠ entregue; só você fecha. |
| **Smoke** | Teste rápido que prova que nada quebrou (aqui, `pnpm -r typecheck` + build). Obrigatório pra marcar algo "pronto". |

## Os 4 papéis (time de IA)

| Papel | Faz |
|-------|-----|
| **CTO** | Fala com você. Dita a stack. Define os milestones. Não toca código. |
| **Arquiteto** | Escreve a **DESIGN-SPEC** de cada slot (nomes/formatos exatos). Decide o "como". |
| **Dev** | Pega um slot e implementa, na sua worktree. Vários em paralelo. |
| **Integrador** | Junta tudo (reconcile), revisa, e leva pro seu HTC. Único a tocar o principal. |

## Os documentos do slot

| Termo | O que é |
|-------|---------|
| **BRIEF** | O quê fazer + critérios + território permitido. |
| **DESIGN-SPEC** | O como: nomes de função, formatos de dado (schemas), exatos. O Dev segue à risca. |
| **CONTRACT** | O que o slot entrega + o comando de smoke que prova. |
| **ARTIFACTS** | O que o Dev escreve no fim: arquivos tocados, resultado do smoke, pendências. |
| **STATUS** | `available` → `claimed` → `done` (ou `blocked`). |

## A biblioteca do projeto (`docs/`)

| Termo | O que é |
|-------|---------|
| **EMPRESA.md** | As regras não-negociáveis do projeto (invariantes). Todo agente lê antes de trabalhar. |
| **ROADMAP.md** | Os milestones + critérios de sucesso. |
| **SOLUTION-OVERVIEW.md** | A arquitetura de alto nível (viva). |
| **LEARNINGS.md** | O que aprendemos com cada erro, pra não repetir. |
| **ADR** | Registro de uma decisão arquitetural (por que escolhemos X e não Y). |
| **DESIGN-OVERVIEW** | Resumo das telas/cores extraído do seu design do OpenDesign. |

## Stack (as ferramentas)

| Termo | O que é |
|-------|---------|
| **Monorepo** | Vários pacotes no mesmo repositório (`apps/` executáveis, `packages/` bibliotecas). |
| **pnpm** | O gerenciador de pacotes (instala dependências, conecta o monorepo). |
| **TypeScript** | A linguagem (JavaScript com tipos = menos bug). |
| **Next.js** | O framework do front (`apps/web`). **Fastify** | o do back (`apps/api`). |
| **Zod** | Valida os dados nas fronteiras (entra dado torto → barra antes de quebrar). |
| **Store / Adapter** | "Caixa" trocável de dados/serviço externo. Começa em memória, vira Supabase sem mudar o resto. |
