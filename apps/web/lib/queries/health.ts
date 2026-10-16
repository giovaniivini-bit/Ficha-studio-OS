'use client';

// Camada de dados do domínio health — o exemplo canônico (ADR 006).
// 1 domínio = 1 arquivo de hooks React Query = 1 território de slot.
// Padrões obrigatórios:
//   - query-key factory (objeto <dominio>Keys) — nunca string solta
//   - resposta validada com o schema compartilhado (Zod na fronteira)
//   - telas consomem o hook; NUNCA chamam apiFetch direto

import { useQuery } from '@tanstack/react-query';
import { HealthDtoSchema, healthFixture, type HealthDto } from '@app/shared';
import { apiFetch } from '@/lib/api/client';
import { withFixture } from '@/lib/api/fixtures';

export const healthKeys = {
  all: ['health'] as const,
};

export function useHealth() {
  return useQuery<HealthDto>({
    queryKey: healthKeys.all,
    // withFixture (fissão): em dev com NEXT_PUBLIC_USE_FIXTURES=1, serve a fixture do
    // contrato se a API não subiu — o slot de dados/junção não espera o backend.
    queryFn: async () =>
      HealthDtoSchema.parse(await withFixture(apiFetch<HealthDto>('/api/health'), healthFixture)),
    refetchInterval: 10_000,
  });
}
