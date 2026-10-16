// Entrypoint do backend. ZONA NEUTRA — só o Integrador altera.
// Toda a composição do app vive em app.ts; aqui só sobe o servidor.

import { buildApp } from './app.ts';
import { env } from './config/env.ts';

const app = await buildApp();

await app.listen({ port: env.API_PORT, host: '127.0.0.1' });
app.log.info(`api no ar em http://localhost:${env.API_PORT} (health: /api/health)`);
