// Envelope HTTP padrão — TODO endpoint responde ApiResult<T>.
// Backend monta via apps/api/src/lib/http.ts; frontend desembrulha via
// apps/web/lib/api/client.ts. Os dois lados importam DAQUI — contrato único.

export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiErr {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResult<T> = ApiOk<T> | ApiErr;
