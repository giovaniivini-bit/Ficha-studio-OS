// @app/shared — contrato front↔back. ZONA NEUTRA CONCEITUAL:
// quem alarga este package é o ARQUITETO (via DESIGN-SPEC) ou o Integrador —
// nunca um Dev por conta própria (lição do projeto-origem / LEARNINGS 1.14:
// "não alargue tipos de domínio dentro de um slot; tipo local de UI fica na tela").
//
// O que mora aqui:
//   - dto/<dominio>.ts      → schemas Zod + tipos dos payloads HTTP (1 arquivo por domínio)
//   - dto/api.ts            → envelope padrão ApiResult<T>
//   - fixtures/<dominio>.ts → dados canônicos tipados pelo DTO (wave 0 da fissão)
//   - primitivos de tipo (Brand, Result)

export * from './dto/api.ts';
export * from './dto/health.ts';
export * from './dto/ficha.ts';
export * from './fixtures/health.ts';

/** Branded IDs — evita misturar identificadores de entidades diferentes. */
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type WorkspaceId = Brand<string, 'WorkspaceId'>;
export type UserId = Brand<string, 'UserId'>;

/** Resultado padrão de operações internas que podem falhar sem exceção. */
export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
