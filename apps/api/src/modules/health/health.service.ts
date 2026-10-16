// Service do módulo health — lógica e acesso a dados moram aqui (handler é fino).

import type { HealthDto } from '@app/shared';

const startedAt = Date.now();

export function getHealth(): HealthDto {
  return {
    status: 'ok',
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    version: process.env['npm_package_version'] ?? '0.0.0',
    timestamp: new Date().toISOString(),
  };
}
