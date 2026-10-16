# ADR 002 — Adapter pattern obrigatório pra integração externa

**Status:** aceito (de fábrica — herdado do projeto-origem da metodologia)

## Contexto

Integração externa acoplada direto no código consumidor é o jeito mais rápido de criar
código lixo: o SDK do vendor vaza pra todo lado, trocar de vendor vira refactor, e —
pior, vivido no projeto-origem — teste acaba batendo em serviço real (LEARNINGS 1.19:
um teste subiu arquivo num S3 de verdade). O STACK-DEFAULT §1 já define o padrão; este
ADR o torna lei do repo.

## Decisão

Toda integração externa com **mais de 1 vendor possível** (email, storage, whatsapp,
payment, LLM, calendar...) entra via **porta + adapters + factory**:

```
packages/<dominio>/src/
├── types.ts              # a PORTA: interface <Dominio>Provider (agnóstica — ver ADR 008)
├── adapters/
│   ├── dev.ts            # adapter dev: NÃO bate em serviço nenhum (console/memória)
│   └── <vendor>.ts       # implementação real; vendor 100% encapsulado aqui
└── index.ts              # factory create<Dominio>(opts) — o ÚNICO import do app
```

Regras:

1. **Consumidor nunca importa SDK/API de vendor.** Só a porta, via factory.
2. **Adapter `dev` SEMPRE existe.** Sem credencial configurada, o factory cai nele.
3. **Teste nunca bate em serviço real:** `apps/api/vitest.config.ts` neutraliza TODAS
   as credenciais de provedor (`RESEND_API_KEY: ''` etc.) → factory cai no dev. Toda
   env de provedor nova entra zerada lá, no mesmo commit que entra no `env.ts`.
4. Vendor novo = 1 arquivo de adapter + 1 case no factory. Nada mais muda.

**NÃO fazer adapter pra:** logger (pino direto), ORM (Drizzle direto — o schema mudaria
junto com a troca), framework (Fastify/Next direto), nada que você não vai trocar de
verdade. Adapter sem segundo vendor plausível é cerimônia, não arquitetura.

## Consequências

- Trocar Resend→SendGrid (ou Anthropic→OpenAI) é 1 arquivo novo, zero mudança no app.
- Dev local e CI rodam sem nenhuma credencial — o adapter dev cobre tudo.
- Smoke fica determinístico e barato (sem rede, sem flakiness, sem custo).
- Slot de adapter tem território natural: `packages/<dominio>/src/**` (exceto o barrel
  `index.ts`, zona neutra) — encaixa direto no zoning do PARALLEL-PROTOCOL.

## Como aplicar neste repo

- **Exemplo canônico vivo:** `packages/email/` — porta em `src/types.ts`, adapters em
  `src/adapters/dev.ts` e `src/adapters/resend.ts`, factory em `src/index.ts`
  (`createEmail({ resendApiKey })`: com chave → Resend; sem → dev).
- Integração nova: copie a estrutura de `packages/email/`, registre o package no
  `pnpm-workspace.yaml` (Integrador — zona neutra) e adicione a env zerada em
  `apps/api/vitest.config.ts`.
- A porta nunca importa tipos do produto — ver ADR 008.
