import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { and, eq, gt } from 'drizzle-orm';
import type { TransactionSql } from 'postgres';
import { administrators, adminSessions } from '@/db/schema';
import { getDb, getSql } from './db';

const scrypt = promisify(scryptCallback);
const cookieName = 'jiuheng_admin';
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export function siteOrigin() {
  const configured = process.env.SITE_URL;
  if (!configured && process.env.NODE_ENV === 'production')
    throw new Response('SITE_URL 尚未配置', { status: 503 });
  return new URL(configured || 'http://localhost:3000').origin;
}
export function checkOrigin(request: Request) {
  if (request.headers.get('origin') !== siteOrigin())
    throw new Response('请求来源不匹配，请刷新后重试', { status: 403 });
}
export async function hasAdministrator() {
  return Boolean(
    (
      await getDb()
        .select({ id: administrators.id })
        .from(administrators)
        .where(eq(administrators.id, 1))
        .limit(1)
    )[0],
  );
}
export async function isAdmin() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const [session] = await getDb()
    .select({ token: adminSessions.tokenHash })
    .from(adminSessions)
    .where(
      and(
        eq(adminSessions.tokenHash, hash(token)),
        gt(adminSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return Boolean(session);
}
export async function requireAdmin(request?: Request) {
  if (request) checkOrigin(request);
  if (!(await isAdmin()))
    throw new Response('登录已过期，请重新登录', { status: 401 });
}
export function nonemptyPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
async function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  const bytes = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${bytes.toString('hex')}`;
}
async function matchesPassword(password: string, encoded: string) {
  const [salt, expected] = encoded.split(':');
  if (
    !/^[a-f0-9]{32}$/.test(salt ?? '') ||
    !/^[a-f0-9]{128}$/.test(expected ?? '')
  )
    return false;
  return timingSafeEqual(
    (await scrypt(password, salt, 64)) as Buffer,
    Buffer.from(expected, 'hex'),
  );
}
// The app binds to loopback. Never use caller-controlled forwarding headers as source identity.
function failureKey(username: string, purpose = 'login') {
  return hash(JSON.stringify(['local', purpose, username]));
}
async function blocked(tx: TransactionSql, key: string) {
  const [row] =
    await tx`SELECT attempts FROM login_limits WHERE key = ${key} AND reset_at > now()`;
  return row && row.attempts >= 5;
}
async function recordFailure(tx: TransactionSql, key: string) {
  await tx`INSERT INTO login_limits (key, attempts, reset_at) VALUES (${key}, 1, now() + interval '15 minutes') ON CONFLICT (key) DO UPDATE SET attempts = CASE WHEN login_limits.reset_at <= now() THEN 1 ELSE login_limits.attempts + 1 END, reset_at = CASE WHEN login_limits.reset_at <= now() THEN now() + interval '15 minutes' ELSE login_limits.reset_at END`;
}
function fail(status: number) {
  throw new Response(
    status === 429
      ? '尝试次数过多，请在当前 15 分钟限制结束后重试'
      : status === 503
        ? '管理员尚未配置，请联系站点所有者'
        : '账号或密码不正确',
    { status },
  );
}
export async function login(username: string, password: string) {
  const key = failureKey(username),
    token = randomBytes(32).toString('hex');
  const status = await getSql().begin(async (tx) => {
    // Serialize login and revocation: an old password cannot race a reset and create a new session.
    await tx`SELECT pg_advisory_xact_lock(714002)`;
    if (await blocked(tx, key)) return 429;
    const [admin] =
      await tx`SELECT username, password_hash FROM administrators WHERE id = 1`;
    if (!admin) return 503;
    const valid = await matchesPassword(password, admin.password_hash);
    if (!nonemptyPassword(password) || !valid || username !== admin.username) {
      await recordFailure(tx, key);
      return 401;
    }
    await tx`DELETE FROM login_limits WHERE key = ${key} OR reset_at <= now()`;
    await tx`DELETE FROM admin_sessions WHERE expires_at <= now()`;
    await tx`INSERT INTO admin_sessions (token_hash, expires_at) VALUES (${hash(token)}, now() + interval '12 hours')`;
    return 200;
  });
  if (status !== 200) fail(status);
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: siteOrigin().startsWith('https:'),
    path: '/',
    maxAge: 43200,
  });
}
export async function logout() {
  const jar = await cookies(),
    token = jar.get(cookieName)?.value;
  if (token)
    await getDb()
      .delete(adminSessions)
      .where(eq(adminSessions.tokenHash, hash(token)));
  jar.delete(cookieName);
}
export async function secureAccount(
  action: 'password' | 'logout-all',
  currentPassword?: string,
  newPassword?: string,
) {
  const jar = await cookies(),
    token = jar.get(cookieName)?.value;
  if (!token) throw new Response('登录已过期，请重新登录', { status: 401 });
  const status = await getSql().begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(714002)`;
    const [session] =
      await tx`SELECT token_hash FROM admin_sessions WHERE token_hash = ${hash(token)} AND expires_at > now()`;
    if (!session) return 401;
    if (action === 'password') {
      const [admin] =
        await tx`SELECT username, password_hash FROM administrators WHERE id = 1`;
      if (!admin) return 401;
      const key = failureKey(admin.username, 'change-password');
      if (await blocked(tx, key)) return 429;
      if (
        !nonemptyPassword(currentPassword) ||
        !(await matchesPassword(currentPassword, admin.password_hash))
      ) {
        await recordFailure(tx, key);
        return 401;
      }
      if (!nonemptyPassword(newPassword)) return 400;
      const encoded = await passwordHash(newPassword);
      await tx`UPDATE administrators SET password_hash = ${encoded} WHERE id = 1`;
      await tx`DELETE FROM login_limits`;
    }
    await tx`DELETE FROM admin_sessions`;
    return 200;
  });
  if (status === 400) throw new Response('密码不能为空', { status });
  if (status !== 200) fail(status);
  jar.delete(cookieName);
}
export async function readJson(request: Request) {
  const maximum = 2_000_000;
  if (Number(request.headers.get('content-length') || 0) > maximum)
    throw new Response('请求内容过大', { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) throw new Response('请求格式无效', { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      throw new Response('请求内容过大', { status: 413 });
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Response('请求格式无效', { status: 400 });
  }
}
