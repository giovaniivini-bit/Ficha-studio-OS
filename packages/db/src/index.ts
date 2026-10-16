// Factory do banco. Barrel = ZONA NEUTRA (Integrador sincroniza).
// Consumidor: apenas services de apps/api/src/modules/*/ — web NUNCA importa db.

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export * from './schema.ts';

export type Db = ReturnType<typeof createDb>;

export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl);
  return drizzle(client);
}

// Singleton do banco — contrato estavel `@app/db` que os blocos copy-in consomem
// (auth/rls/crud/storage/audit importam { db } daqui em vez de um client proprio).
export const db = createDb(process.env.DATABASE_URL ?? '');
