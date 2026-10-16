// Schemas Zod INTERNOS do módulo health.
// O DTO público (HealthDto) vive em @app/shared — front e back validam o mesmo contrato.
// Este arquivo existe pra mostrar onde schemas de input (body/query/params) moram.

import { z } from 'zod';

/** Exemplo de schema de query — health não recebe input, mas o padrão é este. */
export const HealthQuerySchema = z.object({}).strict();

export type HealthQuery = z.infer<typeof HealthQuerySchema>;
