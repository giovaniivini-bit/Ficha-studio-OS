// Fetch base do frontend. ZONA NEUTRA — só o Integrador altera.
// REGRA (ADR 006): tela NUNCA chama fetch direto — sempre via hook de
// lib/queries/<dominio>.ts, que por sua vez usa apiFetch daqui.
// O envelope ApiResult<T> é o contrato compartilhado com o backend (@app/shared).

import type { ApiResult } from '@app/shared';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

interface ApiFetchInit extends Omit<RequestInit, 'headers' | 'body'> {
  headers?: Record<string, string>;
  body?: unknown;
}

export async function apiFetch<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const { body, headers, ...rest } = init;

  const res = await fetch(path, {
    ...rest,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  let parsed: ApiResult<T>;
  try {
    parsed = (await res.json()) as ApiResult<T>;
  } catch {
    throw new ApiError(`Resposta inválida da API (${res.status})`, 'invalid_response', res.status);
  }

  if (!parsed.ok) {
    throw new ApiError(parsed.error.message, parsed.error.code, res.status);
  }

  return parsed.data;
}
