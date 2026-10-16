# ADR 008 — Porta não importa domínio (tradução é do consumidor)

**Status:** aceito (de fábrica — herdado do projeto-origem da metodologia)

## Contexto

Complemento do ADR 002. No projeto-origem surgiu a tentação natural: "a porta de
email podia receber direto o DTO `User` — economiza uma conversão". Parece inofensivo,
mas acopla o package de integração ao produto: qualquer evolução do DTO força mudança
na porta e em TODOS os adapters; o package deixa de ser reutilizável em outro projeto;
e a direção de dependência inverte (a infraestrutura passa a conhecer o domínio).
A conversão "economizada" custa caro.

## Decisão

1. **A porta de um package de integração (ex.: `packages/email/src/types.ts`) NUNCA
   importa `@app/shared` nem qualquer tipo de domínio do produto.** Ela fala apenas
   primitivos e tipos próprios do seu domínio técnico (`SendEmailInput`,
   `SendEmailResult`...).
2. **Quem traduz DTO ↔ porta é o módulo consumidor** — o service em
   `apps/api/src/modules/<dominio>/<dominio>.service.ts`. A tradução é mecânica e
   local:

   ```ts
   // no service consumidor — tradução DTO → porta (mecânica, ~3 linhas)
   await email.send({
     to: user.email,
     subject: `Bem-vindo, ${user.name}`,
     html: renderWelcome(user),
   });
   ```

3. **Direção de dependência fixa:** `apps/api` → `packages/email` (e demais
   integrações). Nunca o contrário. `packages/<integração>` só depende de si mesma
   (e do SDK do vendor, dentro do adapter).

## Consequências

- A porta fica **reutilizável fora do projeto**: `packages/email` funciona em
  qualquer repo, copiado como está.
- O DTO **evolui sem tocar a porta**: campo novo no `User` não encosta em
  `packages/email` nem nos adapters.
- O custo é a tradução explícita no consumidor — mecânica, barata e localizada. É o
  preço certo: a alternativa espalha o produto pela infraestrutura.
- Em paralelo (PARALLEL-PROTOCOL): o slot do adapter e o slot do consumidor nunca
  disputam arquivo — o adapter não conhece DTO, o consumidor não entra no package.

## Como aplicar neste repo

- **Exemplo canônico:** `packages/email/src/types.ts` — a regra está comentada no
  topo do arquivo ("a porta NUNCA importa @app/shared nem tipos de domínio do
  produto"). Toda porta nova (`packages/storage`, `packages/whatsapp`,
  `packages/llm`...) replica.
- No review estrutural, o Integrador checa: `grep -r "@app/shared" packages/<integração>/src/`
  deve voltar vazio (fora de testes, se houver).
- A tradução DTO↔porta mora no service do módulo consumidor — nunca num "helper
  compartilhado" que reacoplaria os dois lados.
