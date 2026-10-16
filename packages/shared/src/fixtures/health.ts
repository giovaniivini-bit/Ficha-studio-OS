// Fixtures do domínio health — o exemplo canônico da FISSÃO (decompose-goal §2.5).
// Fixtures são a "verdade de mentira" compartilhada da feature, escritas pelo ARQUITETO
// na wave 0, TIPADAS pelo DTO (drift com o schema quebra em typecheck):
//   - o slot web-ui renderiza elas pra validar visual sem API;
//   - o slot web-data as serve via fixture-fallback em dev (lib/api/fixtures.ts);
//   - o smoke do backend pode usá-las como caso de referência.
// 1 domínio = 1 arquivo. Satisfaça o type — o compilador é o guardião do contrato.

import type { HealthDto } from '../dto/health.ts';

export const healthFixture: HealthDto = {
  status: 'ok',
  uptimeSeconds: 1234,
  version: '0.0.0-fixture',
  timestamp: '2026-01-01T12:00:00.000Z',
};
