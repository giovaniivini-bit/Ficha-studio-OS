# ADR 004 — Backend modular por domínio

**Status:** aceito (de fábrica — herdado do projeto-origem da metodologia)

## Contexto

Com vários Devs em paralelo, a estrutura do backend É o mapa de territórios. No
projeto-origem, backend modular por domínio foi o que permitiu 3+ slots de API
simultâneos sem um único conflito de merge: cada feature era uma pasta nova, e os
arquivos centrais (composição) ficavam fora do alcance dos Devs. Quando feature nova
exige editar arquivo central, dois slots colidem — e o zoning quebra.

## Decisão

1. **1 domínio = 1 pasta** em `apps/api/src/modules/<dominio>/` com três arquivos:
   - `<dominio>.routes.ts` — rotas: parse do input (Zod) → service → `ok(dto)`
   - `<dominio>.service.ts` — lógica + acesso a dados (única camada que toca o banco)
   - `<dominio>.schema.ts` — schemas Zod internos do módulo (DTOs front↔back moram
     em `packages/shared/src/dto/<dominio>.ts`, definidos pelo Arquiteto)
2. **Feature nova = pasta nova. NUNCA editar arquivo central.** A composição —
   `apps/api/src/app.ts`, `apps/api/src/index.ts`, `config/`, `plugins/`, `lib/` —
   é **zona neutra do Integrador**: o `register` do módulo novo no `app.ts` acontece
   no reconcile, não no slot (Dev marca no ARTIFACTS.md: "módulo pronto, falta
   registrar").
3. **Handler fino:** parse Zod → chamada de service → `ok(...)`
   (`apps/api/src/lib/http.ts`). Lógica no handler é smell — mora no service.
4. **Erro se LANÇA, não se monta:** `throw new NotFoundError(...)` etc.
   (`apps/api/src/lib/errors.ts`). O error-handler global
   (`apps/api/src/plugins/error-handler.ts`) converte pro envelope `ApiErr`
   (`packages/shared/src/dto/api.ts`). Handler nunca monta resposta de erro à mão.

## Consequências

- Slot de backend tem território limpo: `apps/api/src/modules/<dominio>/**` +
  `apps/api/test/<dominio>*.ts` — zero interseção com outros slots.
- Toda rota responde o mesmo envelope `ApiResult<T>` — o frontend desembrulha num
  lugar só (`apps/web/lib/api/client.ts`).
- O custo: o módulo só "liga" no reconcile (registro no `app.ts` é do Integrador).
  O smoke do módulo testa via `buildApp()` — que só funciona pós-registro — então o
  smoke territorial do Dev pode usar o plugin do módulo direto se necessário.

## Como aplicar neste repo

- **Módulo-exemplo canônico:** `apps/api/src/modules/health/` — replique a anatomia
  (`health.routes.ts`, `health.service.ts`, `health.schema.ts`).
- Guia operacional pros Devs: `apps/api/src/modules/README.md`.
- Smoke obrigatório por módulo em `apps/api/test/<dominio>.smoke.test.ts`
  (exemplo: `apps/api/test/health.smoke.test.ts`) — ver ADR 005.
- Zonas neutras executáveis listadas em `.ai-team.json → neutralZones`; o pre-commit
  (`scripts/check-zoning.mjs`) bloqueia commit fora do território.
