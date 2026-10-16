import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

// Raiz do monorepo (dois níveis acima de apps/web). Evita o Next inferir a raiz errada
// quando há lockfile solto em ~ (warning "multiple lockfiles"), o que baguncava o build trace.
const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url));

const nextConfig: NextConfig = {
  // Fixa a raiz do file-tracing no monorepo (não no home do usuário)
  outputFileTracingRoot: workspaceRoot,

  // Pacotes do workspace consumidos como fonte TS (sem build step)
  transpilePackages: ['@app/shared'],

  // Proxy do /api pro Fastify: mesma origem em dev (sem CORS no browser).
  // Em produção, o Caddy/reverse-proxy faz esse papel (ver templates/docker).
  async rewrites() {
    const apiUrl = process.env['API_URL'] ?? 'http://localhost:3001';
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
