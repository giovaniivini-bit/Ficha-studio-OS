# 5. Troubleshooting

> Quando algo dá errado, comece aqui. E todo problema novo que resolvermos vira uma entrada
> em [`LEARNINGS.md`](./LEARNINGS.md) (e, se for recorrente, uma receita aqui).

## Receita geral

1. **Não entre em pânico.** O Claude reverte quase tudo.
2. **Cole o erro inteiro pro Claude** (não resuma — ele precisa do texto).
3. Frase: *"Antes de consertar, diagnostique a causa raiz e me mostre."*
4. Se Claude propuser algo agressivo (apagar arquivo, `git reset`), diga *"vamos discutir antes"*.
5. Resolveu? **Registre em `docs/LEARNINGS.md`.**

## Problemas comuns (já vividos)

### Porta ocupada (`EADDRINUSE`)
A API (3001) ou o web (3000) não sobem porque a porta já está em uso por outro serviço.
**Solução:** libere a porta — `kill $(lsof -ti tcp:3001)` — ou rode em outra porta
(`API_PORT=4001 pnpm --filter @app/api start`, e o web com `API_URL=http://localhost:4001`).

### Worktree não roda o smoke (`tsc: command not found`)
Cada worktree é uma pasta separada e **não herda o `node_modules`**.
**Solução:** dentro da worktree, rode `pnpm install` antes do smoke (é rápido — usa o cache).

### `pnpm install` falha
```
rm -rf node_modules pnpm-lock.yaml && pnpm install
```
Persistiu? Peça: *"confira se Node ≥20 e pnpm ≥9 batem com o projeto."*

### `pnpm -r typecheck` falha
Cole o erro completo. Causa comum: contrato entre pacotes quebrou (um slot mudou um
nome/formato que outro espera). Frase: *"esse erro veio depois do slot <X>; reverta e explique."*
(Dica: com `exactOptionalPropertyTypes`, campos opcionais que aceitam `undefined` precisam
ser tipados como `T | undefined`.)

### `next start` não acha as rotas `/api/*` (404)
O `next start` **não honra os rewrites** com `output: standalone`.
**Solução:** em dev use `pnpm dev` (`next dev`); em produção o Docker usa `node server.js`
(standalone). Não use `next start`.

### Reconcile quebra: "untracked working tree files would be overwritten"
Os slots não foram **commitados na main** antes do reconcile.
**Solução:** `git add specs/slots && git commit -m "chore(specs): slots"` antes de reconciliar.

### `/a360:vamos` reclama que o design está vazio
Coloque o export do OpenDesign em `docs/design/raw/` (PNG/PDF/HTML) e rode de novo.

### Login não entra / cartões não carregam
- A API está no ar? `curl -fsS http://localhost:3001/health` deve responder `{"ok":true}`.
- O web aponta pra API certa? (`API_URL` no `next.config`/ambiente.)
- Cookie de sessão: use o mesmo host (o proxy `/api/*` do Next resolve isso).

## Receitas TS/React (lições do projeto-origem)

> Erros que o time já pagou pra aprender em 6 milestones. Sintoma → causa → correção.

### Error subclass com `cause` quebra com `noImplicitOverride`
**Sintoma:** `This member must have an 'override' modifier...` ao declarar `cause` numa
subclasse de `Error`.
**Causa:** `cause` é membro nativo de `Error` (ES2022); redeclarar sem `override` viola
`noImplicitOverride`.
**Correção:** passe direto pro construtor nativo — `super(message, { cause })` — em vez
de declarar o campo. Se PRECISAR declarar, use `override readonly cause`. Exemplo vivo:
`apps/api/src/lib/errors.ts` (AppError).

### React 19: tipo de `useRef(null)` mudou
**Sintoma:** `Type 'RefObject<HTMLDivElement | null>' is not assignable to type 'RefObject<HTMLDivElement>'`.
**Causa:** no React 19, `useRef<T>(null)` retorna `RefObject<T | null>` — não mais
`RefObject<T>`.
**Correção:** props que recebem refs devem tipar `RefObject<T | null>`. Não force cast.

