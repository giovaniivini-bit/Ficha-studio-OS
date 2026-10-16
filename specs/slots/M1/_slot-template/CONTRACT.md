# CONTRACT — <slot-id>

## I/O

<entrada → saída do que este slot expõe (endpoint, componente, função)>

## Smoke (obrigatório antes de done)

```bash
<comando exato — ex.: pnpm --filter @app/api test && pnpm typecheck:all>
```

Lembrete: smoke é TERRITORIAL — erro de typecheck com path FORA do TERRITORY.txt deste
slot, confirmado pré-existente via `git stash`, não bloqueia (documentar no ARTIFACTS).

## Asserções

- [ ] <o que o smoke prova — ex.: rota responde 200 com HealthDto válido>
