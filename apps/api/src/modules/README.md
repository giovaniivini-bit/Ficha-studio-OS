# `modules/` — onde os slots de backend vivem

**1 domínio = 1 pasta = 1 território de slot.** Feature nova = pasta nova aqui dentro.
Nunca edite arquivo central (`app.ts`, `config/`, `plugins/`, `lib/` — zonas neutras).

## Anatomia de um módulo (replique o `health/`)

```
modules/<dominio>/
├── <dominio>.routes.ts    # rotas: valida input com Zod, chama o service, devolve ok(dto)
├── <dominio>.service.ts   # lógica + acesso a dados (única camada que toca o banco)
└── <dominio>.schema.ts    # schemas Zod internos do módulo (DTOs front↔back vivem em @app/shared)
```

## Regras

1. **Handler é fino.** Parse do input (Zod) → service → `ok(...)`. Lógica mora no service.
2. **Erro se LANÇA**, não se monta: `throw new NotFoundError(...)` (ver `lib/errors.ts`).
   O error-handler global converte pro envelope `ApiErr`.
3. **DTO que o frontend consome** é definido em `packages/shared/src/dto/<dominio>.ts`
   pelo Arquiteto (DESIGN-SPEC) — o módulo importa de `@app/shared`, nunca redeclara.
4. **Registro do módulo no `app.ts` é do INTEGRADOR** (zona neutra). Marque no
   ARTIFACTS.md do slot: "módulo pronto, falta registrar".
5. **Smoke obrigatório:** todo módulo tem teste em `apps/api/test/<dominio>.smoke.test.ts`
   cobrindo no mínimo: caminho feliz + autorização + validação (ADR 005).
