// Validação Zod de TODAS as env vars na boot (STACK-DEFAULT §4 + segurança #1).
// ZONA NEUTRA — env var nova entra aqui via Integrador (declarada na DESIGN-SPEC do slot).
// Regra: nenhum módulo lê process.env direto — sempre importa `env` daqui.

import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),

  // Banco (vazio até o milestone que liga o Drizzle — ver packages/db)
  DATABASE_URL: z.string().default(''),

  // Provedores externos (sempre via adapter — ver packages/email como exemplo canônico)
  RESEND_API_KEY: z.string().default(''),
  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default('gemini-3.8-flash-medium'),
  EXTRACTION_PROVIDER: z.enum(['gemini', 'codex', 'anthropic']).default('gemini'),
  CODEX_CLI_PATH: z.string().default(''),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Explicit provider always wins. Local tests can use the authenticated CLI;
  // production never depends on a desktop session or silently falls back to it.
  const localCodex = (source.NODE_ENV ?? 'development') === 'development' && !source.GEMINI_API_KEY?.trim();
  const parsed = EnvSchema.safeParse({ ...source, EXTRACTION_PROVIDER: source.EXTRACTION_PROVIDER ?? (localCodex ? 'codex' : 'gemini') });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`);
  }
  return parsed.data;
}

export const env: Env = loadEnv();
