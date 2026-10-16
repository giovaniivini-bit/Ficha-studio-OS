# DESIGN-SPEC — <slot-id>

> Escrito pelo ARQUITETO. O Dev implementa LITERALMENTE — nomes, schemas e assinaturas
> exatos. Ambiguidade aqui = retrabalho no reconcile (lição do projeto-origem: dois slots
> interpretaram "card de métrica" diferente porque a spec não fixou px/tokens).

## Nomes exatos

| Coisa | Nome |
|---|---|
| <arquivo/componente/função/rota/tabela> | `<nome exato>` |

## Schemas (Zod completo — NUNCA z.any())

```ts
// packages/shared/src/dto/<dominio>.ts (já criado pelo Arquiteto — slot só consome)
export const <Nome>Schema = z.object({ ... });
```

## Assinaturas

```ts
export function <nome>(<params tipados>): <retorno>;
```

## UI (se aplicável) — valores EXATOS

- Tokens: use `var(--token)` / classes do tema — NUNCA hex literal.
- Espaçamentos/tamanhos: <px/rem exatos, vindos do DESIGN-OVERVIEW>.
- Estados: loading / empty / error — todos especificados.

## Contratos da fundação que este slot consome

> Confira a assinatura REAL no arquivo antes de usar (lição os-v2: `useToast()` retorna
> a função direta — desestruturar `{ toast }` quebrava em runtime).

| Contrato | Path | Assinatura |
|---|---|---|
| <hook/componente/helper> | `<path>` | `<assinatura>` |

## Erros pré-existentes conhecidos (fora deste território)

<paths de erros de outros slots em paralelo, se houver — não são bloqueio deste slot>