### Rota nova "some" ou colide (App Router)
**Sintoma:** 404 inexplicável, ou duas telas disputando a mesma URL.
**Causa:** grupos de rota `(grupo)` são transparentes na URL — `app/(a)/x/page.tsx` e
`app/(b)/x/page.tsx` colidem **silenciosamente** em `/x`.
**Correção:** antes de criar rota, confira `ls apps/web/app/**/` e o
`specs/slots/<milestone>/SHARED-CONTRACT.md` (onde o Arquiteto registra o mapa de rotas
do milestone).

### Primeiro uso de um grupo de rota novo
**Sintoma:** comportamento estranho de layout/estilo na primeira rota de um grupo `(grupo)`.
**Causa:** grupo sem layout próprio herda implicitamente — e o primeiro slot a usar o
grupo acaba "dono" acidental da estrutura.
**Correção:** ao criar um grupo de rota novo, o PRIMEIRO arquivo é um
`apps/web/app/(grupo)/layout.tsx` stub (mesmo que só `return children`). Depois vêm as rotas.

### Smoke check com `$`/regex em `node -e` passa/falha errado
**Sintoma:** check de presença de string num arquivo via `node -e "..."` com `$` ou regex
dá resultado errado.
**Causa:** o shell come o escape (`$`, barras) antes do Node ver a string.
**Correção:** pra presença literal, use `src.includes('...')` em vez de regex. Regex só
quando precisa de padrão — e aí prefira script em arquivo, não inline no shell.

### Typecheck global acusa erro que não é seu
**Sintoma:** `pnpm typecheck:all` vermelho em arquivo de OUTRO slot/território.
**Causa:** erro pré-existente na branch base, não o seu diff.
**Correção:** protocolo territorial — `git stash && pnpm typecheck:all`; se o erro
persiste sem o seu diff, é pré-existente: `git stash pop`, documente no `ARTIFACTS.md`
do slot e siga. Não bloqueia o seu `done` (só o smoke cruzado do reconcile é global).

### Worktree sem node_modules
**Sintoma:** `tsc: command not found`, `vitest: command not found` dentro da worktree.
**Causa:** worktree é pasta separada — não herda o `node_modules` da main.
**Correção:** `pnpm install` dentro da worktree (rápido — usa o store compartilhado do pnpm).

### Teste batendo em serviço real
**Sintoma:** teste lento, flaky, ou pior — efeito colateral real (email enviado, arquivo
subido em storage de verdade).
**Causa:** credencial de provedor vazou pro ambiente de teste; o factory criou o adapter
real em vez do dev.
**Correção:** confira `apps/api/vitest.config.ts` — TODA env de provedor deve estar
neutralizada (`''`) ali; o adapter deve cair no modo dev (ver `packages/email/src/index.ts`).
Provedor novo = env zerada no vitest.config.ts no MESMO commit que entra no `env.ts`.

### Smoke de consumidor falha com "relation does not exist"
**Sintoma:** smoke de um módulo quebra com `relation "<tabela>" does not exist`.
**Causa:** o slot de fundação (schema) foi mergeado mas o push não foi aplicado no banco
— ou os consumidores começaram antes da wave 0 (ADR 007).
**Correção:** `pnpm --filter @app/db db:push` (dev) **e** `pnpm --filter @app/db db:push:test`
(test). Confira que o `DEPENDS-ON.txt` do slot consumidor aponta pro slot de fundação.

### Import morto ao trocar mock por dado real
**Sintoma:** typecheck/lint quebra com import não usado depois de ligar a tela na API.
**Causa:** trocou a fixture pelo hook React Query mas deixou o `import` do mock pra trás.
**Correção:** remover o import NA MESMA edição que remove o uso — nunca "depois eu limpo".
Vale como regra geral da troca mock→real (ADR 001).

## Quando nada acima resolve

Frase pro Claude:
```
Estou travado: <descreva>. Cole abaixo o que tentei.
Investigue a causa raiz, proponha 2 caminhos, e espere meu OK.
Depois de resolver, registre em docs/LEARNINGS.md.
```
