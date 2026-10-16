// Composição do app Fastify. ZONA NEUTRA — registrar módulo novo aqui é
// trabalho do INTEGRADOR (no reconcile), nunca do Dev de um slot.
//
// Arquitetura (ADR 004): backend modular por domínio.
//   1 feature nova = 1 pasta nova em src/modules/<dominio>/ — nunca editar arquivo central.
//   Slot de backend = território `apps/api/src/modules/<dominio>/**`.

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env.ts';
import { errorHandler } from './plugins/error-handler.ts';
import { healthRoutes } from './modules/health/health.routes.ts';
import { fichaRoutes } from './modules/fichas/ficha.routes.ts';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
    bodyLimit: 16 * 1024 * 1024,
  });

  await app.register(cors, {
    // CORS whitelist explícita (STACK-DEFAULT segurança #11) — nunca '*' em prod
    origin: [env.WEB_ORIGIN],
    credentials: true,
  });

  // Rate limit baseline (STACK-DEFAULT segurança #9): 100 req/min/IP.
  // Rotas sensíveis (login/signup) DEVEM apertar isso por rota via `config.rateLimit`
  // no register do módulo (ex.: { max: 10, timeWindow: '1 minute' }).
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  app.setErrorHandler(errorHandler);

  // ── Módulos (1 register por domínio; Integrador adiciona no reconcile) ──
  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(fichaRoutes, { prefix: '/api' });

  return app;
}
