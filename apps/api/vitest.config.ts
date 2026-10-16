import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Lição (projeto-origem / LEARNINGS 1.19): neutralizar TODAS as credenciais de
    // provedor — teste NUNCA bate em serviço real. Adapter cai no modo 'dev'.
    // Toda env de provedor nova entra aqui zerada, no mesmo commit que entra no env.ts.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: '',
      RESEND_API_KEY: '',
      ANTHROPIC_API_KEY: '',
      GEMINI_API_KEY: '',
      OPENAI_API_KEY: '',
    },
  },
});
