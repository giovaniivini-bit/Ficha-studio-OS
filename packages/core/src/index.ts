// @app/core — lógica de domínio PURA (zero framework, zero HTTP, zero React).
// Barrel = ZONA NEUTRA: sincronizado pelo Integrador no reconcile.
//
// Organização: 1 domínio = 1 pasta = 1 território de slot.
//   src/<dominio>/...   ← Dev trabalha aqui dentro
//   src/index.ts        ← Integrador re-exporta
//
// Padrões do STACK-DEFAULT que se materializam neste package:
//   - stores como interface (src/<entidade>/stores/{memory,supabase}.ts + factory)
//   - tools registry pra agentes de IA (src/tools/{library/,registry.ts,types.ts})
//   - Zod nas fronteiras de cada função pública

export const CORE_VERSION = '0.1.0' as const;
