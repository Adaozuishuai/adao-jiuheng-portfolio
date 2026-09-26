import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import nextEnv from '@next/env';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const suites = {
  all: ['tests/e2e/auth.mjs', 'tests/e2e/blog.mjs'],
  auth: ['tests/e2e/auth.mjs'],
  blog: ['tests/e2e/blog.mjs'],
};
const selection = process.argv[2] ?? 'all';
const targets = suites[selection];
if (!targets) throw new Error(`Unknown test suite: ${selection}`);

nextEnv.loadEnvConfig(process.cwd());
const url = new URL(process.env.DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
  throw new Error('Tests require a local PostgreSQL instance.');
}
const name = `jiuheng_test_${randomBytes(8).toString('hex')}`;
const control = new URL(url);
control.pathname = '/postgres';
const admin = postgres(control.toString(), { onnotice: () => {} });
const uploadDir = await mkdtemp(join(tmpdir(), 'jiuheng-auth-test-'));
url.pathname = `/${name}`;
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  SITE_URL: 'http://localhost:3101',
  UPLOAD_DIR: uploadDir,
  AUTH_TEST_ISOLATED: 'true',
  NODE_ENV: 'production',
};
let server;
try {
  await admin`CREATE DATABASE ${admin(name)}`;
  const sql = postgres(url.toString(), { onnotice: () => {} });
  try {
    await migrate(drizzle(sql), {
      migrationsFolder: resolve('db/migrations'),
    });
  } finally {
    await sql.end();
  }
  server = spawn(
    process.execPath,
    [
      'node_modules/next/dist/bin/next',
      'start',
      '--hostname',
      '127.0.0.1',
      '--port',
      '3101',
    ],
    { env, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  server.stderr.on('data', () => {});
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) {
      throw new Error('Isolated test server could not start.');
    }
    try {
      if ((await fetch('http://localhost:3101/admin/login')).status === 200) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
  if (!ready) throw new Error('Isolated test server readiness timeout.');
  for (const target of targets) {
    const child = spawn(process.execPath, [target], { env, stdio: 'inherit' });
    const [code] = await once(child, 'exit');
    if (code !== 0) throw new Error(`Test failed: ${target}`);
  }
  console.log(
    'Isolated tests passed; your local administrator and articles were not modified.',
  );
} finally {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await once(server, 'exit');
  }
  await admin`DROP DATABASE IF EXISTS ${admin(name)} WITH (FORCE)`;
  await admin.end();
  await rm(uploadDir, { recursive: true, force: true });
}
