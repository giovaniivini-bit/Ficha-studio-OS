import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Smoke de UI (test-first dos slots de tela): roda em happy-dom (sem browser, ms por teste),
// na mesma infra Vitest do @app/api. NÃO depende do ambiente (gstack/playwright externos) —
// tudo é devDependency do projeto, então vai junto no scaffold.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    // Smoke de UI ao lado da rota (`<rota>.ui.test.tsx`); helpers em lib/ e test/.
    include: ['app/**/*.ui.test.tsx', 'lib/**/*.test.ts', 'test/**/*.test.{ts,tsx}'],
  },
});
