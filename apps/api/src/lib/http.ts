// Helpers do envelope HTTP padrão. ZONA NEUTRA.
// Todo endpoint responde ApiResult<T> (definido em @app/shared — front e back
// compartilham o contrato). Sucesso usa ok(); erro é responsabilidade do
// error-handler global (plugins/error-handler.ts) — handlers só lançam AppError.

import type { ApiOk } from '@app/shared';

export function ok<T>(data: T): ApiOk<T> {
  return { ok: true, data };
}
