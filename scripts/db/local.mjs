import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

process.umask(0o077);
if (!existsSync('.env.local')) {
  const password = randomBytes(32).toString('hex');
  await writeFile(
    '.env.local',
    `DATABASE_URL=postgresql://jiuheng:${password}@127.0.0.1:55432/jiuheng\nUPLOAD_DIR=${resolve('data/uploads')}\nSITE_URL=http://localhost:3000\n`,
    { flag: 'wx', mode: 0o600 },
  );
}
loadEnvConfig(process.cwd());
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== '55432')
  throw new Error('本地辅助脚本仅管理 127.0.0.1:55432，不会连接其他数据库。');
const directory = resolve('data/local-postgres');
await mkdir('data/uploads', { recursive: true });
const pg = new EmbeddedPostgres({
  databaseDir: directory,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  port: 55432,
  persistent: true,
  authMethod: 'scram-sha-256',
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {},
  onError: (error) => console.error('[local-db]', error),
});
if (!existsSync(`${directory}/PG_VERSION`)) await pg.initialise();
await pg.start();
const adminUrl = new URL(url);
adminUrl.pathname = '/postgres';
const admin = postgres(adminUrl.toString());
const name = url.pathname.slice(1);
const [database] =
  await admin`SELECT 1 FROM pg_database WHERE datname = ${name}`;
if (!database) await admin`CREATE DATABASE ${admin(name)}`;
await admin.end();
const sql = postgres(url.toString());
await migrate(drizzle(sql), { migrationsFolder: './db/migrations' });
await sql.end();
console.log(
  '本地 PostgreSQL 已启动，数据库迁移已完成。按 Ctrl+C 停止，文章与图片会保留。',
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    await pg.stop();
    process.exit(0);
  });
setInterval(() => {}, 60000);
