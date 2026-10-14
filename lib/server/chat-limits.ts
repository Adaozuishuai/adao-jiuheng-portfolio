import 'server-only';
import { createHmac, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { cookies } from 'next/headers';
import { getSql } from './db';
import { siteOrigin } from './auth';
const setting = (key: string, fallback: number) => {
  const n = Number(process.env[key] ?? fallback);
  return Number.isSafeInteger(n) && n > 0 ? n : fallback;
};
export async function reserveChat(request: Request, session: string) {
  const secret = process.env.CHAT_HASH_SECRET || process.env.ZHIPU_API_KEY;
  if (!secret) throw new Response('聊天服务尚未配置', { status: 503 });
  const hash = (s: string) =>
    createHmac('sha256', secret).update(s).digest('hex');
  const jar = await cookies();
  const saved = jar.get('jiuheng_chat')?.value || '';
  const [id, signature] = saved.split('.');
  const visitor = id && signature === hash(id) ? id : randomUUID();
  if (visitor !== id)
    jar.set('jiuheng_chat', `${visitor}.${hash(visitor)}`, {
      httpOnly: true,
      sameSite: 'strict',
      secure: siteOrigin().startsWith('https:'),
      path: '/',
      maxAge: 86400,
    });
  const ip =
    process.env.CHAT_TRUST_PROXY === 'true'
      ? request.headers.get('x-real-ip') || ''
      : '';
  if (process.env.CHAT_TRUST_PROXY === 'true' && !isIP(ip))
    throw new Response('聊天代理配置不可用', { status: 503 });
  const lease = `lease:${hash(session)}`;
  const keys = [
    `visitor:${hash(visitor)}`,
    ...(ip ? [`ip:${hash(ip)}`] : []),
    'global',
  ];
  await getSql().begin(async (tx) => {
    // One short transaction serializes both quota levels and the session lease across workers.
    await tx`SELECT pg_advisory_xact_lock(714003)`;
    await tx`DELETE FROM chat_limits WHERE expires_at <= now()`;
    const existing = await tx`SELECT key FROM chat_limits WHERE key = ${lease}`;
    if (existing.length)
      throw new Response('当前对话正在生成，请稍候', { status: 409 });
    for (const key of keys) {
      const [row] = await tx`SELECT count FROM chat_limits WHERE key = ${key}`;
      if (
        row &&
        row.count >=
          setting(
            key === 'global' ? 'CHAT_DAILY_LIMIT' : 'CHAT_HOURLY_LIMIT',
            key === 'global' ? 200 : 20,
          )
      )
        throw new Response(
          key === 'global'
            ? '本站今日聊天额度已用完，请明天再来'
            : '本小时聊天次数已达上限，请稍后再试',
          { status: 429 },
        );
    }
    for (const key of keys) {
      const seconds = key === 'global' ? 86400 : 3600;
      await tx`INSERT INTO chat_limits (key,count,expires_at) VALUES (${key},1,now()+${seconds}*interval '1 second') ON CONFLICT(key) DO UPDATE SET count=chat_limits.count+1`;
    }
    await tx`INSERT INTO chat_limits (key,count,expires_at) VALUES (${lease},1,now()+interval '90 seconds')`;
  });
  return async () => {
    await getSql()`DELETE FROM chat_limits WHERE key=${lease}`;
  };
}

function chatHash(value: string) {
  const secret = process.env.CHAT_HASH_SECRET || process.env.ZHIPU_API_KEY;
  if (!secret) throw new Response('聊天服务尚未配置', { status: 503 });
  return createHmac('sha256', secret).update(value).digest('hex');
}
export async function cancelChat(session: string, generation: string) {
  const lease = `lease:${chatHash(session)}`,
    cancelled = `cancel:${chatHash(generation)}`;
  await getSql().begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(714003)`;
    await tx`DELETE FROM chat_limits WHERE key=${lease}`;
    await tx`INSERT INTO chat_limits(key,count,expires_at) VALUES(${cancelled},1,now()+interval '90 seconds') ON CONFLICT(key) DO NOTHING`;
  });
}
export async function wasCancelled(generation: string) {
  const key = `cancel:${chatHash(generation)}`;
  const rows =
    await getSql()`SELECT 1 FROM chat_limits WHERE key=${key} AND expires_at>now()`;
  return rows.length > 0;
}

const activeGenerations = new Map<string, AbortController>();
export function registerChatGeneration(
  generation: string,
  controller: AbortController,
) {
  activeGenerations.set(generation, controller);
  return () => activeGenerations.delete(generation);
}
export function abortActiveChat(generation: string) {
  activeGenerations.get(generation)?.abort();
}
