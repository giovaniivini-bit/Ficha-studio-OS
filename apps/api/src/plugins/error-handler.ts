// Error handler global. ZONA NEUTRA.
// Converte AppError/ZodError no envelope ApiErr padrão; o resto vira 500 logado.

import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import type { ApiErr } from '@app/shared';
import { AppError } from '../lib/errors.ts';

export function errorHandler(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof AppError) {
    const body: ApiErr = { ok: false, error: { code: error.code, message: error.message } };
    void reply.status(error.statusCode).send(body);
    return;
  }

  if (error instanceof ZodError) {
    const message = error.issues
      .map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`)
      .join('; ');
    const body: ApiErr = { ok: false, error: { code: 'validation_error', message } };
    void reply.status(400).send(body);
    return;
  }

  request.log.error(error);
  const body: ApiErr = { ok: false, error: { code: 'internal_error', message: 'Erro interno' } };
  void reply.status(500).send(body);
}
