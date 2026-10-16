// DTO do domínio health — o exemplo canônico de contrato front↔back.
// Padrão (STACK-DEFAULT §4): schema Zod é a fonte; o tipo DERIVA via z.infer.
// Backend valida o output com ele; frontend valida a resposta com ele.
//
// Evolução de DTO existente (lição os-v2 / LEARNINGS 1.20): campo novo entra
// OPCIONAL + serializer com fallback pro caminho antigo — zero quebra de tela viva.

import { z } from 'zod';

export const HealthDtoSchema = z.object({
  status: z.literal('ok'),
  uptimeSeconds: z.number().int().nonnegative(),
  version: z.string(),
  timestamp: z.string(),
});

export type HealthDto = z.infer<typeof HealthDtoSchema>;
