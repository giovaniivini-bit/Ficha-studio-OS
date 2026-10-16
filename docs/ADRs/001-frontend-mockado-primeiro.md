# ADR 001 — Frontend mockado primeiro (M1 inteiro com fixtures)

**Status:** aceito (de fábrica — herdado do projeto-origem da metodologia)

## Contexto

A tentação clássica é começar pelo "plumbing": banco, auth, deploy — e só então a UI.
No projeto-origem fizemos o contrário e funcionou: o M1 entregou o frontend INTEIRO
com dados mockados, antes de existir backend de verdade, auth ou banco. O fundador viu
o produto, criticou o produto, e o HTC do M1 validou UX e decisões de design quando
mudar ainda era barato. Quando o plumbing chegou (M2+), as telas não mudaram — só a
origem dos dados.

O risco que esse ADR elimina: decisão de design ser revertida por restrição de backend
("a API não devolve isso, então tira da tela"). Com o frontend primeiro, é o backend
que nasce servindo o que a tela já provou precisar.

## Decisão

1. **M1 entrega todas as telas do milestone com dados mockados (fixtures).** Nada de
   backend real, auth ou banco no caminho crítico do M1.
2. **O mock vive em `apps/web`** — em `mock/` ou como fixtures por tela (ex.:
   `apps/web/app/<rota>/mock.ts`), tipados pelos DTOs de `packages/shared/src/dto/`.
   O contrato já é o real; só a origem é fake.
3. **A decomposição da tela é a definitiva desde o M1** (ADR 006):
   `page.tsx` (server, thin) → `<rota>-client.tsx` → `components/` locais. O mock entra
   no client/hook, nunca espalhado pelos componentes presentacionais.
4. **M2+ troca mock por React Query sem reescrever telas:** o hook em
   `apps/web/lib/queries/<dominio>.ts` passa a chamar `apiFetch` (ver
   `apps/web/lib/queries/health.ts` como exemplo canônico) e os componentes nem
   percebem — recebem o mesmo DTO por props.

## Consequências

- HTC do M1 valida produto/UX cedo, com custo de mudança mínimo.
- Backend nasce contra um contrato já validado em tela (DTOs em `@app/shared`).
- Slots de frontend do M1 rodam 100% em paralelo, sem dependência de fundação de dados.
- Custo: disciplina pra tipar o mock com o DTO real (senão a troca em M2 vira refactor).
- Armadilha conhecida: ao trocar mock por dado real, remover o import do mock NA MESMA
  edição (receita no `05-TROUBLESHOOTING.md`) — import morto quebra typecheck/lint.

## Como aplicar neste repo

- Telas seguem o exemplo vivo: `apps/web/app/page.tsx` → `apps/web/app/home-client.tsx`
  → `apps/web/app/components/health-card.tsx`.
- No M1, o Arquiteto define os DTOs em `packages/shared/src/dto/<dominio>.ts`
  (DESIGN-SPEC) e o Dev cria fixtures tipadas com eles dentro do seu território
  (`apps/web/app/<grupo>/<rota>/**`).
- Na virada (M2+), o slot troca a fixture pelo hook React Query em
  `apps/web/lib/queries/<dominio>.ts` — mesma assinatura de dados, telas intactas.
