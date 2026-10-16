// Rotas do módulo health — o módulo-exemplo canônico. Replique este padrão.

import type { FastifyPluginAsync } from 'fastify';
import { HealthDtoSchema } from '@app/shared';
import { ok } from '../../lib/http.ts';
import { getHealth } from './health.service.ts';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => {
    // Zod na fronteira (STACK-DEFAULT §4): output validado antes de sair
    return ok(HealthDtoSchema.parse(getHealth()));
  });
};
