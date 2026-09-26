import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@/db/schema';
import { getDatabaseUrl } from './runtime';

const globalDatabase = globalThis as typeof globalThis & { jiuhengSql?: ReturnType<typeof postgres> };

export function getSql() {
  if (!globalDatabase.jiuhengSql) globalDatabase.jiuhengSql = postgres(getDatabaseUrl(), {
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
  });
  return globalDatabase.jiuhengSql;
}

export function getDb() {
  return drizzle(getSql(), { schema });
}
