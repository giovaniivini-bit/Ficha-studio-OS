// Smoke do módulo health — o teste-exemplo canônico (ADR 005).
// Todo módulo novo ganha um <dominio>.smoke.test.ts cobrindo:
//   caminho feliz + autorização (quando houver) + validação de input.

import { describe, expect, it } from 'vitest';
import { HealthDtoSchema } from '@app/shared';
import { buildApp } from '../src/app.ts';

describe('GET /api/health (smoke)', () => {
  it('responde 200 com envelope ok + payload válido pelo schema compartilhado', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; data: unknown };
    expect(body.ok).toBe(true);
    expect(() => HealthDtoSchema.parse(body.data)).not.toThrow();

    await app.close();
  });
});
