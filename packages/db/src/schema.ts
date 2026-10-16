// Schema Drizzle — fonte da verdade do banco. ZONA NEUTRA CONCEITUAL:
// tabela nova entra via DESIGN-SPEC (Arquiteto define), num slot de FUNDAÇÃO (wave 0).
//
// REGRAS (lições do projeto-origem):
//   1. Slot de schema/migration é PRÉ-CONDIÇÃO dos consumidores: merge + push
//      (dev E test DB) ANTES dos slots de api/web começarem — senão o smoke
//      deles quebra com "relation does not exist" (LEARNINGS 1.19 / DEPENDS-ON).
//   2. Projeto MULTI-TENANT (decidido no kickoff): TODA tabela carrega
//      workspaceId NOT NULL + a tabela workspace existe desde a migration 0000.
//      Não existe "adapto depois" — é refactor enorme (STACK-DEFAULT §5).
//
// Aplique localmente: pnpm --filter @app/db db:push  (dev)
//                  e: pnpm --filter @app/db db:push:test  (test DB)

import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Tabela-exemplo do padrão. O primeiro slot de fundação a substitui pelas
 * tabelas reais do produto.
 */
export const exampleItem = pgTable('example_item', {
  id: uuid('id').primaryKey().defaultRandom(),
  // workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),  ← multi-tenant
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
